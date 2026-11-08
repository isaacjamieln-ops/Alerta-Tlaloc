#!/usr/bin/env python3
"""
Analisis exploratorio (EDA) de las presas ya limpias.

Lee TODOS los CSV <CLAVE>_limpio.csv de una carpeta (o los archivos / carpetas
que indiques) y por cada presa genera 6 graficas PNG y 5 tablas CSV. Al final
guarda una tabla comparativa de todas las presas.

Carpetas (rutas relativas a la raiz del proyecto = carpeta que contiene src/)
  Entrada : se busca la primera de data/clean que contenga *_limpio.csv
            (cambia CANDIDATAS_ENTRADA abajo, o usa --entrada / argumentos)
  Salida  : data/reports/eda/<CLAVE>/   y   data/reports/eda/comparacion_presas.csv

Graficas
  01_serie_completa     volumen diario con NAMINO / NAMO / NAME
  02_estacionalidad     perfil por mes del anio (mediana, banda p25-p75, cada anio en gris)
  03_rango_anual        minimo-maximo del llenado (%) por anio: anios secos y humedos
  04_lluvia_mensual     lluvia acumulada media por mes
  05_lluvia_vs_volumen  correlacion entre lluvia (t-k) y cambio diario de volumen
  06_cambios_horizonte  distribucion del cambio de volumen a 7, 15 y 30 dias

Tablas por presa
  anual.csv, mensual.csv, cambios_percentiles.csv, persistencia.csv, resumen.csv

La referencia de "persistencia" (manana = hoy) es el modelo a vencer en la Fase 4.

Uso:
  python src/data/eda_presa.py                          # todas las presas de la carpeta de entrada
  python src/data/eda_presa.py data/clean               # todas las de otra carpeta
  python src/data/eda_presa.py data/clean/LBQCH_limpio.csv data/clean/CCHNL_limpio.csv
  python src/data/eda_presa.py --salida otra/carpeta
"""
import argparse
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# ---------------------------------------------------------------- rutas
RAIZ = Path(__file__).resolve().parents[2]          # carpeta que contiene src/
CANDIDATAS_ENTRADA = ["data/clean"]
SALIDA_DEFECTO = RAIZ / "data" / "reports" / "eda"
PATRON = "*_limpio.csv"

# ---------------------------------------------------------------- parametros
VOL, NIV, LLU = "VolumenAlm(Mm3)", "Nivel(m)", "Precipitacion(mm)"
HORIZONTES = (7, 15, 30)
CORTE_PRUEBA = 0.20          # ultimo 20 % de la serie, orden cronologico
MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

# Paleta de referencia (modo claro): ranuras 1 y 2 + tintas de texto
AZUL, NARANJA = "#2a78d6", "#eb6834"
TINTA, TINTA2, GRIS = "#0b0b0b", "#52514e", "#c9c8c3"
SUPERFICIE = "#fcfcfb"

plt.rcParams.update({
    "figure.facecolor": SUPERFICIE, "axes.facecolor": SUPERFICIE,
    "axes.edgecolor": GRIS, "axes.labelcolor": TINTA2, "axes.titlecolor": TINTA,
    "axes.titlesize": 13, "axes.titleweight": "bold", "axes.titlelocation": "left",
    "axes.spines.top": False, "axes.spines.right": False,
    "xtick.color": TINTA2, "ytick.color": TINTA2,
    "grid.color": "#ecebe7", "grid.linewidth": 0.8, "axes.grid": True,
    "axes.axisbelow": True, "font.size": 10, "savefig.dpi": 150,
    "savefig.bbox": "tight", "savefig.facecolor": SUPERFICIE,
})


# ---------------------------------------------------------------- 
# Entradas
# ---------------------------------------------------------------- 
def carpeta_entrada_por_defecto():
    for c in CANDIDATAS_ENTRADA:
        carpeta = RAIZ / c
        if carpeta.is_dir() and any(carpeta.glob(PATRON)):
            return carpeta
    buscadas = "\n".join(f"  - {RAIZ / c}" for c in CANDIDATAS_ENTRADA)
    raise SystemExit(f"No encontre archivos {PATRON}. Busque en:\n{buscadas}\n"
                     "Indica la carpeta: python src/data/eda_presa.py ruta/a/la/carpeta")


