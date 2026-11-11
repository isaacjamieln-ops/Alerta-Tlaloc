# Alerta Tlaloc
## Integrantes
- Leonardo Apolonio Villagómez
- Ángel Emmanuel Reyes Romero
- Juan Gutierrez Reyes
- Alan Otzar Lopez Rivera
- Luis Erick Garcia Sebastian
- 
- 

## Contenido (Fases citadas del punto 7 del documento de requisitos del proyecto. Páginas 7 y 8)

- [Fase 1 (Propuesta y viabilidad)](#fase-1-propuesta-y-viabilidad)
- [Fase 2 (Investigación y adquisición)](#fases-2-investigación-y-adquisición)
- [Fase 3 (Preparación y análisis exploratorio)](#fase-3-preparación-y-análisis-exploratorio)
- [Fase 4 (Desarrollo de Machine Learning)](#fase-4-desarrollo-de-machine-learning)
- [Fase 5 (Validación y mejora)](#fase-5-validación-y-mejora)
- [Fase 6 (Aplicación funcional)](#fase-6-aplicación-funcional)
- [Fase 7 (Pruebas y preparación comercial)](#fase-7-pruebas-y-preparación-comercial)
- [Fase 8 (Presentación y entrega final)](#fase-8-presentación-y-entrega-final)

---

## Fase 1 (Propuesta y viabilidad)

---

## Fase 2 (Investigación y adquisición)

Los datos y archivos utilizados provienen de las siguientes páginas (Todo fue consultado el 26 de octubre del 2026):

| Qué contiene | Enlace |
| --- | --- |
| CSVs con los registros de cada presa | <https://sih.conagua.gob.mx/presas.html> |
| Inventario que contiene metadatos faltantes de cada presa | <https://presas.conagua.gob.mx/inventario/> |

### Disclaimer por parte de CONAGUA citado

> "Los datos abiertos son datos que pueden ser utilizados, reutilizados y redistribuidos libremente por cualquier persona, y que se encuentran sujetos, cuando más, al requerimiento de atribución y de compartirse de la misma manera en que aparecen.
>
> Para considerar que los datos cumplen con la definición de apertura en su totalidad, se requiere de:
>
> - **Disponibilidad y acceso:** la información debe estar disponible como un todo y a un costo razonable de reproducción, preferiblemente descargándola de internet. Además, la información debe estar disponible en una forma conveniente y modificable.
> - **Reutilización y redistribución:** los datos deben ser provistos bajo términos que permitan reutilizarlos y redistribuirlos, e incluso integrarlos con otros conjuntos de datos.
> - **Participación universal:** todos deben poder utilizar, reutilizar y redistribuir la información. No debe haber discriminación alguna en términos de esfuerzo, personas o grupos.
>
> Características de los datos abiertos: accesibles, integrales, gratuitos, no discriminatorios, oportunos, permanentes, primarios, legibles por máquinas, en formatos abiertos y de libre uso."

Fuente: <https://app.conagua.gob.mx/datosabiertoscna/index.html>

---

## Fase 3 (Preparación y análisis exploratorio)

### Librerías de Python usadas

```text
python == 3.14.6
matplotlib == 3.11.2
numpy == 2.5.4
pandas == 3.1.0
```

### Carpetas y archivos usados

#### Scripts

`./src/data/...`

| Script | Qué hace |
| --- | --- |
| `preparar_presa.py` | Quita las primeras 7 filas, rehace la tabla con los datos a partir de 1995 y añade las capacidades de cada presa|
| `limpiar_presa.py` | Detecta datos nulos y los trata añadiendo datos correspondientes, elimina negativos y señala anomalias |
| `eda_presa.py` | Realiza el análisis EDA a todos los CSV limpios generados anteriormente, genera gráficas y resúmenes de datos |
| `crear_dataset.py` | Toma los CSV limpiados y genera los dataset de cada presa y un csv más que contiene todos. También contiene los datos de entrenamiento, prueba y embargo |

#### Datos

`./data/...`

| Carpeta | Contenido |
| --- | --- |
| `clean/` | CSVs con datos faltantes tratados (Salida de `limpiar_presa.py`) |
| `datasets/` | Contiene los datasets individuales de cada presa, un dataset con todos los anteriores unidos en un solo CSV y un reporte/resumen del modelado (Salida de `crear_dataset.py`) |
| `metadata/` | Contiene un csv en el que se agregan los datos faltantes que no se encontraban en los CSV crudos de las presas, `preparar_presa.py` retoma la metadata para generar su respectivo resumen. |
| `processed/` | Contiene los CSV tratados de cada presa en donde ya se saltan las primeras 7 filas de los originales (Ahí contienen datos que rompen con la estructura de una tabla) y tiene datos a partir de enero de 1995 (Salida de `preparar_presa.py`) |
| `raw/` | Contiene los CSV crudos de cada presa |
| `reports/` | Contiene los análisis EDA de cada presa ya limpia (Salida de `eda_presa.py`) |

### Agregar presa

1. Descargar el CSV crudo y añadirlo en `./data/raw/`
2. Consultar los datos restantes en el inventario de CONAGUA (Enlace dado en la fase anterior) para añadir en `./data/metadata/presas_metadata.csv` (Clave SIH, Id en el inventario de CONAGUA, Nombre oficial, NAME en hm3, NAMO en hm3, NAMINO en hm3, NAME en msnm, NAMO en msnm, NAMINO en msnm. Esos datos respectivamente)
3. Abrir una terminal desde la raíz del proyecto
4. Ejecutar `preparar_presa.py` (`python src/data/preparar_presa.py data/raw/*.csv`)
5. Ejecutar `limpiar_presa.py` (`python src/data/limpiar_presa.py data/processed/*_procesado.csv`)
6. Ejecutar `eda_presa.py` (`python src/data/eda_presa.py data/clean`)
7. Ejecutar `crear_dataset.py` (`python src/data/crear_dataset.py data/clean --hasta 2026-10-26`) La fecha indicada es la misma de la obtención de los CSV y se toma como fecha corte

---

## Fase 4 (Desarrollo de Machine Learning)

### Librerias de Python usadas (adicionales a la fase 3)

```text
scikit-learn == 1.9.1
joblib == 1.6.0
pytest == 9.2.0
```

### Carpetas y archivos usados

#### Scripts

`./src/models/...`

| Script | Que hace |
| --- | --- |
| `config.py` | Configuracion compartida: rutas, horizontes (7, 15 y 30 dias), columnas excluidas, normalizacion por capacidad y modelos de referencia |
| `entrenar_modelo.py` | Entrena un Random Forest por horizonte, ajusta hiperparametros con validacion cronologica (`TimeSeriesSplit`) dentro del entrenamiento y calibra el intervalo del 90 % por presa. Guarda modelo y metadatos |
| `evaluar_modelo.py` | Evalua en el periodo de prueba contra las referencias y genera tablas, graficas y el resumen de evaluacion (Fase 5) |
| `../../tests/test_ml.py` | 13 pruebas con `pytest`: particion sin traslape, sin variables de futuro, prediccion normal y manejo de errores (presa inexistente, fecha sin observacion, datos nulos) |
| `inferir.py` | Predice el volumen a 7, 15 y 30 dias para una presa y fecha. Se usa por linea de comandos o se importa desde el tablero |

#### Modelos

Se guardan en la misma carpeta que los scripts, `./src/models/`:

| Archivo | Contenido |
| --- | --- |
| `modelo_cambio_{7,15,30}d.pkl` | Random Forest entrenado de cada horizonte |
| `meta_cambio_{7,15,30}d.json` | Variables, hiperparametros elegidos, error de validacion cronologica y semiancho del intervalo por presa |

### Diseno del modelo

- **Tecnica:** regresion supervisada con Random Forest, comparada contra dos referencias (persistencia y tendencia).
- **Objetivo:** el cambio de volumen a h dias dividido entre la capacidad (NAMO) de la presa. La salida se multiplica por la capacidad y se suma al volumen de hoy. Asi las presas chicas (10 hm3) y las grandes (9,340 hm3) pesan parecido en el entrenamiento.
- **Variables de entrada (19):** capacidad, nivel de llenado, volumen y cambios rezagados (1, 7, 14 y 30 dias), lluvia acumulada (1, 3, 7, 15 y 30 dias), indicador de lluvia faltante, mes y estacionalidad (seno y coseno del dia del año).
- **Excluidas:** identificadores, particion, objetivos (`obj_*`) y `vol_hoy`. `vol_hoy` no es fuga de datos (se conoce el dia de la prediccion y se puede recuperar como `vol_lag_1 + cambio_1d`); se excluye como entrada directa para que el modelo trabaje con variables relativas a la capacidad.
- **Particion cronologica:** entrenamiento hasta 2020-05-15, embargo de 30 dias (no se usa) y prueba desde 2020-06-15. Los datos nunca se mezclan al azar.
- **Ajuste de hiperparametros:** `TimeSeriesSplit` de 3 pliegues dentro del entrenamiento, con un hueco entre pliegues igual al horizonte para que los objetivos no se traslapen. La particion de prueba no interviene en ninguna decision.
- **Intervalo del 90 %:** se calibra por presa con los errores del ultimo 15 % cronologico del entrenamiento.

### Reproducir el entrenamiento y la prediccion

Desde la raiz del proyecto (las rutas se calculan solas, no hay que editar nada):

1. `python src/models/entrenar_modelo.py` (10 a 20 minutos en CPU; con `--rapido` omite el ajuste de hiperparametros)
2. `python src/models/evaluar_modelo.py`
3. `python -m pytest -v` (desde la raiz; 13 pruebas)
4. `python src/models/inferir.py --presa CCHNL` (opcional: `--fecha AAAA-MM-DD`; por defecto usa la ultima observacion)

Uso desde el tablero:

```python
from inferir import cargar_artefactos, predecir
art = cargar_artefactos()
resultado = predecir(df, "CCHNL", artefactos=art)  # predicciones, intervalos y llenado
```

**Compatibilidad:** los `.pkl` se generaron con scikit-learn 1.9.1. Con otra version mayor pueden no cargar; en ese caso se reentrena con el paso 1 (la semilla es fija, 42).

**Agregar una presa:** despues de correr los pasos de la fase 3 (que regeneran `modelado_completo.csv`), repetir los pasos 1 y 2.

---

## Fase 5 (Validacion y mejora)

### Procedimiento de validacion

1. Se reserva el periodo mas reciente (2020-06-15 a 2026-10-26) como prueba.
2. Se predice con los modelos entrenados y se comparan los valores contra los observados.
3. Se mide contra dos referencias: **persistencia** (el volumen futuro es igual al de hoy) y **tendencia** (volumen de hoy mas el cambio reciente en una ventana comparable al horizonte).
4. Indicadores: MAE y RMSE (hm3), MAE como % de la capacidad, error porcentual ponderado (suma de errores entre suma del volumen real) y R2 del cambio. Para el intervalo, la cobertura observada.
5. Se analiza el error por presa y por mes, y los peores casos.

No se fijo una meta de "precision" de antemano. Se reporta el R2 del cambio y no el R2 del volumen, porque en el volumen incluso persistencia obtiene R2 cercano a 1 y no distingue entre modelos.

### Resultados (periodo de prueba, todas las presas juntas)

| Horizonte | MAE Random Forest | MAE persistencia | MAE tendencia | Mejora vs persistencia | Mejora vs tendencia | R2 del cambio | Cobertura del intervalo 90 % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias | 19.96 hm3 | 38.79 hm3 | 24.64 hm3 | 48.5 % | 19.0 % | 0.587 | 89.5 % |
| 15 dias | 43.54 hm3 | 79.13 hm3 | 57.24 hm3 | 45.0 % | 23.9 % | 0.623 | 89.7 % |
| 30 dias | 82.38 hm3 | 149.64 hm3 | 133.01 hm3 | 44.9 % | 38.1 % | 0.695 | 88.4 % |

MAE por presa a 7 dias (hm3):

| Presa | Random Forest | Persistencia | Tendencia | Cobertura del intervalo |
| --- | --- | --- | --- | --- |
| CCHNL | 11.60 | 13.57 | 16.11 | 90.1 % |
| CPRNL | 2.54 | 2.82 | 2.33 | 76.0 % |
| EPLGJ | 0.16 | 0.21 | 0.18 | 93.6 % |
| INFMC | 100.93 | 190.32 | 134.04 | 90.5 % |
| LBQCH | 12.34 | 21.56 | 12.05 | 93.3 % |
| LDCJL | 20.40 | 50.92 | 22.60 | 89.4 % |
| PMHSI | 23.95 | 52.92 | 25.07 | 92.5 % |
| SLSGJ | 7.20 | 15.44 | 9.07 | 92.5 % |
| VBRMX | 1.46 | 3.00 | 1.48 | 87.4 % |

Las tablas completas (todas las presas y horizontes) estan en `./reports/ml/`.

### Estabilidad por año

Como solo hay una particion de prueba, se verifico que la ventaja no dependa de un año. La mejora del Random Forest frente a persistencia se mantiene positiva en todos los años y horizontes (entre 32 % y 59 %); 2020 y 2026 son años parciales. Detalle en `./reports/ml/metricas_por_anio.csv`.

### Analisis de errores

- **Donde falla el modelo:** CPRNL a 7 dias queda por detras de la tendencia y a 15 y 30 dias por detras de persistencia; LBQCH a 7 dias queda ligeramente por detras de la tendencia (12.34 contra 12.05).
- **Intervalo:** a nivel global la cobertura es cercana a 90 %, pero por presa varia entre 76 % (CPRNL) y 94 %. En la aplicacion debe presentarse como aproximado.
- **Estacionalidad del error:** el error se concentra en agosto y septiembre (temporada de lluvias), cuando los cambios de volumen son mas bruscos.
- **Sobreajuste:** el error (como % de la capacidad) en entrenamiento, validacion cronologica y prueba es 0.71 / 0.96 / 0.81 % a 7 dias, 1.58 / 2.02 / 1.78 % a 15 dias y 2.78 / 3.73 / 3.47 % a 30 dias. En prueba nunca es peor que en validacion, asi que no hay senales de sobreajuste.
- **El error absoluto en hm3 esta dominado por las presas grandes** (por ejemplo INFMC), por eso se reporta tambien como % de la capacidad.

### Mejoras realizadas durante la validacion

- Se agrego una referencia de tendencia, mas exigente que persistencia.
- Se detecto que, con el objetivo en hm3, la presa mas pequena (EPLGJ) quedaba peor que persistencia. Se cambio el objetivo a cambio de volumen entre capacidad y EPLGJ paso a superar a ambas referencias.
- Se cambio el error porcentual a una version ponderada, porque el error porcentual fila por fila se disparaba con volumenes muy bajos.

### Limitaciones

- La lluvia usada es la observada, no un pronostico, por lo que el modelo no anticipa tormentas futuras.
- No se modelan de forma explicita extracciones, aportaciones ni evaporacion.
- Los eventos extremos (ciclones, aperturas de compuertas) estan poco representados y producen los mayores errores.
- El intervalo se calibra con un tramo reciente del entrenamiento y puede no cubrir bien periodos con comportamiento distinto.
- Solo hay una particion cronologica de prueba y 3 pliegues de validacion; se reporta la estabilidad por año como verificacion adicional.
- El resultado depende de como se rellenaron los datos faltantes en la fase 3; varias presas tienen muchos dias con volumen identico al anterior.
- Es una herramienta de apoyo a la decision; no sustituye a las autoridades ni es un sistema certificado de seguridad estructural de presas.

---

## Fase 6 (Aplicación funcional)

---

## Fase 7 (Pruebas y preparación comercial)

---

## Fase 8 (Presentación y entrega final)