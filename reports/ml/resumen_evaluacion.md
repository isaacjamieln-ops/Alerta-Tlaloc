# Resumen de evaluación (periodo de prueba)

Métricas globales (todas las presas juntas). MAE y RMSE en hm3; el MAE global está dominado por las presas grandes, por eso se reporta también por presa y como % de la capacidad.

| horizonte_dias | modelo | MAE_hm3 | RMSE_hm3 | MAE_pct_capacidad | error_pct_volumen | R2_cambio | cobertura_intervalo_90 |
|---|---|---|---|---|---|---|---|
| 7 | Random Forest | 19.963 | 67.323 | 0.685 | 1.291 | 0.587 | 89.47 |
| 7 | Persistencia | 38.787 | 104.725 | 1.332 | 2.508 | -0.0 | nan |
| 7 | Tendencia | 24.635 | 97.23 | 0.846 | 1.593 | 0.138 | nan |
| 15 | Random Forest | 43.535 | 120.614 | 1.495 | 2.814 | 0.623 | 89.713 |
| 15 | Persistencia | 79.134 | 196.42 | 2.717 | 5.114 | -0.0 | nan |
| 15 | Tendencia | 57.244 | 175.328 | 1.965 | 3.7 | 0.203 | nan |
| 30 | Random Forest | 82.384 | 193.773 | 2.828 | 5.318 | 0.695 | 88.424 |
| 30 | Persistencia | 149.636 | 350.913 | 5.137 | 9.66 | -0.0 | nan |
| 30 | Tendencia | 133.005 | 346.317 | 4.566 | 8.586 | 0.026 | nan |


## Mejora del Random Forest frente a las referencias (MAE global)

- 7 días: 48.5 % mejor que persistencia y 19.0 % mejor que tendencia.
- 15 días: 45.0 % mejor que persistencia y 23.9 % mejor que tendencia.
- 30 días: 44.9 % mejor que persistencia y 38.1 % mejor que tendencia.


## Presas donde el Random Forest NO supera a una referencia

- CPRNL a 7 días: RF 2.536 hm3 vs Tendencia 2.329.
- LBQCH a 7 días: RF 12.339 hm3 vs Tendencia 12.045.
- CPRNL a 15 días: RF 5.765 hm3 vs Persistencia 5.683, Tendencia 5.453.
- CPRNL a 30 días: RF 11.471 hm3 vs Persistencia 10.597.


## Cobertura del intervalo del 90 % (por presa, 7 días)

- CCHNL: 90.1 %
- CPRNL: 76.0 %
- EPLGJ: 93.6 %
- INFMC: 90.5 %
- LBQCH: 93.3 %
- LDCJL: 89.4 %
- PMHSI: 92.5 %
- SLSGJ: 92.5 %
- VBRMX: 87.4 %

Si la cobertura es muy distinta de 90 %, el intervalo NO está bien calibrado para ese periodo y la app debe presentarlo como aproximado (el régimen hidrológico del periodo de prueba puede diferir del de calibración).


## Error por mes (7 días, hm3)

| mes_obs | MAE_rf | MAE_persistencia | n |
|---|---|---|---|
| 9 | 43.39 | 74.37 | 1890 |
| 8 | 41.42 | 69.92 | 1953 |
| 10 | 28.74 | 38.83 | 1845 |
| 7 | 26.9 | 35.78 | 1953 |
| 6 | 22.28 | 35.26 | 1764 |
| 12 | 13.15 | 20.37 | 1674 |
| 11 | 11.96 | 21.05 | 1620 |
| 5 | 9.97 | 40.49 | 1668 |
| 1 | 8.99 | 19.0 | 1674 |
| 4 | 7.69 | 38.46 | 1600 |
| 3 | 7.33 | 35.46 | 1674 |
| 2 | 6.92 | 25.56 | 1521 |


Los meses con mayor error suelen coincidir con la temporada de lluvias y el inicio del llenado, cuando los cambios son bruscos.


## Estabilidad por año (mejora del Random Forest vs persistencia, MAE global)

Como solo hay una partición de prueba (2020-06 a 2026-10), se revisa que la ventaja no dependa de un año en particular. 2020 y 2026 son años parciales.

| anio | 7 días (%) | 15 días (%) | 30 días (%) |
|---|---|---|---|
| 2020 | 39.6 | 37.1 | 35.2 |
| 2021 | 40.9 | 37.9 | 45.7 |
| 2022 | 52.6 | 49.4 | 46.6 |
| 2023 | 47.2 | 40.3 | 32.4 |
| 2024 | 49.4 | 49.8 | 51.2 |
| 2025 | 57.5 | 53.4 | 58.6 |
| 2026 | 51.0 | 42.0 | 31.7 |


Años/horizontes donde el RF no supera a persistencia: ninguno.


## Limitaciones

- Un solo modelo para 9 presas de tamaños muy distintos; se normaliza por capacidad, pero el error absoluto en hm3 sigue dominado por las presas grandes (p. ej. INFMC).
- Lluvia: se usa precipitación observada (no pronóstico), por lo que el modelo no anticipa tormentas futuras.
- No se modelan extracciones ni aportaciones de forma explícita.
- Los eventos extremos (ciclones, apertura de compuertas) están poco representados y generan los mayores errores.
- Una sola partición cronológica de prueba y 3 pliegues de validación; la estabilidad por año se reporta arriba como verificación adicional.
- El intervalo se calibra con un tramo reciente de entrenamiento; puede no cubrir bien periodos con comportamiento distinto.
- Es una herramienta de apoyo a la decisión, no un sistema certificado de seguridad de presas.