def listar_csv(entradas):
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
    return csvs


def guardar(fig, carpeta, nombre):
    fig.savefig(carpeta / f"{nombre}.png")
    plt.close(fig)


def cargar(ruta):
    d = pd.read_csv(ruta, encoding="utf-8-sig", parse_dates=["Fecha"]).set_index("Fecha").sort_index()
    meta = {k: float(d[k].iloc[0]) for k in ("name_hm3", "namo_hm3", "namino_hm3")}
    return d, meta, str(d["Estacion"].iloc[0])


# ---------------------------------------------------------------- 
# Graficas
# ---------------------------------------------------------------- 
def g_serie(d, m, clave, car):
    fig, ax = plt.subplots(figsize=(11, 4.2))
    ax.plot(d.index, d[VOL], color=AZUL, lw=1.1)
    for k, txt in (("name_hm3", "NAME"), ("namo_hm3", "NAMO"), ("namino_hm3", "NAMINO")):
        ax.axhline(m[k], color=TINTA2, lw=0.9, ls=(0, (4, 3)))
        ax.text(d.index[0], m[k], f" {txt} {m[k]:,.0f}", va="bottom", color=TINTA2, fontsize=9)
    ax.set_ylabel("Volumen almacenado (Mm³)")
    ax.set_title(f"{clave}: volumen diario {d.index.min().year}-{d.index.max().year}")
    ax.margins(x=0.01)
    guardar(fig, car, "01_serie_completa")


def g_estacional(d, m, clave, car):
    pct = d[VOL] / m["namo_hm3"] * 100
    tabla = pct.groupby([d.index.year, d.index.month]).mean().unstack()
    fig, ax = plt.subplots(figsize=(8.5, 4.6))
    x = np.arange(1, 13)
    for _, fila in tabla.iterrows():
        ax.plot(x, fila.reindex(x), color=GRIS, lw=0.8)
    q25, med, q75 = (tabla.quantile(q) for q in (0.25, 0.5, 0.75))
    ax.fill_between(x, q25, q75, color=AZUL, alpha=0.18, lw=0)
    ax.plot(x, med, color=AZUL, lw=2.2, marker="o", ms=5, mfc=SUPERFICIE, mew=1.8)
    ax.text(12.1, med.iloc[-1], "mediana", color=TINTA2, va="center", fontsize=9)
    ax.text(12.1, tabla.iloc[:, -1].max(), "cada año", color=TINTA2, va="center", fontsize=9)
    ax.set_xticks(x, MESES)
    ax.set_xlim(0.8, 13)
    ax.set_ylabel("Llenado respecto al NAMO (%)")
    ax.set_title(f"{clave}: ciclo anual del almacenamiento")
    guardar(fig, car, "02_estacionalidad")
    return pd.DataFrame({"mes": MESES, "p25": q25.values, "mediana": med.values,
                         "p75": q75.values}).round(1)


def g_anual(d, m, clave, car):
    pct = d[VOL] / m["namo_hm3"] * 100
    a = pct.groupby(d.index.year).agg(["min", "max", "mean"])
    fig, ax = plt.subplots(figsize=(11, 4.2))
    ax.bar(a.index, a["max"] - a["min"], bottom=a["min"], width=0.6, color=AZUL,
           zorder=3, linewidth=0)
    ax.plot(a.index, a["mean"], ls="none", marker="o", ms=4, color=NARANJA,
            mec=SUPERFICIE, mew=1, zorder=4)
    ax.axhline(100, color=TINTA2, lw=0.9, ls=(0, (4, 3)))
    ax.text(a.index.min() - 0.4, 100, "NAMO", va="bottom", color=TINTA2, fontsize=9)
    ax.set_ylabel("Llenado respecto al NAMO (%)")
    ax.set_title(f"{clave}: rango anual del llenado (barra = mín-máx, punto = media)")
    ax.set_xlim(a.index.min() - 0.8, a.index.max() + 0.8)
    guardar(fig, car, "03_rango_anual")
    a = a.rename(columns={"min": "llenado_min_pct", "max": "llenado_max_pct",
                          "mean": "llenado_medio_pct"}).round(1)
    a["lluvia_total_mm"] = d[LLU].groupby(d.index.year).sum().round(0)
    a["dias"] = d.groupby(d.index.year).size()
    return a


