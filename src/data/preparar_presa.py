#!/usr/bin/env python3
"""
Delimitar fechas y agrega metadatos a los CSV del SIH.

1,- Recorta desde una fecha
2,- Agrega metadatos del Inventario de Presas
3,- Reporta cobertura. Los originales nunca se tocan.

Uso:
  python src/data/preparar_presa.py data/raw/*.csv
  python src/data/preparar_presa.py data/raw/LBQCH.csv --desde 1995-01-01
"""
import argparse
import re
import sys
from pathlib import Path

import pandas as pd

ENC = ("utf-8", "latin-1")

def leer_csv_flexible(ruta):
    """Lee un CSV probando varias codificaciones (UTF-8, UTF-8 con BOM, latin-1)."""
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return pd.read_csv(ruta, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"No pude decodificar {ruta}")

def leer_sih(ruta: Path):
    """Lee un CSV del SIH: devuelve (DataFrame, dict con la cabecera)."""
    for enc in ENC:
        try:
            lineas = ruta.read_text(encoding=enc).splitlines()
            break
        except UnicodeDecodeError:
            continue
    # La fila de columnas es la primera que empieza con "Estacion,"
    idx = next(i for i, l in enumerate(lineas) if l.startswith("Estacion,"))
    cab = {}
    for l in lineas[:idx]:
        m = re.match(r"\s*([^:]+):\s*(.*)", l)
        if m:
            cab[m.group(1).strip()] = m.group(2).strip()
    df = pd.read_csv(ruta, skiprows=idx, encoding=enc, parse_dates=["Fecha"])
    return df, cab


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", nargs="+", type=Path, help="CSV originales del SIH")
    ap.add_argument("--desde", default="1995-01-01", help="fecha inicial (AAAA-MM-DD)")
    ap.add_argument("--metadatos", type=Path,
                    default=Path("data/metadata/presas_metadata.csv"))
    ap.add_argument("--salida", type=Path, default=Path("data/processed"))
    a = ap.parse_args()

    meta = leer_csv_flexible(a.metadatos).set_index("clave_sih")
    a.salida.mkdir(parents=True, exist_ok=True)
    desde = pd.Timestamp(a.desde)
    resumen = []

    for ruta in a.csv:
        df, cab = leer_sih(ruta)
        clave = df["Estacion"].iloc[0]
        n_orig = len(df)
        df = df[df["Fecha"] >= desde].copy()

        # Metadatos (si la presa aún no está en la tabla, se avisa y se sigue)
        if clave in meta.index:
            m = meta.loc[clave]
            df.insert(1, "id_inventario", m["id_inventario"])
            df["name_hm3"], df["namo_hm3"], df["namino_hm3"] = (
                m["name_hm3"], m["namo_hm3"], m["namino_hm3"])
            df["llenado_namo_pct"] = (df["VolumenAlm(Mm3)"] / m["namo_hm3"] * 100).round(3)
        else:
            print(f"[AVISO] {clave}: no está en {a.metadatos}; se agrega sin capacidades.",
                  file=sys.stderr)

        df.to_csv(a.salida / f"{clave}_procesado.csv", index=False)

        # Reporte de cobertura (diagnóstico, no corrección)
        vol = df.dropna(subset=["VolumenAlm(Mm3)"])
        dias_esp = (df["Fecha"].max() - df["Fecha"].min()).days + 1
        resumen.append({
            "clave_sih": clave, "nombre_sih": cab.get("Estación", ""),
            "estado": cab.get("Estado", ""),
            "filas_originales": n_orig, "filas_desde_corte": len(df),
            "primer_volumen": vol["Fecha"].min().date() if len(vol) else None,
            "ultimo_volumen": vol["Fecha"].max().date() if len(vol) else None,
            "vol_faltante_pct": round(df["VolumenAlm(Mm3)"].isna().mean() * 100, 2),
            "dias_calendario_faltantes": dias_esp - df["Fecha"].nunique(),
            "fechas_duplicadas": int(df["Fecha"].duplicated().sum()),
        })

    rep = pd.DataFrame(resumen)
    rep.to_csv(a.salida / "reporte_cobertura.csv", index=False)
    print(rep.T.to_string(header=False))


if __name__ == "__main__":
    main()