#!/usr/bin/env python3
"""
Dataset de modelado a partir de las presas limpias.

Lee TODOS los CSV <CLAVE>_limpio.csv de una carpeta (salida de limpiar_presa.py),
o los archivos / carpetas que indiques, y crea un dataset por presa y ademas un
dataset unico que reune todas las presas.

Carpetas (relativas a la raiz del proyecto = carpeta que contiene src/)
  Entrada : se busca la primera de data/clean, data/cleaned, data/limpios,
            data/processed, datos/limpios que contenga *_limpio.csv
            (cambia CANDIDATAS_ENTRADA abajo, o usa argumentos)
  Salida  : data/modeling/
              individual/<CLAVE>_modelado.csv   un dataset por presa
              full/modelado_completo.csv        un solo dataset con todas las presas
              reporte_modelado.csv              resumen por presa

El dataset "full" es la union (una debajo de otra) de los individuales, ordenada por
clave_sih y fecha. Conserva las columnas clave_sih y particion, asi que se puede
filtrar una presa o separar entrenamiento/prueba sin perder la particion de cada una.

Cada fila es "lo que se sabe el dia D" (variables de entrada) y "lo que paso
despues" (objetivos). Regla de oro: NINGUNA variable de entrada usa informacion
posterior al dia D. El script lo comprueba al final con una autoverificacion.

Variables de entrada
  vol_hoy, llenado_pct          volumen del dia D y su % respecto al NAMO
  vol_lag_k, cambio_k d         volumen de hace k dias y cuanto cambio (k = 1,7,14,30)
  lluvia_w d                    lluvia acumulada de los ultimos w dias (w = 1,3,7,15,30)
  lluvia_faltante_30d           dias sin dato de lluvia en esos 30 dias (se tomaron como 0)
  mes, dia_anio_sin/cos         calendario (el dia del anio como circulo: 31-dic cerca de 1-ene)

Objetivos (por horizonte h = 7, 15, 30 dias)
  obj_vol_hd                    volumen dentro de h dias
  obj_cambio_hd                 obj_vol_hd - vol_hoy

Particion cronologica (columna "particion")
  entrenamiento : las fechas mas antiguas
  embargo       : los 30 dias previos al corte; se descartan porque sus objetivos
                  "asoman" al periodo de prueba (fuga de informacion)
  prueba        : el ultimo 20 % de la serie (mismo corte que el EDA)

Uso:
  python src/data/crear_dataset.py                              # todas las presas de la carpeta
  python src/data/crear_dataset.py --hasta 2026-10-26           # recorta todas a la misma fecha
  python src/data/crear_dataset.py --excluir NNEPB PENCP        # omite presas por clave
  python src/data/crear_dataset.py data/clean                   # otra carpeta
  python src/data/crear_dataset.py data/clean/LBQCH_limpio.csv  # un solo archivo
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]          # carpeta que contiene src/
CANDIDATAS_ENTRADA = ["data/clean"]
SALIDA_DEFECTO = RAIZ / "data" / "datasets"
SUB_INDIVIDUAL, SUB_FULL = "individual", "full"
NOMBRE_FULL = "modelado_completo.csv"
PATRON = "*_limpio.csv"

VOL, LLU = "VolumenAlm(Mm3)", "Precipitacion(mm)"
REZAGOS = (1, 7, 14, 30)
VENTANAS_LLUVIA = (1, 3, 7, 15, 30)
HORIZONTES = (7, 15, 30)
PRUEBA = 0.20


def carpeta_entrada_por_defecto():
    for c in CANDIDATAS_ENTRADA:
        carpeta = RAIZ / c
        if carpeta.is_dir() and any(carpeta.glob(PATRON)):
            return carpeta
    buscadas = "\n".join(f"  - {RAIZ / c}" for c in CANDIDATAS_ENTRADA)
    raise SystemExit(f"No encontre archivos {PATRON}. Busque en:\n{buscadas}\n"
                     "Indica la carpeta: python src/data/crear_dataset.py ruta/a/la/carpeta")


def listar_csv(entradas, excluir):
    """Acepta archivos y/o carpetas; sin argumentos usa la carpeta por defecto."""
    if not entradas:
        entradas = [carpeta_entrada_por_defecto()]
    csvs = []
    for e in map(Path, entradas):
        if e.is_dir():
            hallados = sorted(e.glob(PATRON))
            if not hallados:
                raise SystemExit(f"No hay archivos {PATRON} en {e}")
            csvs += hallados
        elif e.is_file():
            csvs.append(e)
        else:
            raise SystemExit(f"No existe: {e}")
    excluir = {c.upper() for c in excluir}
    omitidas = [p for p in csvs if p.name.split("_")[0].upper() in excluir]
    csvs = [p for p in csvs if p not in omitidas]
    if omitidas:
        print("Omitidas por --excluir: " + ", ".join(p.name.split("_")[0] for p in omitidas))
    if not csvs:
        raise SystemExit("No quedaron presas por procesar.")
    return csvs


def construir(d, namo, lluvia_vacia):
    """Devuelve (tabla con entradas y objetivos, lluvia usada, fecha de corte)."""
    v = d[VOL]
    X = pd.DataFrame(index=d.index)

    # --- entradas: volumen ---
    X["vol_hoy"] = v
    X["llenado_pct"] = (v / namo * 100).round(3)
    for k in REZAGOS:
        X[f"vol_lag_{k}"] = v.shift(k)             # shift(k) = valor de hace k dias
        X[f"cambio_{k}d"] = v - v.shift(k)

    # --- entradas: lluvia acumulada (incluye el dia D) ---
    lluvia = d[LLU]
    sin_dato = lluvia.isna()
    if lluvia_vacia == "cero":
        lluvia = lluvia.fillna(0)
    for w in VENTANAS_LLUVIA:
        X[f"lluvia_{w}d"] = lluvia.rolling(w, min_periods=w).sum()
    X["lluvia_faltante_30d"] = sin_dato.rolling(30, min_periods=30).sum()

    # --- entradas: calendario ---
    doy = d.index.dayofyear
    X["mes"] = d.index.month
    X["dia_anio_sin"] = np.sin(2 * np.pi * doy / 365.25).round(5)
    X["dia_anio_cos"] = np.cos(2 * np.pi * doy / 365.25).round(5)

    entradas = list(X.columns)

    # --- objetivos: shift NEGATIVO = mirar al futuro (solo aqui) ---
    for h in HORIZONTES:
        X[f"obj_vol_{h}d"] = v.shift(-h)
        X[f"obj_cambio_{h}d"] = v.shift(-h) - v

    corte = d.index[int(len(d) * (1 - PRUEBA))]
    return X, entradas, lluvia, corte


def particionar(index, corte):
    embargo_desde = corte - pd.Timedelta(days=max(HORIZONTES))
    return np.where(index >= corte, "prueba",
                    np.where(index < embargo_desde, "entrenamiento", "embargo"))


def verificar(d, out, lluvia, corte):
    """Autoverificacion: recalcula a mano 300 filas al azar y compara."""
    dia = pd.Timedelta(days=1)
    for f, fila in out.sample(min(300, len(out)), random_state=0).iterrows():
        for k in REZAGOS:                                   # rezagos = pasado
            assert np.isclose(fila[f"vol_lag_{k}"], d.at[f - k * dia, VOL]), (f, k)
        for w in VENTANAS_LLUVIA:                           # lluvia = ventana hasta D
            esperado = lluvia.loc[f - (w - 1) * dia:f].sum()
            assert np.isclose(fila[f"lluvia_{w}d"], esperado), (f, w)
        for h in HORIZONTES:                                # objetivo = D + h
            f2 = f + h * dia
            esperado = d.at[f2, VOL] if f2 in d.index else np.nan
            assert np.isclose(fila[f"obj_vol_{h}d"], esperado, equal_nan=True), (f, h)
    ent = out.index[out["particion"] == "entrenamiento"]
    pru = out.index[out["particion"] == "prueba"]
    # ningun objetivo de entrenamiento puede caer dentro del periodo de prueba
    assert ent.max() + max(HORIZONTES) * dia < pru.min()


def procesar(ruta, lluvia_vacia, hasta):
    d = pd.read_csv(ruta, encoding="utf-8-sig", parse_dates=["Fecha"])
    d = d.set_index("Fecha").sort_index()
    if hasta:
        d = d.loc[:hasta]
    clave = str(d["Estacion"].iloc[0])
    assert (d.index.to_series().diff().dropna() == pd.Timedelta(days=1)).all(), \
        f"{clave}: el calendario no es diario continuo (corre limpiar_presa.py)"
    namo = float(d["namo_hm3"].iloc[0])

    pct_sin_lluvia = d[LLU].isna().mean() * 100
    if pct_sin_lluvia > 2:
        print(f"[AVISO] {clave}: {pct_sin_lluvia:.1f} % de los dias sin dato de lluvia. "
              "Tomarlos como 0 inventaria lluvia: usa --lluvia-vacia descartar "
              "o revisa de donde empieza la lluvia en esta presa.", file=sys.stderr)

    X, entradas, lluvia, corte = construir(d, namo, lluvia_vacia)
    X["particion"] = particionar(X.index, corte)

    antes = len(X)
    X = X.dropna(subset=entradas)               # fila sin entradas completas = inutil
    verificar(d, X, lluvia, corte)

    out = X.reset_index().rename(columns={"index": "fecha", "Fecha": "fecha"})
    out.insert(1, "clave_sih", clave)
    out.insert(3, "namo_hm3", namo)
    cols = ["fecha", "clave_sih", "particion", "namo_hm3"] + entradas + \
           [c for c in out.columns if c.startswith("obj_")]
    out = out[cols]

    n = lambda p: int((X["particion"] == p).sum())
    utiles = lambda p, h: int(((X["particion"] == p) & X[f"obj_vol_{h}d"].notna()).sum())
    rep = {
        "clave_sih": clave, "desde": X.index.min().date(), "hasta": X.index.max().date(),
        "filas_serie": antes, "filas_descartadas_por_vacios": antes - len(X),
        "filas_dataset": len(X),
        "fecha_corte_prueba": corte.date(),
        "filas_entrenamiento": n("entrenamiento"), "filas_embargo": n("embargo"),
        "filas_prueba": n("prueba"),
        "utiles_entren_7d": utiles("entrenamiento", 7),
        "utiles_entren_30d": utiles("entrenamiento", 30),
        "utiles_prueba_7d": utiles("prueba", 7),
        "utiles_prueba_30d": utiles("prueba", 30),
        "dias_lluvia_sin_dato": int(d[LLU].isna().sum()),
        "lluvia_sin_dato_pct": round(pct_sin_lluvia, 1),
    }
    return clave, out, rep


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entrada", nargs="*", type=Path,
                    help="carpeta(s) o archivo(s) *_limpio.csv (default: se detecta)")
    ap.add_argument("--salida", type=Path, default=SALIDA_DEFECTO)
    ap.add_argument("--excluir", nargs="*", default=[], metavar="CLAVE",
                    help="claves de presas a omitir, p. ej. --excluir NNEPB PENCP")
    ap.add_argument("--lluvia-vacia", choices=("cero", "descartar"), default="cero",
                    help="que hacer con dias sin dato de lluvia (default: tomarlos como 0)")
    ap.add_argument("--hasta", default=None,
                    help="recorta todas las presas a esta fecha (AAAA-MM-DD)")
    a = ap.parse_args()

    csvs = listar_csv(a.entrada, a.excluir)
    dir_ind, dir_full = a.salida / SUB_INDIVIDUAL, a.salida / SUB_FULL
    dir_ind.mkdir(parents=True, exist_ok=True)
    dir_full.mkdir(parents=True, exist_ok=True)
    print(f"{len(csvs)} presa(s) -> {a.salida}\n")

    filas, tablas, fallos = [], [], []
    for ruta in csvs:
        try:
            clave, out, rep = procesar(ruta, a.lluvia_vacia, a.hasta)
            out.to_csv(dir_ind / f"{clave}_modelado.csv", index=False)
            filas.append(rep)
            tablas.append(out)
            print(f"  ok     {ruta.name}")
        except Exception as e:                      # una presa mala no detiene a las demas
            fallos.append(ruta.name)
            print(f"  FALLO  {ruta.name}: {type(e).__name__}: {e}", file=sys.stderr)

    if filas:
        rep = pd.DataFrame(filas)
        rep.to_csv(a.salida / "reporte_modelado.csv", index=False)
        full = pd.concat(tablas, ignore_index=True).sort_values(["clave_sih", "fecha"])
        full.to_csv(dir_full / NOMBRE_FULL, index=False)
        print(f"\nDataset completo: {len(full):,} filas, {full['clave_sih'].nunique()} presa(s) "
              f"-> {dir_full / NOMBRE_FULL}\n")
        print(rep.T.to_string(header=False))
    print(f"\nSalidas en {a.salida}/")
    if fallos:
        sys.exit(1)


if __name__ == "__main__":
    main()