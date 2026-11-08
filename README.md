# Alerta Tlaloc
## Integrantes
- Leonardo Apolonio Villagómez
- Ángel Emmanuel Reyes Romero

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

---

## Fase 5 (Validación y mejora)

---

## Fase 6 (Aplicación funcional)

---

## Fase 7 (Pruebas y preparación comercial)

---

## Fase 8 (Presentación y entrega final)