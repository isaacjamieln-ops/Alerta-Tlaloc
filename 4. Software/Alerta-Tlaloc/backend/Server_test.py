from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import random
import datetime

app = FastAPI(title="Alerta Tláloc - Backend Oficial")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = "mongodb+srv://montstomelin_db_user:pOvfkLlnt2HUy2bt@cluster0.qtibroo.mongodb.net/"
client = AsyncIOMotorClient(MONGO_URI)
db = client.alerta_tlaloc_db_test

predicciones_coll = db.historial_predicciones
collection_consumption = db.consumo
collection_sensors = db.sensores
collection_alarms = db.alarmas

class DatosEntrada(BaseModel):
    zona: str
    nivel_actual_tanque: float
    caudal_lps: float
    presion_bar: float

@app.get("/api/consumo")
async def get_consumption(range: str = "31"):
    try:
        # Buscamos en la colección el documento cuyo campo "range" coincida con la variable recibida
        document = await collection_consumption.find_one({"range": range})
        
        if document and "values" in document:
            values = document["values"]
        else:
            # Respaldo por si no encuentra el rango exacto
            values = [12, 15, 21, 18, 13, 12, 16, 20, 24, 28, 25, 18]
            
        return {"range": range, "values": values}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sensores")
async def get_sensors():
    try:
        cursor = collection_sensors.find({})
        sensors_list = await cursor.to_list(length=200)
        
        # Limpiar el _id de MongoDB para cada sensor
        for s in sensors_list:
            s["_id"] = str(s["_id"])
        
        total = len(sensors_list) if sensors_list else 126
        online = sum(1 for s in sensors_list if s.get("status") == "online") if sensors_list else 124
        warning = sum(1 for s in sensors_list if s.get("status") == "warning") if sensors_list else 1
        offline = sum(1 for s in sensors_list if s.get("status") == "offline") if sensors_list else 1
        
        return {
            "sensors": sensors_list,
            "statusSummary": {
                "total": total,
                "online": online,
                "warning": warning,
                "offline": offline
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alarmas")
async def get_alarms(range: str = "31"):
    try:
        cursor = collection_alarms.find({}).sort("_id", -1).limit(50)
        alarms_list = await cursor.to_list(length=50)
        
        # Limpiar el _id de MongoDB para cada alarma
        for alarm in alarms_list:
            alarm["_id"] = str(alarm["_id"])
            
        return alarms_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    # Consumo del Agua

@app.get("/api/gestion-agua")
async def get_gestion_agua():
    try:
        # 1. Obtener sectores de la base de datos (puedes usar tu colección de sensores o crear una de sectores)
        cursor_sectores = db.sectores.find({})
        sectors_list = await cursor_sectores.to_list(length=50)
        
        for s in sectors_list:
            s["_id"] = str(s["_id"])
            
        # Si la colección está vacía, mandamos datos por defecto para respaldo
        if not sectors_list:
            sectors_list = [
                { "name": "Sector Norte", "pressure": 4.5, "flow": 38, "status": "ABIERTA", "valveType": "Válvula Maestra", "condition": "Óptimo" },
                { "name": "Sector Oriente", "pressure": 3.9, "flow": 29, "status": "ABIERTA", "valveType": "Válvula Maestra", "condition": "Óptimo" },
                { "name": "Sector Sur", "pressure": 4.2, "flow": 32, "status": "CERRADA", "valveType": "Válvula Maestra", "condition": "Atención" },
                { "name": "Sector Poniente", "pressure": 4.7, "flow": 35, "status": "ABIERTA", "valveType": "Válvula Maestra", "condition": "Óptimo" }
            ]

        # 2. Obtener bitácora de logs
        cursor_logs = db.bitacora.find({}).sort("_id", -1).limit(20)
        logs_list = await cursor_logs.to_list(length=20)
        
        for log in logs_list:
            log["_id"] = str(log["_id"])
            
        if not logs_list:
            logs_list = [
                { "time": "10:12", "action": "Ajuste de caudal (Sector Oriente)", "user": "admin" },
                { "time": "09:55", "action": "Cierre de emergencia (Sector Sur)", "user": "ismaeln" }
            ]

        return {
            "sectors": sectors_list,
            "auditLog": logs_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))