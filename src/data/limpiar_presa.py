#!/usr/bin/env python3
"""
Huecos, validaciones y limpieza de los CSV procesados.

Comando: src/data/limpiar_presa.py data/processed/*_procesado.csv

Entrada : CSV de datos/procesados (salida de preparar_presa.py).
Salidas : data/clean/<CLAVE>_limpio.csv, huecos.csv, anomalias.csv,
          reporte_limpieza.csv

Reglas:
  1. Se completa el calendario diario: los dias ausentes entran como filas vacias.
  2. Valores fisicamente imposibles (negativos) se vuelven vacios.
  3. Huecos de <= --max-hueco dias se rellenan por interpolacion lineal en el
     tiempo (nivel, volumen, salidas, evaporacion). Huecos mas largos NO se tocan.
  4. La lluvia nunca se interpola (es por eventos: inventaria tormentas).
  5. Anomalias dudosas (volumen > NAME, saltos grandes, lluvia extrema, saltos de
     volumen incoherentes con el nivel) solo se marcan en anomalias.csv; no se
     modifican. Excepcion: un volumen 0 aislado se trata como dato faltante.
  6. Columnas de control: imputado (se relleno algo ese dia) y
     hueco_sin_rellenar (volumen sigue vacio).
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

VOL = "VolumenAlm(Mm3)"
PRECIP = "Precipitacion(mm)"
INTERP = ["Nivel(m)", VOL, "ObraToma(m3/s)", "Vertedor(m3/s)",
          "Derrame(m3/s)", "Evaporacion(mm)"]
VARS = INTERP + [PRECIP]
CONST = ["Estacion", "id_inventario", "name_hm3", "namo_hm3", "namino_hm3"]
LLUVIA_MAX = 300      # mm/dia: se marca, no se corrige
SALTO_MAX = 0.05      # fraccion del NAMO por dia: se marca, no se corrige


def leer(ruta):
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(ruta, encoding=enc, parse_dates=["Fecha"])
        except UnicodeDecodeError:
            continue
    raise ValueError(f"No pude decodificar {ruta}")


def rachas(s):
    """Rachas consecutivas de vacios: lista de (inicio, fin, dias)."""
    na = s.isna()
    g = (na != na.shift()).cumsum()
    return [(t.index[0], t.index[-1], len(t)) for _, t in s[na].groupby(g[na])]


def rellenar(s, max_gap):
    """Interpola solo huecos interiores de <= max_gap dias. Devuelve (serie, mascara)."""
    interp = s.interpolate(method="time", limit_area="inside")
    na = s.isna()
    g = (na != na.shift()).cumsum()
    largo = na.groupby(g).transform("sum")
    usar = na & (largo <= max_gap) & interp.notna()
    return s.where(~usar, interp), usar


def clasificar_saltos(v, n, anom, clave):
    """Saltos de volumen en sentido contrario al nivel (mismo criterio que evaluar_candidata.py).

    Cambio de curva: el volumen queda DESPLAZADO respecto a la curva nivel-volumen
    30 dias despues (PENCP). Error de un dia: regresa a la curva. Ambos se marcan,
    ninguno se modifica. Devuelve (cambios_de_curva, errores_de_un_dia)."""
    dv, dn = v.diff(), n.diff()
    umbral = 0.05 * v.max()
    cand = dv.index[(dv * dn < 0) & (dv.abs() > umbral) & (dn.abs() > 0.10)]
    if not len(cand):
        return 0, 0
    ok = v.notna() & n.notna() & (v > 0)
    res = v - np.polyval(np.polyfit(n[ok], v[ok], 3), n)
    dia, cambios = pd.Timedelta(days=1), 0
    for f in cand:
        antes = res.loc[f - 30 * dia:f - dia].median()
        despues = res.loc[f + dia:f + 30 * dia].median()
        curva = pd.notna(antes) and pd.notna(despues) and abs(despues - antes) > umbral
        cambios += int(curva)
        anom.append((clave, f.date(), VOL, v[f], "cambio de curva nivel-volumen (persistente)"
                     if curva else "volumen incoherente con el nivel, 1 dia (error de captura)"))
    return cambios, len(cand) - cambios


def procesar(ruta, max_gap):
    df = leer(ruta)
    clave = df["Estacion"].iloc[0]
    n_dup = int(df["Fecha"].duplicated().sum())
    df = df.drop_duplicates("Fecha").set_index("Fecha").sort_index()

    # 1. calendario diario completo
    idx = pd.date_range(df.index.min(), df.index.max(), freq="D")
    dias_ausentes = len(idx) - len(df)
    df = df.reindex(idx)
    df.index.name = "Fecha"
    for c in CONST:
        if c in df and df[c].notna().any():
            df[c] = df[c].dropna().iloc[0]

    anom, huecos = [], []
    namo = df["namo_hm3"].iloc[0] if "namo_hm3" in df else np.nan
    name = df["name_hm3"].iloc[0] if "name_hm3" in df else np.nan
    namino = df["namino_hm3"].iloc[0] if "namino_hm3" in df else np.nan

    # 2. imposibles -> vacio (se registra)
    n_neg = 0
    for v in VARS:
        neg = df[v] < 0
        for f in df.index[neg]:
            anom.append((clave, f.date(), v, df.at[f, v], "negativo (corregido a vacio)"))
        n_neg += int(neg.sum())
        df.loc[neg, v] = np.nan

    # 2b. volumen 0 aislado (entre dos dias con volumen > 0) = error de captura -> vacio
    cero = (df[VOL] == 0) & (df[VOL].shift(1) > 0) & (df[VOL].shift(-1) > 0)
    for f in df.index[cero]:
        anom.append((clave, f.date(), VOL, 0.0, "volumen 0 aislado (corregido a vacio)"))
    n_cero = int(cero.sum())
    df.loc[cero, VOL] = np.nan

    # 5. marcas (sin modificar)
    n_sobre = n_salto = n_lluvia = n_curva = n_un_dia = 0
    if pd.notna(name):
        for f in df.index[df[VOL] > name]:
            anom.append((clave, f.date(), VOL, df.at[f, VOL], "volumen > NAME"))
            n_sobre += 1
    if pd.notna(namo):
        d = df[VOL].diff().abs()
        for f in df.index[d > SALTO_MAX * namo]:
            anom.append((clave, f.date(), VOL, df.at[f, VOL],
                         f"salto diario {d[f]:.1f} Mm3 (> {SALTO_MAX:.0%} NAMO)"))
            n_salto += 1
        if "Nivel(m)" in df:
            n_curva, n_un_dia = clasificar_saltos(df[VOL], df["Nivel(m)"], anom, clave)
    for f in df.index[df[PRECIP] > LLUVIA_MAX]:
        anom.append((clave, f.date(), PRECIP, df.at[f, PRECIP], f"lluvia > {LLUVIA_MAX} mm"))
        n_lluvia += 1

    # 3. huecos: se listan y se rellenan los cortos
    imputado = pd.Series(False, index=df.index)
    for v in VARS:
        for ini, fin, n in rachas(df[v]):
            huecos.append([clave, v, ini.date(), fin.date(), n, None])
        if v in INTERP:
            df[v], usado = rellenar(df[v], max_gap)
            imputado |= usado
    for h in huecos:
        v, ini, fin = h[1], pd.Timestamp(h[2]), pd.Timestamp(h[3])
        h[5] = bool(df.loc[ini:fin, v].notna().all()) if v in INTERP else False

    df["imputado"] = imputado
    df["hueco_sin_rellenar"] = df[VOL].isna()
    if pd.notna(namo):
        df["llenado_namo_pct"] = (df[VOL] / namo * 100).round(3)

    hv = [h for h in huecos if h[1] == VOL]
    vol_ini = df[VOL].notna().sum()
    rep = {
        "clave_sih": clave, "dias_total": len(df), "dias_ausentes_en_archivo": dias_ausentes,
        "fechas_duplicadas": n_dup,
        "huecos_volumen": len(hv),
        "hueco_volumen_mas_largo_dias": max([h[4] for h in hv], default=0),
        "huecos_volumen_rellenados": sum(1 for h in hv if h[5]),
        "huecos_volumen_sin_rellenar": sum(1 for h in hv if not h[5]),
        "dias_volumen_sin_rellenar": int(df["hueco_sin_rellenar"].sum()),
        "dias_con_algo_imputado": int(imputado.sum()),
        "lluvia_vacia_sin_tocar": int(df[PRECIP].isna().sum()),
        "negativos_corregidos": n_neg, "ceros_aislados_corregidos": n_cero,
        "volumen_sobre_NAME": n_sobre, "saltos_diarios_grandes": n_salto,
        "lluvia_extrema": n_lluvia, "rupturas_curva_nivel_volumen": n_curva, "saltos_de_un_dia": n_un_dia,
        "dias_bajo_NAMINO_pct": round((df[VOL] < namino).mean() * 100, 2)
        if pd.notna(namino) else None,
    }
    return clave, df.reset_index(), huecos, anom, rep


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", nargs="+", type=Path, help="CSV de datos/procesados")
    ap.add_argument("--max-hueco", type=int, default=3,
                    help="dias maximos de un hueco a interpolar (default 3)")
    ap.add_argument("--salida", type=Path, default=Path("data/clean"))
    a = ap.parse_args()
    a.salida.mkdir(parents=True, exist_ok=True)

    H, A, R = [], [], []
    for ruta in a.csv:
        if ruta.name.startswith("reporte"):
            continue
        clave, df, huecos, anom, rep = procesar(ruta, a.max_hueco)
        df.to_csv(a.salida / f"{clave}_limpio.csv", index=False)
        H += huecos; A += anom; R.append(rep)

    pd.DataFrame(H, columns=["clave_sih", "variable", "inicio", "fin", "dias",
                             "rellenado"]).to_csv(a.salida / "huecos.csv", index=False)
    pd.DataFrame(A, columns=["clave_sih", "fecha", "variable", "valor",
                             "motivo"]).to_csv(a.salida / "anomalias.csv", index=False)
    rep = pd.DataFrame(R)
    rep.to_csv(a.salida / "reporte_limpieza.csv", index=False)
    print(rep.T.to_string(header=False))


if __name__ == "__main__":
    main()