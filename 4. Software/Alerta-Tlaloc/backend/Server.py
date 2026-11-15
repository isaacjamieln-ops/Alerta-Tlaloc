from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from typing import Optional
import time
import pandas as pd
from backend.models.src.models.inferir import cargar_artefactos, predecir
#import Alerta-Tlaloc.backend.models.src.models.config as cfg
import backend.models.src.models.config as cfg

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------
app = FastAPI(title="Alerta Tláloc - Backend Oficial")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Mongo
# ---------------------------------------------------------------------------
MONGO_URI = "mongodb+srv://montstomelin_db_user:pOvfkLlnt2HUy2bt@cluster0.qtibroo.mongodb.net/"
client = AsyncIOMotorClient(MONGO_URI)
db = client.alerta_tlaloc_db_P
collection_hidro = db.Data
collection_predic = db.Predicciones


import traceback

ARTEFACTOS_ML = {}

try:
    print("[INFO] Cargando modelos predictivos...")

    ARTEFACTOS_ML = cargar_artefactos()

    print("[OK] Modelos cargados correctamente.")
    print("[INFO] Horizontes disponibles:", list(ARTEFACTOS_ML.keys()))

except Exception as e:
    print("[ERROR] No se pudieron cargar los modelos.")
    print("[ERROR] Motivo:", str(e))
    traceback.print_exc()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _normalize_date_field(field: str = "fecha"):
    """
    Devuelve una expresión de agregación que convierte `field` a Date
    sin importar si en Mongo está guardado como datetime o como string ISO.
    """
    return {
        "$convert": {
            "input": f"${field}",
            "to": "date",
            "onError": None,
            "onNull": None,
        }
    }


def _range_match(fecha_inicio: Optional[datetime], fecha_fin: Optional[datetime],
                 clave_sih: Optional[str] = None) -> dict:
    """
    Construye el $match. Filtra por rango de fechas usando una expresión
    que tolera datetime o string en el campo `fecha`.
    """
    match: dict = {}
    if clave_sih:
        match["clave_sih"] = clave_sih

    conditions = []
    if fecha_inicio or fecha_fin:
        date_expr = _normalize_date_field("fecha")
        rng = {}
        if fecha_inicio:
            rng["$gte"] = fecha_inicio
        if fecha_fin:
            rng["$lte"] = fecha_fin
        # Comparamos la fecha normalizada con los límites proporcionados.
        conditions = [{
            "$expr": {
                "$and": [
                    {"$ne": [date_expr, None]},
                    *(
                        [{"$gte": [date_expr, fecha_inicio]}] if fecha_inicio else []
                    ),
                    *(
                        [{"$lte": [date_expr, fecha_fin]}] if fecha_fin else []
                    ),
                ]
            }
        }]

    if conditions:
        match["$and"] = conditions
    return match


def _sort_stage():
    """Ordena por fecha normalizada ascendente antes de agrupar."""
    return {"$sort": {"_fecha_norm": 1}}


def _add_norm_date_stage():
    return {"$addFields": {"_fecha_norm": _normalize_date_field("fecha")}}


# ---------------------------------------------------------------------------
# Cache TTL sencillo (en memoria). Para producción usa redis o fastapi-cache.
# ---------------------------------------------------------------------------
_CACHE: dict = {}
_CACHE_TTL = 60  # segundos


def _cache_get(key: str):
    item = _CACHE.get(key)
    if item and (time.time() - item["ts"] < _CACHE_TTL):
        return item["data"]
    return None


def _cache_set(key: str, data):
    _CACHE[key] = {"ts": time.time(), "data": data}



# ---------------------------------------------------------------------------
# Startup: crea índices (idempotente)
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def _ensure_indexes():
    try:
        await collection_hidro.create_index([("clave_sih", 1), ("fecha", -1)])
        await collection_hidro.create_index([("fecha", 1)])
        await collection_hidro.create_index([("lluvia_1d", 1), ("fecha", -1)])
    except Exception as e:
        # No tumbamos la app si falla un índice (p. ej. permisos)
        print(f"[warn] No se pudieron crear índices: {e}")



