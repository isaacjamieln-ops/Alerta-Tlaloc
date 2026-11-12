import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb+srv://montstomelin_db_user:pOvfkLlnt2HUy2bt@cluster0.qtibroo.mongodb.net/"
client = AsyncIOMotorClient(MONGO_URI)
db = client.alerta_tlaloc_db_test

async def poblar_datos_iniciales():
    # 1. Subir datos de consumo por rango
    consumption_data = [
        {"range": "hoy", "values": [12, 15, 21, 18, 13, 12, 16, 20, 24, 28, 25, 18]},
        {"range": "7", "values": [12, 15, 21, 18, 13, 12, 16]},
        {"range": "14", "values": [12, 15, 21, 18, 13, 12, 16, 20, 24, 28, 25, 18, 22, 27]},
        {"range": "21", "values": [12, 15, 21, 18, 13, 12, 16, 20, 24, 28, 25, 18, 22, 27, 29, 24, 20, 25, 30, 34, 31]},
        {"range": "31", "values": [12, 15, 21, 18, 13, 12, 16, 20, 24, 28, 25, 18, 22, 27, 29, 24, 20, 25, 30, 34, 31, 27, 24, 29, 26, 32, 25, 22, 28, 30, 26]}
    ]
    await db.consumo.delete_many({}) # Limpiar anterior si existe
    await db.consumo.insert_many(consumption_data)

    # 2. Subir instalaciones
    installations = [
        { "id": 1, "name": "Administración A", "percentage": 0.303 },
        { "id": 2, "name": "Edificio principal", "percentage": 0.214 },
        { "id": 3, "name": "Almacén", "percentage": 0.156 },
        { "id": 4, "name": "Instalación B", "percentage": 0.149 },
        { "id": 5, "name": "Área tecnológica", "percentage": 0.104 },
        { "id": 6, "name": "Otros", "percentage": 0.074 },
    ]
    await db.instalaciones.delete_many({})
    await db.instalaciones.insert_many(installations)

    # 3. Subir sensores del mapa
    sensors = [
        { "id": 1, "x": 18, "y": 28, "status": "online", "name": "Sensor 01", "location": "Administración A" },
        { "id": 2, "x": 38, "y": 43, "status": "online", "name": "Sensor 02", "location": "Edificio principal" },
        { "id": 3, "x": 56, "y": 24, "status": "online", "name": "Sensor 03", "location": "Almacén" },
        { "id": 4, "x": 73, "y": 37, "status": "warning", "name": "Sensor 04", "location": "Instalación B" },
        { "id": 5, "x": 84, "y": 56, "status": "online", "name": "Sensor 05", "location": "Área tecnológica" },
        { "id": 6, "x": 28, "y": 69, "status": "online", "name": "Sensor 06", "location": "Administración A" },
        { "id": 7, "x": 54, "y": 72, "status": "alarm", "name": "Sensor 07", "location": "Edificio principal" },
        { "id": 8, "x": 77, "y": 79, "status": "offline", "name": "Sensor 08", "location": "Almacén" },
    ]
    await db.sensores.delete_many({})
    await db.sensores.insert_many(sensors)

    print("¡Datos iniciales subidos con éxito a MongoDB Atlas!")

asyncio.run(poblar_datos_iniciales())