def g_lluvia_mensual(d, clave, car):
    anios = d.index.year.nunique()
    mm = d[LLU].groupby(d.index.month).sum() / anios
    fig, ax = plt.subplots(figsize=(8.5, 4))
    ax.bar(MESES, mm.values, color=AZUL, width=0.6, zorder=3)
    ax.set_ylabel("Lluvia acumulada media (mm/mes)")
    ax.set_title(f"{clave}: lluvia mensual en la estación")
    guardar(fig, car, "04_lluvia_mensual")
    return mm.round(1)


def g_lluvia_vs_volumen(d, clave, car):
    dv = d[VOL].diff()
    lags = np.arange(0, 31)
    r = pd.Series([dv.corr(d[LLU].shift(k)) for k in lags], index=lags)
    fig, ax = plt.subplots(figsize=(8.5, 4))
    ax.bar(lags, r.values, color=AZUL, width=0.7, zorder=3)
    ax.axhline(0, color=TINTA2, lw=0.8)
    ax.set_xlabel("Rezago k (días): lluvia de hace k días")
    ax.set_ylabel("Correlación con el cambio diario de volumen")
    ax.set_title(f"{clave}: ¿cuánto tarda la lluvia en reflejarse?")
    guardar(fig, car, "05_lluvia_vs_volumen")
    return r


def g_cambios(d, m, clave, car):
    v = d[VOL]
    fig, ejes = plt.subplots(1, 3, figsize=(11, 3.8), sharey=False)
    filas = []
    for ax, h in zip(ejes, HORIZONTES):
        c = (v.shift(-h) - v).dropna()
        ax.hist(c, bins=60, color=AZUL, zorder=3)
        ax.axvline(0, color=TINTA2, lw=0.8)
        ax.set_yscale("log")
        ax.set_title(f"a {h} días", fontsize=11)
        ax.set_xlabel("Cambio (Mm³)")
        for q in (0.01, 0.05, 0.5, 0.95, 0.99):
            filas.append({"horizonte_dias": h, "percentil": int(q * 100),
                          "cambio_Mm3": round(c.quantile(q), 1),
                          "cambio_pct_NAMO": round(c.quantile(q) / m["namo_hm3"] * 100, 2)})
    ejes[0].set_ylabel("Días (escala log)")
    fig.suptitle(f"{clave}: cambio de volumen a 7, 15 y 30 días", x=0.01, y=1.06,
                 ha="left", fontweight="bold", fontsize=13)
    guardar(fig, car, "06_cambios_horizonte")
    return pd.DataFrame(filas)


def persistencia(d, namo):
    """Error de la referencia 'dentro de h dias = hoy' (el modelo a vencer)."""
    v = d[VOL]
    corte = d.index[int(len(d) * (1 - CORTE_PRUEBA))]
    filas = []
    for h in HORIZONTES:
        e = (v.shift(-h) - v).dropna().abs()
        p = e[e.index >= corte]
        filas.append({"horizonte_dias": h, "MAE_Mm3_toda_la_serie": round(e.mean(), 1),
                      "MAE_Mm3_periodo_prueba": round(p.mean(), 1),
                      "RMSE_Mm3_periodo_prueba": round(float(np.sqrt((p ** 2).mean())), 1),
                      "MAE_pct_NAMO_prueba": round(p.mean() / namo * 100, 2),
                      "inicio_periodo_prueba": corte.date()})
    return pd.DataFrame(filas)