async def _get_latest_date_in_db() -> datetime:
    """Busca la fecha más reciente (máxima) en la colección para usarla como 'hoy'."""
    pipeline = [
        _add_norm_date_stage(),
        {"$sort": {"_fecha_norm": -1}},
        {"$limit": 1}
    ]
    result = await collection_hidro.aggregate(pipeline).to_list(length=1)
    if result and result[0].get("_fecha_norm"):
        dt = result[0]["_fecha_norm"]
        # Asegurar que tenga timezone si es necesario
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# 1. /api/consumo  -> series por presa en un rango
# ---------------------------------------------------------------------------
@app.get("/api/consumo")
async def get_consumption(
    fecha_inicio: Optional[datetime] = Query(None, description="ISO 8601"),
    fecha_fin: Optional[datetime] = Query(None, description="ISO 8601"),
    dias: Optional[int] = Query(None, description="Número de días hacia atrás desde la fecha más reciente"),
    clave_sih: Optional[str] = Query(None, description="Opcional: una presa"),
):
    try:
        # Si no se mandan fechas pero se especifica un número de días o por defecto
        if not fecha_fin:
            fecha_fin = await _get_latest_date_in_db()
        
        if not fecha_inicio:
            # Si mandaron 'dias' (ej. 7, 14, 31), restamos eso; si no, por defecto 31 días
            delta_dias = dias if dias is not None else 31
            fecha_inicio = fecha_fin - timedelta(days=delta_dias)

        if fecha_inicio > fecha_fin:
            raise HTTPException(400, "fecha_inicio debe ser <= fecha_fin")

        cache_key = f"consumo|{fecha_inicio}|{fecha_fin}|{clave_sih}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        match = _range_match(fecha_inicio, fecha_fin, clave_sih)
        # Resto de tu pipeline igual...
        pipeline = [
            {"$match": match},
            _add_norm_date_stage(),
            _sort_stage(),
            {"$group": {
                "_id": "$clave_sih",
                "dates":   {"$push": "$_fecha_norm"},
                "values":  {"$push": "$vol_hoy"},
                "promedio": {"$avg": "$vol_hoy"},
                "maximo":   {"$max": "$vol_hoy"},
                "minimo":   {"$min": "$vol_hoy"},
                "ultimo":   {"$last": "$vol_hoy"},
                "total":    {"$sum": 1},
            }},
            {"$project": {
                "_id": 0,
                "clave_sih": "$_id",
                "nombre": "$_id",
                "dates": 1,
                "values": 1,
                "promedio": {"$round": ["$promedio", 2]},
                "maximo": 1,
                "minimo": 1,
                "ultimo": 1,
                "total_lecturas": "$total",
            }},
            {"$sort": {"clave_sih": 1}},
        ]

        series = await collection_hidro.aggregate(pipeline).to_list(length=None)
        result = {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "total_presas": len(series),
            "series": series,
        }
        _cache_set(cache_key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 2. /api/sensores  -> última lectura por presa (una sola query, sin N+1)
# ---------------------------------------------------------------------------
@app.get("/api/sensores")
async def get_sensors(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
):
    try:
        if fecha_inicio and fecha_fin and fecha_inicio > fecha_fin:
            raise HTTPException(400, "fecha_inicio debe ser <= fecha_fin")

        cache_key = f"sensores|{fecha_inicio}|{fecha_fin}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        match = _range_match(fecha_inicio, fecha_fin)

        pipeline = [
            {"$match": match},
            _add_norm_date_stage(),
            # Ordenamos cronológicamente para que el $last sea exactamente el último día del rango filtrado
            _sort_stage(),
            {"$group": {
                "_id": "$clave_sih",
                "ultimo": {"$last": "$$ROOT"},
            }},
            {"$replaceRoot": {"newRoot": "$ultimo"}},
            {"$project": {
                "_id": 0,
                "clave_sih": 1,
                "llenado_pct": 1,
                "vol_hoy": 1,
                "lluvia_1d": 1,
                "fecha": "$_fecha_norm",
            }},
            {"$sort": {"clave_sih": 1}},
        ]

        regs = await collection_hidro.aggregate(pipeline, allowDiskUse=True).to_list(length=None)
        

        # Respaldo por si el rango de fechas es muy acotado y no devuelve nada:
        # Si no hay registros en el rango, traemos el último histórico general de la base de datos
        if not regs and (fecha_inicio or fecha_fin):
            fallback_pipeline = [
                _add_norm_date_stage(),
                {"$sort": {"_fecha_norm": 1}},
                {"$group": {"_id": "$clave_sih", "ultimo": {"$last": "$$ROOT"}}},
                {"$replaceRoot": {"newRoot": "$ultimo"}},
                {"$project": {"_id": 0, "clave_sih": 1, "llenado_pct": 1, "vol_hoy": 1, "lluvia_1d" : 1, "fecha": "$_fecha_norm"}},
                {"$sort": {"clave_sih": 1}}
            ]
            regs = await collection_hidro.aggregate(fallback_pipeline, allowDiskUse=True).to_list(length=None)

        sensors_list = []
        for r in regs:
            llenado = r.get("llenado_pct") or 0
            if llenado < 20:
                status, condition = "warning", "Bajo nivel"
            elif llenado > 90:
                status, condition = "warning", "Alto nivel"
            else:
                status, condition = "online", "Óptimo"

            sensors_list.append({
                "id": r["clave_sih"],
                "name": f"Estación / Presa {r['clave_sih']}",
                "status": status,
                "condition": condition,
                "llenado_pct": llenado,
                "vol_hoy": r.get("vol_hoy"),
                "lluvia_1d": r.get("lluvia_1d"),

                "ultima_actualizacion": r.get("fecha"),
            })

        result = {
            "sensors": sensors_list,
            "statusSummary": {
                "total": len(sensors_list),
                "online": sum(1 for s in sensors_list if s["status"] == "online"),
                "warning": sum(1 for s in sensors_list if s["status"] == "warning"),
                "offline": 0,
            },
        }
        _cache_set(cache_key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR EN /api/sensores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# 3. /api/alarmas  -> alertas por lluvia en rango, opcionalmente por presa
# ---------------------------------------------------------------------------
@app.get("/api/alarmas")
async def get_alarms(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    clave_sih: Optional[str] = Query(None),
    umbral_lluvia: float = Query(20.0, description="mm en 1 día para alertar"),
    limit: int = Query(50, ge=1, le=500),
):
    try:
        if fecha_inicio and fecha_fin and fecha_inicio > fecha_fin:
            raise HTTPException(400, "fecha_inicio debe ser <= fecha_fin")

        match = _range_match(fecha_inicio, fecha_fin, clave_sih)
        match["lluvia_1d"] = {"$gt": umbral_lluvia}

        pipeline = [
            {"$match": match},
            _add_norm_date_stage(),
            {"$sort": {"_fecha_norm": -1}},
            {"$limit": limit},
            {"$project": {
                "_id": {"$toString": "$_id"},
                "clave_sih": 1,
                "fecha": "$_fecha_norm",
                "lluvia_1d": 1,
                "mensaje": {
                    "$concat": [
                        "Alerta de lluvia intensa (",
                        {"$toString": "$lluvia_1d"},
                        " mm) en ",
                        "$clave_sih",
                    ]
                },
                "nivel": {"$literal": "Advertencia"},
            }},
        ]

        alarmas = await collection_hidro.aggregate(pipeline).to_list(length=limit)
        return alarmas
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 4. /api/gestion-agua  -> resumen por presa + logs recientes
# ---------------------------------------------------------------------------



@app.get("/api/gestion-agua")
async def get_gestion_agua(
    fecha_inicio: Optional[datetime] = Query(None),
    fecha_fin: Optional[datetime] = Query(None),
    clave_sih: Optional[str] = Query(None, description="Identificador de la presa seleccionada"),
):
    try:
        # 1. Validar fechas
        if fecha_inicio and fecha_fin and fecha_inicio > fecha_fin:
            raise HTTPException(
                status_code=400,
                detail="fecha_inicio debe ser <= fecha_fin"
            )

        # 2. Caché
        cache_key = f"gestion_agua|{fecha_inicio}|{fecha_fin}|{clave_sih}"
        cached = _cache_get(cache_key)

        if cached is not None:
            return cached

        # 3. Filtro de fechas
        match = _range_match(fecha_inicio, fecha_fin)

        # 4. Obtener el último registro de cada presa
        pipeline_sectors = [
            {"$match": match},
            _add_norm_date_stage(),
            _sort_stage(),

            {
                "$group": {
                    "_id": "$clave_sih",
                    "ultimo": {"$last": "$$ROOT"}
                }
            },

            {"$replaceRoot": {"newRoot": "$ultimo"}},

            {
                "$project": {
                    "_id": 0,
                    "clave_sih": 1,
                    "fecha": "$_fecha_norm",
                    "namo_hm3": 1,
                    "vol_hoy": 1,
                    "llenado_pct": 1,
                    "vol_lag_1": 1,
                    "cambio_1d": 1,
                    "vol_lag_7": 1,
                    "cambio_7d": 1,
                    "vol_lag_14": 1,
                    "cambio_14d": 1,
                    "vol_lag_30": 1,
                    "cambio_30d": 1,
                    "lluvia_1d": 1,
                    "lluvia_3d": 1,
                    "lluvia_7d": 1,
                    "lluvia_15d": 1,
                    "lluvia_30d": 1,
                    "obj_vol_7d": 1,
                    "obj_cambio_7d": 1,
                    "obj_vol_15d": 1,
                    "obj_cambio_15d": 1,
                    "obj_vol_30d": 1,
                    "obj_cambio_30d": 1
                }
            },

            {"$sort": {"clave_sih": 1}}
        ]

        regs = await collection_hidro.aggregate(
            pipeline_sectors,
            allowDiskUse=True
        ).to_list(length=None)

        # 5. Respaldo si el rango no devuelve registros
        if not regs and (fecha_inicio or fecha_fin):

            fallback_pipeline = [
                _add_norm_date_stage(),
                _sort_stage(),

                {
                    "$group": {
                        "_id": "$clave_sih",
                        "ultimo": {"$last": "$$ROOT"}
                    }
                },

                {"$replaceRoot": {"newRoot": "$ultimo"}},

                {
                    "$project": {
                        "_id": 0,
                        "clave_sih": 1,
                        "fecha": "$_fecha_norm",
                        "namo_hm3": 1,
                        "vol_hoy": 1,
                        "lluvia_1d": 1,
                        "llenado_pct": 1,
                        "vol_lag_1": 1,
                        "cambio_1d": 1,
                        "vol_lag_7": 1,
                        "cambio_7d": 1,
                        "vol_lag_14": 1,
                        "cambio_14d": 1,
                        "vol_lag_30": 1,
                        "cambio_30d": 1,
                        "lluvia_1d": 1,
                        "lluvia_3d": 1,
                        "lluvia_7d": 1,
                        "lluvia_15d": 1,
                        "lluvia_30d": 1,
                        "obj_vol_7d": 1,
                        "obj_cambio_7d": 1,
                        "obj_vol_15d": 1,
                        "obj_cambio_15d": 1,
                        "obj_vol_30d": 1,
                        "obj_cambio_30d": 1
                    }
                },

                {"$sort": {"clave_sih": 1}}
            ]

            regs = await collection_hidro.aggregate(
                fallback_pipeline,
                allowDiskUse=True
            ).to_list(length=None)

        # 6. Construir lista de presas
        sectors = []

        for r in regs:
            llenado = r.get("llenado_pct") or 0

            if llenado < 20:
                status = "warning"
                condition = "Bajo nivel"
            elif llenado > 90:
                status = "warning"
                condition = "Alto nivel"
            else:
                status = "online"
                condition = "Óptimo"

            sectors.append({
                "id": r.get("clave_sih"),
                "clave_sih": r.get("clave_sih"),
                "name": f"Presa {r.get('clave_sih')}",
                "status": status,
                "condition": condition,
                "namo_hm3": r.get("namo_hm3"),
                "vol_hoy": r.get("vol_hoy"),
                "lluvia_1d": r.get("lluvia_1d"),
                "llenado_pct": llenado,
                "ultima_actualizacion": r.get("fecha")
            })

        # 7. Obtener información de la presa seleccionada
        selected_presa = None
        historial = []

        if clave_sih:

            match_selected = {
                "clave_sih": clave_sih
            }

            # Aplicar también el rango de fechas al historial
            match_historial = {
                "$and": [
                    match,
                    match_selected
                ]
            }

            historial_pipeline = [
                _add_norm_date_stage(),
                {"$match": match_historial},
                {"$sort": {"_fecha_norm": -1}},
                {"$limit": 10},

                {
                    "$project": {
                        "_id": 0,
                        "clave_sih": 1,
                        "fecha": "$_fecha_norm",
                        "namo_hm3": 1,
                        "vol_hoy": 1,
                        "llenado_pct": 1,
                        "vol_lag_1": 1,
                        "cambio_1d": 1,
                        "vol_lag_7": 1,
                        "cambio_7d": 1,
                        "vol_lag_14": 1,
                        "cambio_14d": 1,
                        "vol_lag_30": 1,
                        "cambio_30d": 1,
                        "lluvia_1d": 1,
                        "lluvia_3d": 1,
                        "lluvia_7d": 1,
                        "lluvia_15d": 1,
                        "lluvia_30d": 1,
                        "obj_vol_7d": 1,
                        "obj_cambio_7d": 1,
                        "obj_vol_15d": 1,
                        "obj_cambio_15d": 1,
                        "obj_vol_30d": 1,
                        "obj_cambio_30d": 1
                    }
                }
            ]

            historial = await collection_hidro.aggregate(
                historial_pipeline,
                allowDiskUse=True
            ).to_list(length=10)

            # El primer registro del historial es el más reciente
            if historial:
                selected_presa = historial[0]

        # 8. Obtener últimos registros generales
        audit_pipeline = [
            _add_norm_date_stage(),
            {"$sort": {"_fecha_norm": -1}},
            {"$limit": 10},

            {
                "$project": {
                    "_id": 0,
                    "clave_sih": 1,
                    "fecha": "$_fecha_norm",
                    "vol_hoy": 1,
                    "lluvia_1d": 1,
                    "llenado_pct": 1,
                    "cambio_1d": 1
                }
            }
        ]

        audit_log = await collection_hidro.aggregate(
            audit_pipeline,
            allowDiskUse=True
        ).to_list(length=10)

        # 9. Respuesta
        result = {
            "sectors": sectors,
            "selectedPresa": selected_presa,
            "historial": historial,
            "auditLog": audit_log
        }

        _cache_set(cache_key, result)

        return result

    except HTTPException:
        raise

    except Exception as e:
        import traceback

        print("ERROR EN /api/gestion-agua:")
        print(str(e))
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )




# ---------------------------------------------------------------------------
# 5. /api/predicciones -> proyecciones a 7, 15 y 30 días desde MongoDB
# ---------------------------------------------------------------------------
@app.get("/api/predicciones")
async def get_predictions(
    horizonte: str = Query("7d", description="Horizonte de predicción: 7d, 15d o 30d"),
    clave_sih: Optional[str] = Query(None, description="Opcional: filtrar por presa")
):
    """
    Endpoint que conecta los modelos de machine learning entrenados con la vista del frontend (Predicciones.jsx).
    """
    try:
        if not ARTEFACTOS_ML:
            raise HTTPException(status_code=500, detail="Los modelos predictivos no están disponibles en el servidor.")

        # 1. Cargar los datos actuales usando la configuración existente de tu proyecto
        df_datos = cfg.cargar_datos()
        if df_datos.empty:
            raise HTTPException(status_code=404, detail="No se encontraron datos históricos para generar predicciones.")

        # Mapeo de horizonte a días numéricos usados por tu modelo
        dias_map = {"7d": 7, "15d": 15, "30d": 30}
        dias_horizonte = dias_map.get(horizonte, 7)

        # 2. Obtener lista de presas a procesar (todas o una específica)
        presas_a_procesar = [clave_sih] if clave_sih else sorted(df_datos["clave_sih"].unique())

        sensores_pred = []
        acciones_sugeridas = []
        serie_actual = []
        serie_proyectada = []
        
        alertas_count = 0
        pico_volumen = 0.0
        total_lluvia = 0.0
        total_cambio_abs = 0.0

        # Coordenadas espaciales fijas para distribuir las presas estéticamente en el mapa del frontend
        posiciones = [
            (28, 30), (45, 45), (62, 28), (78, 40),
            (85, 65), (32, 70), (55, 75), (75, 82),
            (20, 50), (50, 22)
        ]

        for idx, presa in enumerate(presas_a_procesar):
            try:
                # Ejecutar la función predecir que ya tienes en inferir.py
                res_pred = predecir(df_datos, presa, artefactos=ARTEFACTOS_ML)
                vol_actual = res_pred["volumen_actual_hm3"]
                namo = res_pred["capacidad_hm3"]
                
                pred_horizonte = res_pred["predicciones"].get(dias_horizonte, res_pred["predicciones"][7])
                vol_pred = pred_horizonte["volumen_hm3"]
                cambio_pred = pred_horizonte["cambio_hm3"]
                llenado_pred_pct = pred_horizonte["llenado_pct"]

                # Extraer lluvia acumulada de la fila correspondiente en el DataFrame
                fila_actual = df_datos[df_datos["clave_sih"] == presa].sort_values("fecha").iloc[-1]
                lluvia_acum = float(fila_actual.get(f"lluvia_{horizonte}", 0.0) or 0.0)

                if vol_pred > pico_volumen:
                    pico_volumen = vol_pred
                total_lluvia += lluvia_acum
                total_cambio_abs += abs(cambio_pred)

                # Clasificar estado según porcentaje de llenado proyectado
                if llenado_pred_pct > 95 or llenado_pred_pct < 15:
                    status = "alarm"
                    desc = f"ALARMA PREDICTIVA: Llenado proyectado al {llenado_pred_pct:.1f}%"
                    alertas_count += 1
                    acciones_sugeridas.append({
                        "id": idx + 1,
                        "titulo": f"Atención Crítica en Presa {presa}",
                        "descripcion": f"Se proyecta un volumen de {vol_pred:.2f} hm³ ({llenado_pred_pct:.1f}% NAMO).",
                        "prioridad": "Prioridad Alta • Crítico",
                        "tipo": "critical",
                        "boton": "Ejecutar"
                    })
                elif llenado_pred_pct > 85 or llenado_pred_pct < 25 or abs(cambio_pred) > (namo * 0.1):
                    status = "warning"
                    desc = f"Alerta Predictiva: Variación estimada de {cambio_pred:+.2f} hm³"
                    alertas_count += 1
                    acciones_sugeridas.append({
                        "id": idx + 1,
                        "titulo": f"Inspeccionar Presa {presa}",
                        "descripcion": f"Variación proyectada de {cambio_pred:+.2f} hm³ en {horizonte}.",
                        "prioridad": f"Prioridad Media • Urgencia en {horizonte}",
                        "tipo": "warning",
                        "boton": "Aprobar"
                    })
                else:
                    status = "online"
                    desc = f"Normal ({llenado_pred_pct:.1f}% proyectado)"

                x, y = posiciones[idx % len(posiciones)]
                sensores_pred.append({
                    "id": presa,
                    "name": f"Presa {presa}",
                    "location": f"Estación SIH {presa}",
                    "x": x,
                    "y": y,
                    "status": status,
                    "desc": desc,
                    "vol_hoy": round(vol_actual, 2),
                    "vol_pred": round(vol_pred, 2),
                    "llenado_pred_pct": round(llenado_pred_pct, 1)
                })

                serie_actual.append({"clave": presa, "valor": round(vol_actual, 2)})
                serie_proyectada.append({"clave": presa, "valor": round(vol_pred, 2)})

            except Exception as e:
                print(f"[warn] Error prediciendo para presa {presa}: {e}")
                continue

        total_presas = len(sensores_pred) or 1
        estabilidad = max(0.0, min(100.0, 100.0 - (alertas_count / total_presas) * 35.0))
        prob_falla = min(95, int((alertas_count / total_presas) * 60) + 5)

        # Definir nivel de riesgo global
        if alertas_count == 0:
            riesgo_texto, riesgo_color, estado_global, estado_color = "BAJO", "#34d399", "ÓPTIMO", "#36c5e5"
        elif alertas_count <= 2:
            riesgo_texto, riesgo_color, estado_global, estado_color = "MODERADO", "#fbbf24", "PREVENTIVO", "#fbbf24"
        else:
            riesgo_texto, riesgo_color, estado_global, estado_color = "ALTO", "#f87171", "ALERTA", "#f87171"

        peso_lluvia = min(55, max(15, int((total_lluvia / total_presas) * 1.5)))
        peso_variacion = min(45, max(15, int((total_cambio_abs / total_presas) * 2.0)))
        peso_hist = max(10, 100 - peso_lluvia - peso_variacion)

        factores_impacto = [
            {"factor": f"Precipitación acumulada ({horizonte})", "porcentaje": peso_lluvia, "nivel": "Alto" if peso_lluvia > 35 else "Medio", "claseColor": "critical" if peso_lluvia > 40 else "warning"},
            {"factor": "Variación volumétrica proyectada", "porcentaje": peso_variacion, "nivel": "Medio", "claseColor": "warning"},
            {"factor": "Comportamiento histórico (Lags)", "porcentaje": peso_hist, "nivel": "Base", "claseColor": "online"},
        ]

        if not acciones_sugeridas:
            acciones_sugeridas.append({
                "id": 999,
                "titulo": "Mantener operación nominal de compuertas",
                "descripcion": f"Sin anomalías críticas proyectadas para el horizonte de {horizonte}.",
                "prioridad": "Prioridad Baja • Rutina",
                "tipo": "warning",
                "boton": "Confirmar"
            })

        # Estructura exacta que espera tu componente Predicciones.jsx
        return {
            "horizonte": horizonte,
            "kpis": {
                "riesgoTexto": riesgo_texto,
                "riesgoColor": riesgo_color,
                "probabilidadFalla": prob_falla,
                "picoEstimado": round(pico_volumen, 2),
                "confianzaModelo": round(96.2 - (dias_horizonte * 0.12), 1),
                "alertasPrevias": alertas_count,
                "estabilidadRed": round(estabilidad, 1),
                "estadoGlobal": estado_global,
                "estadoColor": estado_color,
            },
            "sensores": sensores_pred,
            "factoresImpacto": factores_impacto,
            "accionesSugeridas": acciones_sugeridas[:4],
            "grafica": {
                "actual": serie_actual,
                "proyectada": serie_proyectada
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR EN /api/sensores: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))