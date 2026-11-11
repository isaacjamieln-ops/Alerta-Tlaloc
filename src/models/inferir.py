"""Prediccion para una presa y una fecha (7, 15 y 30 dias).

Sirve de dos formas:
  - Línea de comandos:
        python inferir.py --presa CCHNL
        python inferir.py --presa CCHNL --fecha 2026-10-01
  - Como módulo para el tablero (Streamlit):
        from inferir import cargar_artefactos, predecir
        artefactos = cargar_artefactos()
        resultado = predecir(df, "CCHNL", artefactos=artefactos)

IMPORTANTE: las variables de entrada (rezagos, lluvia acumulada, etc.) se
toman de la fila del dataset para esa presa y fecha. Si el equipo de datos
actualiza el CSV con nuevas fechas, aquí se puede predecir sobre ellas.
"""
import argparse
import json

import joblib
import pandas as pd

import config as cfg


def cargar_artefactos() -> dict:
    """Carga modelos y metadatos de todos los horizontes (una sola vez)."""
    art = {}
    for h in cfg.HORIZONTES:
        with open(cfg.DIR_MODELOS / f"meta_cambio_{h}d.json", encoding="utf-8") as f:
            meta = json.load(f)
        art[h] = {"modelo": joblib.load(cfg.DIR_MODELOS / f"modelo_cambio_{h}d.pkl"),
                  "meta": meta}
    return art


def predecir(df: pd.DataFrame, clave_sih: str, fecha=None, artefactos=None) -> dict:
    """Predice el volumen a 7/15/30 días para `clave_sih`.

    fecha=None usa la última observación disponible de esa presa.
    Devuelve un diccionario listo para mostrarse o exportarse.
    """
    artefactos = artefactos or cargar_artefactos()
    g = df[df["clave_sih"] == clave_sih]
    if g.empty:
        raise ValueError(f"Presa '{clave_sih}' no encontrada. "
                         f"Disponibles: {sorted(df['clave_sih'].unique())}")
    if fecha is None:
        fila = g.sort_values("fecha").iloc[-1]
    else:
        fecha = pd.Timestamp(fecha)
        g = g[g["fecha"] == fecha]
        if g.empty:
            raise ValueError(f"No hay observación de {clave_sih} el {fecha.date()}.")
        fila = g.iloc[0]

    faltantes = [c for c in artefactos[cfg.HORIZONTES[0]]["meta"]["features"]
                 if pd.isna(fila[c])]
    if faltantes:
        raise ValueError(f"Faltan datos de entrada para predecir: {faltantes}")

    salida = {"presa": clave_sih, "fecha_base": fila["fecha"].date().isoformat(),
              "volumen_actual_hm3": float(fila["vol_hoy"]),
              "capacidad_hm3": float(fila["namo_hm3"]), "predicciones": {}}
    for h, a in artefactos.items():
        X = cfg.matriz_features(fila.to_frame().T.astype({c: float for c in a["meta"]["features"]}),
                                a["meta"]["features"])
        cambio = float(a["modelo"].predict(X)[0]) * float(fila["namo_hm3"])
        q = a["meta"]["semiancho_intervalo_hm3_por_presa"].get(
            clave_sih, a["meta"]["semiancho_intervalo_hm3_global"])
        vol = float(fila["vol_hoy"]) + cambio
        salida["predicciones"][h] = {
            "cambio_hm3": cambio,
            "volumen_hm3": vol,
            "intervalo_90_hm3": (vol - q, vol + q),
            "llenado_pct": vol / float(fila["namo_hm3"]) * 100,
        }
    return salida


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--presa", required=True, help="clave SIH, p. ej. CCHNL")
    ap.add_argument("--fecha", default=None, help="AAAA-MM-DD (por defecto, la última)")
    args = ap.parse_args()

    df = cfg.cargar_datos()
    r = predecir(df, args.presa, args.fecha)
    print("=" * 60)
    print(f" Presa {r['presa']} | Fecha base: {r['fecha_base']}")
    print(f" Volumen actual: {r['volumen_actual_hm3']:.2f} hm3 "
          f"(capacidad {r['capacidad_hm3']:.2f} hm3)")
    print("=" * 60)
    for h, p in r["predicciones"].items():
        lo, hi = p["intervalo_90_hm3"]
        print(f" A {h:>2} días: {p['volumen_hm3']:.2f} hm3 "
              f"[{lo:.2f} – {hi:.2f}] | cambio {p['cambio_hm3']:+.2f} hm3 | "
              f"llenado {p['llenado_pct']:.1f} %")
    print("\nHerramienta de apoyo a la decisión; no sustituye a las autoridades.")


if __name__ == "__main__":
    main()
