import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb+srv://montstomelin_db_user:pOvfkLlnt2HUy2bt@cluster0.qtibroo.mongodb.net/"
client = AsyncIOMotorClient(MONGO_URI)
db = client.alerta_tlaloc_db_test

async def poblar_datos_iniciales():
    # 1. Subir datos de consumo por rango (nuevos valores de prueba)
    consumption_data = [
        {"range": "hoy", "values": [35, 40, 25, 30, 45, 50, 60, 55, 48, 42, 38, 33]},
        {"range": "7", "values": [45, 50, 42, 38, 55, 60, 52]},
        {"range": "14", "values": [30, 35, 40, 45, 50, 48, 42, 38, 44, 49, 53, 58, 62, 59]},
        {"range": "21", "values": [25, 28, 32, 36, 40, 43, 47, 50, 48, 45, 42, 39, 41, 44, 48, 52, 55, 50, 46, 42, 39]},
        {"range": "31", "values": [20, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52, 55, 53, 50, 47, 44, 41, 38, 35, 38, 41, 44, 47, 50, 53, 56, 54, 51, 48, 45]}
    ]
    await db.consumo.delete_many({}) # Limpiar anterior si existe
    await db.consumo.insert_many(consumption_data)

    # 2. Subir instalaciones (nuevas ubicaciones y porcentajes ajustados a 1.0)
    installations = [
        { "id": 1, "name": "Planta Norte", "percentage": 0.285 },
        { "id": 2, "name": "Estación de Bombeo", "percentage": 0.220 },
        { "id": 3, "name": "Depósito Principal", "percentage": 0.180 },
        { "id": 4, "name": "Sector Sur", "percentage": 0.135 },
        { "id": 5, "name": "Planta de Tratamiento", "percentage": 0.110 },
        { "id": 6, "name": "Auxiliares", "percentage": 0.070 },
    ]
    await db.instalaciones.delete_many({})
    await db.instalaciones.insert_many(installations)

    # 3. Subir sensores del mapa (nuevas posiciones y distribución de estados)
    sensors = [
        { "id": 1, "x": 22, "y": 30, "status": "online", "name": "Sensor 01", "location": "Planta Norte" },
        { "id": 2, "x": 40, "y": 45, "status": "online", "name": "Sensor 02", "location": "Estación de Bombeo" },
        { "id": 3, "x": 60, "y": 20, "status": "warning", "name": "Sensor 03", "location": "Depósito Principal" },
        { "id": 4, "x": 75, "y": 35, "status": "online", "name": "Sensor 04", "location": "Sector Sur" },
        { "id": 5, "x": 80, "y": 60, "status": "alarm", "name": "Sensor 05", "location": "Planta de Tratamiento" },
        { "id": 6, "x": 25, "y": 70, "status": "online", "name": "Sensor 06", "location": "Planta Norte" },
        { "id": 7, "x": 50, "y": 75, "status": "offline", "name": "Sensor 07", "location": "Estación de Bombeo" },
        { "id": 8, "x": 70, "y": 85, "status": "online", "name": "Sensor 08", "location": "Depósito Principal" },
    ]
    await db.sensores.delete_many({})
    await db.sensores.insert_many(sensors)

    print("¡Nuevos datos de prueba subidos con éxito a MongoDB Atlas!")

asyncio.run(poblar_datos_iniciales())