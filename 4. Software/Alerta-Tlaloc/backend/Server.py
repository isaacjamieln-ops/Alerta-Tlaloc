from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from typing import Optional
import time

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

# ---------------------------------------------------------------------------
# 4. /api/gestion-agua  -> resumen por presa + logs recientes (Corregido para GestionAgua.jsx)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# 4. /api/gestion-agua  -> resumen por presa real + logs recientes
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 4. /api/gestion-agua  -> resumen por presa real + logs recientes (Corregido)
# ---------------------------------------------------------------------------
# 4. /api/gestion-agua  -> resumen por presa real + logs recientes (Corregido)
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
