# 🌧️ Alerta Tláloc

> **Sistema Inteligente de Monitoreo, Predicción y Gestión Hidrológica**  
> Una plataforma full-stack avanzada diseñada para el análisis de datos hidrometeorológicos, monitoreo de niveles de agua y predicción de eventos críticos mediante modelos de Machine Learning.

---

## 📋 Tabla de Contenido
1. [Acerca del Proyecto](#-acerca-del-proyecto)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Características Principales](#-características-principales)
4. [Tecnologías Utilizadas](#-tecnologías-utilizadas)
5. [Estructura del Repositorio](#-estructura-del-repositorio)
6. [Instalación y Configuración](#-instalación-y-configuración)
7. [Ejecución del Sistema](#-ejecución-del-sistema)
8. [Modelos Predictivos y Machine Learning](#-modelos-predictivos-y-machine-learning)
9. [Autor / Desarrollador](#-autor--desarrollador)

---

## 🌊 Acerca del Proyecto

**Alerta Tláloc** es una solución tecnológica integral orientada a la gestión inteligente del agua y la prevención de riesgos hidrológicos. El sistema combina una interfaz web moderna en React con un backend robusto en FastAPI y un motor de inferencia de Machine Learning respaldado por MongoDB Atlas, permitiendo visualizar datos en tiempo real, monitorear niveles y evaluar tendencias predictivas a 7, 15 y 30 días.

---

## 🏗️ Arquitectura del Sistema

El proyecto está estructurado bajo un enfoque desacoplado (Full-Stack):

* **Frontend (Interfaz de Usuario):** Desarrollado en **React (Vite)**, estructurado con componentes modulares (`GestionAgua.jsx`, `Dashboard.jsx`, `Predicciones.jsx`) y estilizado con soporte responsivo, Bootstrap y componentes personalizados.
* **Backend (API REST):** Desarrollado en **Python con FastAPI** y servido con **Uvicorn**, encargado de exponer endpoints para el consumo de métricas hidrológicas, gestión de datos y ejecución de modelos predictivos.
* **Base de Datos & Machine Learning:** Conexión a **MongoDB Atlas** para el almacenamiento de series temporales (`Data` y `Predicciones`), junto con scripts de entrenamiento, evaluación e inferencia (`inferir.py`, `entrenar_modelo.py`, `evaluar_modelo.py`) basados en Scikit-Learn / Pandas y serializados mediante Pickle (`.pkl`).
* **Hostings**: Gestion de Api mediante un Contenedor Docker y un servidor Render, Hosting de sitio web mediante Firebase.

---

## 🚀 Características Principales

* **Dashboard en Tiempo Real:** Visualización de KPIs clave, estados del sistema y gráficos interactivos con métricas hidrológicas.
* **Módulo de Gestión de Agua (`GestionAgua`):** Control y monitoreo detallado de niveles de cuerpos de agua, caudales y alertas operativas.
* **Predicciones Hidrológicas:** Modelos predictivos avanzados para horizontes temporales de **7, 15 y 30 días** (`meta_cambio_7d.json`, `modelo_cambio_30d.pkl`, etc.).
* **Reportes y Exportación:** Generación de reportes dinámicos y herramientas de exportación integradas (PDF, CSV, Excel/XLSX).
* **Pruebas Automatizadas:** Scripts de pruebas de interfaz y flujos de navegación integrados utilizando **Katalon** y **Maestro**.

---

## 🛠️ Tecnologías Utilizadas

### Frontend
* **React** (v19) + **Vite**
* **Bootstrap 5** & **Bootstrap Icons**
* **jsPDF** & **html2canvas** (Generación de reportes)

### Backend & Base de Datos
* **Python** / **FastAPI** / **Uvicorn**
* **Motor** (Asynchronous MongoDB driver for Python)
* **MongoDB Atlas** (Base de datos en la nube)
* **Pandas** / **Scikit-Learn** (Ciencia de datos y Machine Learning)

---

## 📁 Estructura del Repositorio

```text
Alerta-Tlaloc-App/
├── 4. Software/
    └── Alerta-Tlaloc/
        ├── backend/
        │   ├── Server.py               # Servidor principal FastAPI
        │   └── models/                 # Modelos ML, datasets y scripts de inferencia
        ├── public/                     # Recursos estáticos y favicons
        ├── src/
        │   ├── components/             # Componentes reutilizables (Navbar, Sidebar, Cards, etc.)
        │   ├── pages/                  # Vistas principales (Dashboard, GestionAgua, Predicciones, Inicio)
        │   ├── services/               # Conexión API / servicios HTTP
        │   ├── App.jsx                 # Componente raíz de la app React
        │   └── main.jsx                # Punto de entrada React
        ├── package.json                # Dependencias y scripts de Node.js
        └── README.md                   # Documentación oficial del proyecto
```

---

## ⚙️ Instalación y Configuración

### 1. Clonar o Descomprimir el Proyecto
Asegúrate de ubicarte en el directorio raíz del proyecto (`Alerta-Tlaloc-App/4. Software/Alerta-Tlaloc`).

### 2. Configuración del Backend (Python)
```bash
# Entrar al directorio del backend o raíz del proyecto con soporte Python
cd backend

# Instalar dependencias requeridas (FastAPI, Uvicorn, Motor, Pandas, Scikit-Learn)
pip install fastapi uvicorn motor pandas scikit-learn pydantic
```

### 3. Configuración del Frontend (React / Vite)
```bash
# Regresar a la carpeta de la aplicación React
cd ../

# Instalar dependencias de Node.js
npm install
```

---

## 🏃‍♂️ Ejecución del Sistema

### Ejecutar el Backend (FastAPI)
```bash
cd backend
uvicorn Server:app --reload --host 0.0.0.0 --port 8000
```
*El servidor API estará disponible en `http://localhost:8000` (con documentación interactiva en `/docs`).*

### Ejecutar el Frontend (Vite / React)
En una nueva terminal, navega hasta la carpeta del proyecto frontend:
```bash
npm run dev
```
*La aplicación web se abrirá localmente en `http://localhost:5173` (o el puerto indicado por Vite).*

---

## 🤖 Modelos Predictivos y Machine Learning

El backend incluye artefactos entrenados para predecir cambios en los cuerpos de agua:
* Modelos ubicados en `backend/models/src/models/`:
  * `modelo_cambio_7d.pkl` / `meta_cambio_7d.json`
  * `modelo_cambio_15d.pkl` / `meta_cambio_15d.json`
  * `modelo_cambio_30d.pkl` / `meta_cambio_30d.json`
* El script `inferir.py` gestiona la carga de artefactos y la generación de predicciones en tiempo de ejecución para los endpoints de FastAPI.

---

## 👥 Autor / Desarrollador
Monserrat Montiel Hernández
Issac Jamiel Valente Navarrete Padilla
Proyecto desarrollado como parte de iniciativas académicas y profesionales en desarrollo web full-stack, analítica de datos y ciberseguridad.
