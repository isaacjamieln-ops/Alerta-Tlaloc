"""Configuración compartida del módulo de Machine Learning (PresaIA).

Todos los scripts (entrenar, evaluar, inferir) importan de aquí para que
las columnas, rutas y horizontes sean EXACTAMENTE los mismos en todos lados.
"""
import sys
from pathlib import Path

import pandas as pd

# Evita caracteres rotos en cmd
for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace")


BASE_DIR = Path(__file__).resolve().parent.parent.parent

# El CSV se busca en varias rutas posibles para que funcione tanto en desarrollo como en produccion
_CANDIDATOS_CSV = [
    BASE_DIR / "dataset" / "modelado_completo.csv",
    BASE_DIR / "data" / "datasets" / "full" / "modelado_completo.csv",
]
RUTA_CSV = next((p for p in _CANDIDATOS_CSV if p.exists()), _CANDIDATOS_CSV[0])
DIR_MODELOS = BASE_DIR / "src" / "models"
DIR_REPORTES = BASE_DIR / "reports" / "ml"


# Parametros del experimento
HORIZONTES = [7, 15, 30]  # dias
SEMILLA = 42

# Qué columnas NO son variables de entrada.
#  - Identificadores / partición: no son información predictiva.
#  - obj_*: son los objetivos (usarlos sería fuga de datos).
#  - vol_hoy: volumen absoluto; el modelo predice el CAMBIO y luego se suma a
#    vol_hoy. No es fuga (se conoce el día de la predicción y es recuperable
#    como vol_lag_1 + cambio_1d); se excluye como entrada directa para que el
#    modelo trabaje con variables relativas a la capacidad.
#  - llenado_pct SÍ es entrada: es el nivel de llenado relativo (0-100 %),
#    útil porque una presa casi llena no puede subir mucho más.
COLS_EXCLUIDAS = [
    "fecha",
    "clave_sih",
    "particion",
    "vol_hoy",
    "obj_vol_7d",
    "obj_cambio_7d",
    "obj_vol_15d",
    "obj_cambio_15d",
    "obj_vol_30d",
    "obj_cambio_30d",
]

# Variables en hm3 que se dividen entre la capacidad (namo_hm3) para que
# presas de tamaños muy distintos (10 hm3 vs 9,340 hm3) sean comparables.
COLS_VOLUMEN_ABS = [
    "vol_lag_1", "cambio_1d", "vol_lag_7", "cambio_7d",
    "vol_lag_14", "cambio_14d", "vol_lag_30", "cambio_30d",
]


def target_cambio(h: int) -> str:
    return f"obj_cambio_{h}d"


def target_volumen(h: int) -> str:
    return f"obj_vol_{h}d"


def matriz_features(df: pd.DataFrame, features: list[str]) -> pd.DataFrame:
    """Variables de entrada del modelo: volúmenes expresados como fracción de
    la capacidad de cada presa (el resto de variables queda igual)."""
    X = df[features].copy()
    for c in COLS_VOLUMEN_ABS:
        if c in X.columns:
            X[c] = df[c] / df["namo_hm3"]
    return X


def target_normalizado(df: pd.DataFrame, h: int) -> pd.Series:
    """Objetivo de entrenamiento: cambio de volumen / capacidad."""
    return df[target_cambio(h)] / df["namo_hm3"]


def cargar_datos() -> pd.DataFrame:
    """Carga el CSV, convierte la fecha y ordena cronológicamente."""
    if not RUTA_CSV.exists():
        raise FileNotFoundError(
            "No se encontró modelado_completo.csv. Se buscó en:\n  "
            + "\n  ".join(str(p) for p in _CANDIDATOS_CSV))
    df = pd.read_csv(RUTA_CSV, parse_dates=["fecha"])
    return df.sort_values(["fecha", "clave_sih"], kind="stable").reset_index(drop=True)


def columnas_features(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in COLS_EXCLUIDAS]


def datos_horizonte(df: pd.DataFrame, h: int):
    """Devuelve (entrenamiento, prueba) sin nulos en el objetivo del horizonte.

    La partición 'embargo' queda fuera de ambos conjuntos a propósito: es un
    colchón de ~30 días entre entrenamiento y prueba para que los objetivos
    de las últimas filas de entrenamiento no se traslapen con la prueba.
    """
    d = df.dropna(subset=[target_cambio(h)])
    return (
        d[d["particion"] == "entrenamiento"].copy(),
        d[d["particion"] == "prueba"].copy(),
    )



# Modelos de referencia (baselines)
def baseline_persistencia(df: pd.DataFrame, h: int) -> pd.Series:
    """El volumen futuro será igual al de hoy (lo que pide el PDF)."""
    return df["vol_hoy"]


def baseline_tendencia(df: pd.DataFrame, h: int) -> pd.Series:
    """Referencia más exigente: se repite la tendencia reciente.

    Volumen de hoy + cambio observado en una ventana comparable al horizonte.
    """
    cambio_ref = {
        7: df["cambio_7d"],
        15: df["cambio_14d"] * 15 / 14,
        30: df["cambio_30d"],
    }[h]
    return df["vol_hoy"] + cambio_ref