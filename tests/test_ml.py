"""Pruebas funcionales y de manejo de errores del módulo de ML.

Ejecutar desde la raíz del proyecto:   pytest -v
(requiere haber entrenado los modelos: python src/models/entrenar_modelo.py)
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.metrics import mean_absolute_error

RAIZ = Path(__file__).resolve().parent.parent
for _sub in ("models", "ml"):  # carpeta donde estén los scripts de ML
    if (RAIZ / "src" / _sub / "config.py").exists():
        sys.path.insert(0, str(RAIZ / "src" / _sub))
        break

import config as cfg  # noqa: E402
from inferir import cargar_artefactos, predecir  # noqa: E402


@pytest.fixture(scope="module")
def df():
    return cfg.cargar_datos()


@pytest.fixture(scope="module")
def art():
    return cargar_artefactos()


@pytest.fixture(scope="module")
def presa(df):
    return sorted(df["clave_sih"].unique())[0]


# ---------------------------------------------------------------- datos
def test_particion_cronologica_sin_traslape(df):
    """Entrenamiento < embargo < prueba, y el objetivo de 30 días del último
    día de entrenamiento no invade la prueba."""
    f_ent = df.loc[df["particion"] == "entrenamiento", "fecha"]
    f_pru = df.loc[df["particion"] == "prueba", "fecha"]
    assert f_ent.max() < f_pru.min()
    assert f_ent.max() + pd.Timedelta(days=max(cfg.HORIZONTES)) <= f_pru.min()


def test_sin_duplicados_fecha_presa(df):
    assert not df.duplicated(["fecha", "clave_sih"]).any()


def test_objetivos_consistentes(df):
    for h in cfg.HORIZONTES:
        d = df.dropna(subset=[cfg.target_cambio(h)])
        diff = (d["vol_hoy"] + d[cfg.target_cambio(h)] - d[cfg.target_volumen(h)]).abs()
        assert diff.max() < 1e-6


def test_variables_sin_fuga(df):
    feats = cfg.columnas_features(df)
    assert not [c for c in feats if c.startswith("obj_")]
    assert "vol_hoy" not in feats
    assert "particion" not in feats and "fecha" not in feats


def test_variables_coinciden_con_modelos(df, art):
    for h, a in art.items():
        assert a["meta"]["features"] == cfg.columnas_features(df)


# ---------------------------------------------------------------- predicción
def test_prediccion_normal(df, art, presa):
    r = predecir(df, presa, artefactos=art)
    assert set(r["predicciones"]) == set(cfg.HORIZONTES)
    for h, p in r["predicciones"].items():
        lo, hi = p["intervalo_90_hm3"]
        assert lo < p["volumen_hm3"] < hi
        assert np.isfinite(p["volumen_hm3"]) and np.isfinite(p["llenado_pct"])
        assert p["volumen_hm3"] == pytest.approx(r["volumen_actual_hm3"] + p["cambio_hm3"])


def test_prediccion_con_fecha_especifica(df, art, presa):
    fecha = df[df["clave_sih"] == presa]["fecha"].iloc[-100]
    r = predecir(df, presa, fecha=fecha, artefactos=art)
    assert r["fecha_base"] == fecha.date().isoformat()


def test_presa_inexistente(df, art):
    with pytest.raises(ValueError, match="no encontrada"):
        predecir(df, "XXXXX", artefactos=art)


def test_fecha_sin_observacion(df, art, presa):
    with pytest.raises(ValueError, match="No hay observación"):
        predecir(df, presa, fecha="1900-01-01", artefactos=art)


def test_datos_de_entrada_nulos(df, art, presa):
    d = df.copy()
    idx = d[d["clave_sih"] == presa].sort_values("fecha").index[-1]
    d.loc[idx, "cambio_1d"] = np.nan
    with pytest.raises(ValueError, match="Faltan datos"):
        predecir(d, presa, artefactos=art)


# ---------------------------------------------------------------- calidad
@pytest.mark.parametrize("h", cfg.HORIZONTES)
def test_modelo_supera_persistencia_en_prueba(df, art, h):
    _, te = cfg.datos_horizonte(df, h)
    feats = art[h]["meta"]["features"]
    cambio = art[h]["modelo"].predict(cfg.matriz_features(te, feats)) * te["namo_hm3"].values
    mae_rf = mean_absolute_error(te[cfg.target_volumen(h)], te["vol_hoy"] + cambio)
    mae_pers = mean_absolute_error(te[cfg.target_volumen(h)], te["vol_hoy"])
    assert mae_rf < mae_pers