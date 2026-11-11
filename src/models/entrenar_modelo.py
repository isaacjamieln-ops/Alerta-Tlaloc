"""Aqui comienza el entrenamiento de un Random Forest por horizonte (7, 15 y 30 dias).

Qué hace? Desarrollo de Machine Learning:
  1. Predice el CAMBIO de volumen a h días como fracción de la capacidad de
     la presa (así las presas chicas y grandes pesan parecido); luego se
     convierte a hm3 y se suma a vol_hoy.
  2. Ajusta hiperparámetros SOLO con datos de entrenamiento, usando
     validación cronológica (TimeSeriesSplit). La partición 'prueba'
     nunca se toca aquí.
  3. Calibra un intervalo de incertidumbre por presa con los errores de los
     últimos meses de entrenamiento (tramo reservado, cronológico).
  4. Guarda modelo (.pkl) y metadatos (.json) por horizonte.

Uso:
    python entrenar_modelo.py            # con ajuste de hiperparámetros
    python entrenar_modelo.py --rapido   # sin ajuste (parámetros por defecto)
"""
import argparse
import json
from datetime import datetime

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit

import config as cfg

# Rejilla pequeña a proposito porque cada ajuste cuesta tiempo en CPU.
REJILLA = {
    "max_depth": [10, 15],
    "min_samples_leaf": [5, 20],
}
PARAMS_BASE = {"max_features": 0.5, "n_jobs": -1, "random_state": cfg.SEMILLA}
PARAMS_DEFECTO = {"max_depth": 15, "min_samples_leaf": 5}
NIVEL_INTERVALO = 0.90  # intervalo del 90 %
FRACCION_CALIBRACION = 0.15  # último 15 % cronológico del entrenamiento


def entrenar_horizonte(df, h: int, rapido: bool) -> None:
    print(f"\n=== Horizonte {h} días ===")
    features = cfg.columnas_features(df)
    train, _ = cfg.datos_horizonte(df, h)
    train = train.sort_values(["fecha", "clave_sih"], kind="stable")
    X, y = cfg.matriz_features(train, features), cfg.target_normalizado(train, h)
    n_presas = train["clave_sih"].nunique()
    print(f"Filas de entrenamiento: {len(train):,} | presas: {n_presas} | "
          f"variables: {len(features)}")

    # --- 1. Ajuste de hiperparametros con validacion cronologica ----------
    cv_mae = None
    if rapido:
        mejores = dict(PARAMS_DEFECTO)
        print(f"Modo rápido, parámetros: {mejores}")
    else:
        # gap evita que el objetivo (h dias adelante) de un pliegue de
        # entrenamiento se traslape con el pliegue de validacion.
        cv = TimeSeriesSplit(n_splits=3, gap=n_presas * h)
        gs = GridSearchCV(
            RandomForestRegressor(n_estimators=50, **PARAMS_BASE),
            REJILLA,
            cv=cv,
            scoring="neg_mean_absolute_error",
            n_jobs=1,
        )
        gs.fit(X, y)
        mejores = gs.best_params_
        cv_mae = float(-gs.best_score_)
        print(f"Mejores parámetros: {mejores} | MAE validación cronológica: "
              f"{cv_mae * 100:.2f} % de la capacidad")

    # --- 2. Calibracion del intervalo (cronologica, por presa) ------------
    fechas = np.sort(train["fecha"].unique())
    corte = fechas[int(len(fechas) * (1 - FRACCION_CALIBRACION))]
    # gap de h días entre los dos tramos para no traslapar objetivos
    corte_ent = corte - np.timedelta64(h, "D")
    ent_cal = train[train["fecha"] < corte_ent]
    cal = train[train["fecha"] >= corte]
    m_cal = RandomForestRegressor(n_estimators=100, **PARAMS_BASE, **mejores)
    m_cal.fit(cfg.matriz_features(ent_cal, features), cfg.target_normalizado(ent_cal, h))
    pred_cal = m_cal.predict(cfg.matriz_features(cal, features)) * cal["namo_hm3"].values
    resid = np.abs(cal[cfg.target_cambio(h)].values - pred_cal)  # en hm3
    cal = cal.assign(resid=resid)
    q_presa = {
        k: float(np.quantile(g["resid"], NIVEL_INTERVALO))
        for k, g in cal.groupby("clave_sih")
    }
    q_global = float(np.quantile(resid, NIVEL_INTERVALO))
    print(f"Calibración con {len(cal):,} filas desde {str(corte)[:10]}; "
          f"semi-ancho global (90 %): ±{q_global:.2f} hm3")

    # --- 3. Modelo final con TODO el entrenamiento ------------------------
    modelo = RandomForestRegressor(n_estimators=200, **PARAMS_BASE, **mejores)
    modelo.fit(X, y)

    cfg.DIR_MODELOS.mkdir(parents=True, exist_ok=True)
    ruta_modelo = cfg.DIR_MODELOS / f"modelo_cambio_{h}d.pkl"
    joblib.dump(modelo, ruta_modelo, compress=3)

    meta = {
        "horizonte_dias": h,
        "target": cfg.target_cambio(h),
        "normalizacion": "el modelo predice cambio/namo_hm3; variables de volumen "
                         "divididas entre namo_hm3; la salida se multiplica por namo_hm3",
        "features": features,
        "hiperparametros": {**mejores, "n_estimators": 200,
                            "max_features": PARAMS_BASE["max_features"]},
        "mae_validacion_cronologica_frac_capacidad": cv_mae,
        "nivel_intervalo": NIVEL_INTERVALO,
        "semiancho_intervalo_hm3_por_presa": q_presa,
        "semiancho_intervalo_hm3_global": q_global,
        "entrenado_con_filas": int(len(train)),
        "fecha_max_entrenamiento": str(train["fecha"].max().date()),
        "fecha_entrenamiento": datetime.now().isoformat(timespec="seconds"),
    }
    with open(cfg.DIR_MODELOS / f"meta_cambio_{h}d.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"Guardado: {ruta_modelo.name} + meta_cambio_{h}d.json")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rapido", action="store_true",
                    help="omite el ajuste de hiperparámetros")
    args = ap.parse_args()

    print(f"Cargando dataset desde: {cfg.RUTA_CSV}")
    df = cfg.cargar_datos()
    for h in cfg.HORIZONTES:
        entrenar_horizonte(df, h, args.rapido)
    print("\nEntrenamiento terminado. Siguiente paso: python evaluar_modelo.py")


if __name__ == "__main__":
    main()