# ---------------------------------------------------------------- 
# Una presa
# ---------------------------------------------------------------- 
def analizar(ruta, salida):
    d, m, clave = cargar(ruta)
    car = salida / clave
    car.mkdir(parents=True, exist_ok=True)

    g_serie(d, m, clave, car)
    mensual = g_estacional(d, m, clave, car)
    anual = g_anual(d, m, clave, car)
    lluvia_mes = g_lluvia_mensual(d, clave, car)
    r = g_lluvia_vs_volumen(d, clave, car)
    pcts = g_cambios(d, m, clave, car)
    pers = persistencia(d, m["namo_hm3"])

    mensual["lluvia_media_mm"] = lluvia_mes.values
    mensual.to_csv(car / "mensual.csv", index=False)
    anual.to_csv(car / "anual.csv")
    pcts.to_csv(car / "cambios_percentiles.csv", index=False)
    pers.to_csv(car / "persistencia.csv", index=False)

    pct = d[VOL] / m["namo_hm3"] * 100
    resumen = pd.Series({
        "clave": clave, "desde": d.index.min().date(), "hasta": d.index.max().date(),
        "dias": len(d), "volumen_min_Mm3": d[VOL].min(), "volumen_max_Mm3": d[VOL].max(),
        "volumen_actual_Mm3": d[VOL].iloc[-1], "llenado_actual_pct_NAMO": pct.iloc[-1].round(1),
        "dias_sobre_NAMO_pct": round((pct > 100).mean() * 100, 2),
        "dias_bajo_30pct_NAMO_pct": round((pct < 30).mean() * 100, 2),
        "dias_con_derrame": int((d["Derrame(m3/s)"] > 0).sum()),
        "dias_lluvia_cero_pct": round((d[LLU] == 0).mean() * 100, 1),
        "corr_lluvia_vs_cambio_mejor_rezago": f"k={int(r.idxmax())} (r={r.max():.2f})",
        "corr_nivel_volumen": round(d[NIV].corr(d[VOL]), 4),
    })
    resumen.to_csv(car / "resumen.csv", header=["valor"])

    p = pers.set_index("horizonte_dias")["MAE_pct_NAMO_prueba"]
    return {"presa": clave, "desde": resumen["desde"], "hasta": resumen["hasta"],
            "llenado_actual_pct_NAMO": resumen["llenado_actual_pct_NAMO"],
            "dias_bajo_30pct_NAMO_pct": resumen["dias_bajo_30pct_NAMO_pct"],
            "dias_con_derrame": resumen["dias_con_derrame"],
            "MAE7_pct_NAMO": p[7], "MAE15_pct_NAMO": p[15], "MAE30_pct_NAMO": p[30]}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entrada", nargs="*", type=Path,
                    help="carpeta(s) o archivo(s) *_limpio.csv (default: se detecta)")
    ap.add_argument("--salida", type=Path, default=SALIDA_DEFECTO)
    a = ap.parse_args()

    csvs = listar_csv(a.entrada)
    a.salida.mkdir(parents=True, exist_ok=True)
    print(f"{len(csvs)} presa(s) -> {a.salida}\n")

    filas, fallos = [], []
    for ruta in csvs:
        try:
            filas.append(analizar(ruta, a.salida))
            print(f"  ok     {ruta.name}")
        except Exception as e:                      # una presa mala no detiene a las demas
            fallos.append((ruta.name, e))
            print(f"  FALLO  {ruta.name}: {type(e).__name__}: {e}", file=sys.stderr)

    if filas:
        comp = pd.DataFrame(filas)
        comp.to_csv(a.salida / "comparacion_presas.csv", index=False)
        print("\nComparacion (error de la referencia de persistencia, % del NAMO):")
        print(comp.to_string(index=False))
    print(f"\nSalidas en {a.salida}/")
    if fallos:
        sys.exit(1)


if __name__ == "__main__":
    main()