"""Evaluación del modelo de Validacion y mejora.

Compara, sobre el periodo de PRUEBA (el más reciente, nunca visto en el
entrenamiento), el Random Forest contra dos referencias:
  - Persistencia: el volumen futuro es igual al de hoy.
  - Tendencia: hoy + el cambio reciente (referencia más exigente).

Genera en reports/ml/:
  metricas_globales.csv, metricas_por_presa.csv, error_por_mes.csv,
  peores_errores.csv, importancia_variables.csv, graficas y
  resumen_evaluacion.md (análisis de errores y limitaciones).

Uso:  python evaluar_modelo.py
"""
import json

import joblib
import matplotlib

matplotlib.use("Agg") 
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error

import config as cfg


def tabla_md(df: pd.DataFrame) -> str:
    """Tabla en formato Markdown sin depender de la librería 'tabulate'."""
    cols = [str(c) for c in df.columns]
    filas = [[str(x) for x in fila] for fila in df.itertuples(index=False)]
    out = ["| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    out += ["| " + " | ".join(f) + " |" for f in filas]
    return "\n".join(out)


def pct_error(real: pd.Series, pred: pd.Series) -> float:
    """Error porcentual ponderado (WAPE): suma|error| / suma(real) * 100.

    Se usa en vez del MAPE fila por fila porque en presas con volúmenes muy
    bajos el MAPE se dispara y distorsiona el promedio.
    """
    return float(np.abs(real - pred).sum() / real.sum() * 100)


def metricas(real_vol, pred_vol, real_cambio, pred_cambio, namo) -> dict:
    mae = mean_absolute_error(real_vol, pred_vol)
    return {
        "MAE_hm3": mae,
        "RMSE_hm3": root_mean_squared_error(real_vol, pred_vol),
        "MAE_pct_capacidad": mae / namo * 100,
        "error_pct_volumen": pct_error(real_vol, pred_vol),
        "R2_cambio": r2_score(real_cambio, pred_cambio),
    }


def evaluar_horizonte(df, h):
    features = cfg.columnas_features(df)
    modelo = joblib.load(cfg.DIR_MODELOS / f"modelo_cambio_{h}d.pkl")
    with open(cfg.DIR_MODELOS / f"meta_cambio_{h}d.json", encoding="utf-8") as f:
        meta = json.load(f)
    assert meta["features"] == features, "Las variables del modelo no coinciden con config.py"

    _, test = cfg.datos_horizonte(df, h)
    test = test.copy()
    t_cambio, t_vol = cfg.target_cambio(h), cfg.target_volumen(h)

    # Predicciones
    cambio_rf = modelo.predict(cfg.matriz_features(test, features)) * test["namo_hm3"].values
    test["pred_rf"] = test["vol_hoy"] + cambio_rf
    test["pred_pers"] = cfg.baseline_persistencia(test, h)
    test["pred_tend"] = cfg.baseline_tendencia(test, h)
    test["cambio_rf"] = cambio_rf

    # Intervalo calibrado por presa (ver entrenar_modelo.py)
    q = test["clave_sih"].map(meta["semiancho_intervalo_hm3_por_presa"]).fillna(
        meta["semiancho_intervalo_hm3_global"])
    test["inf"], test["sup"] = test["pred_rf"] - q, test["pred_rf"] + q
    test["cubierto"] = (test[t_vol] >= test["inf"]) & (test[t_vol] <= test["sup"])
    test["err_rf"] = (test[t_vol] - test["pred_rf"]).abs()
    test["err_pers"] = (test[t_vol] - test["pred_pers"]).abs()

    filas_pres, filas_glob = [], []
    modelos = {"Random Forest": ("pred_rf", "cambio_rf"),
               "Persistencia": ("pred_pers", None),
               "Tendencia": ("pred_tend", None)}

    def calcular(g, etiqueta_presa):
        out = []
        for nombre, (col_vol, col_cambio) in modelos.items():
            pred_cambio = g[col_cambio] if col_cambio else g[col_vol] - g["vol_hoy"]
            r = metricas(g[t_vol], g[col_vol], g[t_cambio], pred_cambio, g["namo_hm3"].mean())
            r.update({"horizonte_dias": h, "presa": etiqueta_presa, "modelo": nombre,
                      "n": len(g)})
            if nombre == "Random Forest":
                r["cobertura_intervalo_90"] = g["cubierto"].mean() * 100
            out.append(r)
        return out

    filas_glob += calcular(test, "TODAS")
    for k, g in test.groupby("clave_sih"):
        filas_pres += calcular(g, k)

    return test, pd.DataFrame(filas_glob), pd.DataFrame(filas_pres), modelo, features


def graficar_presas(test, h, ruta):
    claves = sorted(test["clave_sih"].unique())
    t_vol = cfg.target_volumen(h)
    fig, axes = plt.subplots(3, 3, figsize=(18, 11))
    for ax, k in zip(axes.ravel(), claves):
        g = test[test["clave_sih"] == k].sort_values("fecha")
        ax.plot(g["fecha"], g[t_vol], color="#1f77b4", lw=1.3, label="Real")
        ax.plot(g["fecha"], g["pred_rf"], color="#2ca02c", ls="--", lw=1.1,
                label=f"Random Forest (MAE {g['err_rf'].mean():.1f})")
        ax.plot(g["fecha"], g["pred_pers"], color="#d62728", ls=":", lw=1,
                alpha=0.8, label=f"Persistencia (MAE {g['err_pers'].mean():.1f})")
        ax.fill_between(g["fecha"], g["inf"], g["sup"], color="#2ca02c", alpha=0.12,
                        label="Intervalo 90 %")
        ax.set_title(f"{k} (capacidad {g['namo_hm3'].iloc[0]:.0f} hm3)")
        ax.set_ylabel("Volumen (hm3)")
        ax.grid(True, ls=":", alpha=0.5)
        ax.tick_params(axis="x", rotation=30)
        ax.legend(fontsize=7, loc="best")
    for ax in axes.ravel()[len(claves):]:
        ax.axis("off")
    fig.suptitle(f"Alerta Tlaloc: volumen real vs predicho a {h} días (periodo de prueba)",
                 fontsize=14)
    fig.tight_layout()
    fig.savefig(ruta, dpi=150)
    plt.close(fig)


def main() -> None:
    cfg.DIR_REPORTES.mkdir(parents=True, exist_ok=True)
    df = cfg.cargar_datos()
    todos_glob, todos_pres, errores_mes, peores, por_anio = [], [], [], [], []
    importancias = {}

    for h in cfg.HORIZONTES:
        print(f"Evaluando horizonte {h} días...")
        test, glob, pres, modelo, features = evaluar_horizonte(df, h)
        todos_glob.append(glob)
        todos_pres.append(pres)
        importancias[h] = pd.Series(modelo.feature_importances_, index=features)

        m = test.assign(mes_obs=test["fecha"].dt.month)
        em = m.groupby("mes_obs").agg(MAE_rf=("err_rf", "mean"),
                                      MAE_persistencia=("err_pers", "mean"),
                                      n=("err_rf", "size")).reset_index()
        em.insert(0, "horizonte_dias", h)
        errores_mes.append(em)

        ea = test.assign(anio=test["fecha"].dt.year).groupby("anio").agg(
            MAE_rf=("err_rf", "mean"), MAE_persistencia=("err_pers", "mean"),
            n=("err_rf", "size")).reset_index()
        ea["mejora_vs_persistencia_pct"] = (
            100 * (ea["MAE_persistencia"] - ea["MAE_rf"]) / ea["MAE_persistencia"])
        ea.insert(0, "horizonte_dias", h)
        por_anio.append(ea)

        top = test.nlargest(10, "err_rf")[["fecha", "clave_sih", "vol_hoy",
                                           cfg.target_volumen(h), "pred_rf", "err_rf"]].copy()
        top["fecha"] = top["fecha"].dt.date
        top.insert(0, "horizonte_dias", h)
        peores.append(top)

        graficar_presas(test, h, cfg.DIR_REPORTES / f"grafica_presas_{h}d.png")

    glob = pd.concat(todos_glob, ignore_index=True)
    pres = pd.concat(todos_pres, ignore_index=True)
    em = pd.concat(errores_mes, ignore_index=True)
    pe = pd.concat(peores, ignore_index=True)
    pa = pd.concat(por_anio, ignore_index=True)
    imp = pd.DataFrame(importancias).sort_values(7, ascending=False)
    imp.columns = [f"importancia_{h}d" for h in imp.columns]

    glob.round(4).to_csv(cfg.DIR_REPORTES / "metricas_globales.csv", index=False)
    pres.round(4).to_csv(cfg.DIR_REPORTES / "metricas_por_presa.csv", index=False)
    em.round(3).to_csv(cfg.DIR_REPORTES / "error_por_mes.csv", index=False)
    pe.round(3).to_csv(cfg.DIR_REPORTES / "peores_errores.csv", index=False)
    pa.round(3).to_csv(cfg.DIR_REPORTES / "metricas_por_anio.csv", index=False)
    imp.round(4).to_csv(cfg.DIR_REPORTES / "importancia_variables.csv")

    # Gráfica de importancia de variables (horizonte 7 d)
    fig, ax = plt.subplots(figsize=(8, 6))
    imp["importancia_7d"].sort_values().plot.barh(ax=ax, color="#2ca02c")
    ax.set_title("Importancia de variables, Random Forest (7 días)")
    fig.tight_layout()
    fig.savefig(cfg.DIR_REPORTES / "importancia_variables_7d.png", dpi=150)
    plt.close(fig)

    escribir_resumen(glob, pres, em, pa)
    print(f"\nListo. Resultados en: {cfg.DIR_REPORTES}")


def escribir_resumen(glob, pres, em, pa) -> None:
    L = ["# Resumen de evaluación (periodo de prueba)\n"]
    L.append("Métricas globales (todas las presas juntas). MAE y RMSE en hm3; "
             "el MAE global está dominado por las presas grandes, por eso se "
             "reporta también por presa y como % de la capacidad.\n")
    cols = ["horizonte_dias", "modelo", "MAE_hm3", "RMSE_hm3", "MAE_pct_capacidad",
            "error_pct_volumen", "R2_cambio", "cobertura_intervalo_90"]
    L.append(tabla_md(glob[cols].round(3)))

    L.append("\n\n## Mejora del Random Forest frente a las referencias (MAE global)\n")
    for h in cfg.HORIZONTES:
        g = glob[glob["horizonte_dias"] == h].set_index("modelo")["MAE_hm3"]
        L.append(f"- {h} días: {100*(g['Persistencia']-g['Random Forest'])/g['Persistencia']:.1f} % "
                 f"mejor que persistencia y "
                 f"{100*(g['Tendencia']-g['Random Forest'])/g['Tendencia']:.1f} % mejor que tendencia.")

    L.append("\n\n## Presas donde el Random Forest NO supera a una referencia\n")
    hay = False
    for h in cfg.HORIZONTES:
        p = pres[pres["horizonte_dias"] == h].pivot(index="presa", columns="modelo",
                                                    values="MAE_hm3")
        for presa, r in p.iterrows():
            peor = [n for n in ("Persistencia", "Tendencia") if r["Random Forest"] > r[n]]
            if peor:
                hay = True
                L.append(f"- {presa} a {h} días: RF {r['Random Forest']:.3f} hm3 vs "
                         + ", ".join(f"{n} {r[n]:.3f}" for n in peor) + ".")
    if not hay:
        L.append("- Ninguna.")

    L.append("\n\n## Cobertura del intervalo del 90 % (por presa, 7 días)\n")
    c = pres[(pres["horizonte_dias"] == 7) & (pres["modelo"] == "Random Forest")]
    for _, r in c.iterrows():
        L.append(f"- {r['presa']}: {r['cobertura_intervalo_90']:.1f} %")
    L.append("\nSi la cobertura es muy distinta de 90 %, el intervalo NO está "
             "bien calibrado para ese periodo y la app debe presentarlo como "
             "aproximado (el régimen hidrológico del periodo de prueba puede "
             "diferir del de calibración).")

    L.append("\n\n## Error por mes (7 días, hm3)\n")
    e7 = em[em["horizonte_dias"] == 7].sort_values("MAE_rf", ascending=False)
    L.append(tabla_md(e7[["mes_obs", "MAE_rf", "MAE_persistencia", "n"]].round(2)))
    L.append("\n\nLos meses con mayor error suelen coincidir con la temporada de "
             "lluvias y el inicio del llenado, cuando los cambios son bruscos.")

    L.append("\n\n## Estabilidad por año (mejora del Random Forest vs persistencia, MAE global)\n")
    L.append("Como solo hay una partición de prueba (2020-06 a 2026-10), se revisa "
             "que la ventaja no dependa de un año en particular. 2020 y 2026 son años parciales.\n")
    piv = pa.pivot(index="anio", columns="horizonte_dias", values="mejora_vs_persistencia_pct").round(1)
    piv.columns = [f"{c} días (%)" for c in piv.columns]
    L.append(tabla_md(piv.reset_index()))
    peor = pa[pa["mejora_vs_persistencia_pct"] <= 0]
    L.append("\n\nAños/horizontes donde el RF no supera a persistencia: "
             + (", ".join(f"{int(r.anio)} ({int(r.horizonte_dias)} d)" for r in peor.itertuples())
                if len(peor) else "ninguno."))

    L.append("\n\n## Limitaciones\n")
    L += [
        "- Un solo modelo para 9 presas de tamaños muy distintos; se normaliza por capacidad, pero el error absoluto en hm3 sigue dominado por las presas grandes (p. ej. INFMC).",
        "- Lluvia: se usa precipitación observada (no pronóstico), por lo que el modelo no anticipa tormentas futuras.",
        "- No se modelan extracciones ni aportaciones de forma explícita.",
        "- Los eventos extremos (ciclones, apertura de compuertas) están poco representados y generan los mayores errores.",
        "- Una sola partición cronológica de prueba y 3 pliegues de validación; la estabilidad por año se reporta arriba como verificación adicional.",
        "- El intervalo se calibra con un tramo reciente de entrenamiento; puede no cubrir bien periodos con comportamiento distinto.",
        "- Es una herramienta de apoyo a la decisión, no un sistema certificado de seguridad de presas.",
    ]
    (cfg.DIR_REPORTES / "resumen_evaluacion.md").write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    main()