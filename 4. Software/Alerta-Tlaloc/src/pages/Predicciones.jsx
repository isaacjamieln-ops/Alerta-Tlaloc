import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

export default function Predicciones() {
  const [horizonte, setHorizonte] = useState('7d');
  const [modoMapa, setModoMapa] = useState('prediccion');
  const [accionesCompletadas, setAccionesCompletadas] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;

    async function fetchPredicciones() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/predicciones?horizonte=${horizonte}`);
        if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
        const json = await res.json();
        if (!cancelado) {
          setData(json);
        }
      } catch (err) {
        if (!cancelado) {
          setError(err.message);
        }
      } finally {
        if (!cancelado) {
          setLoading(false);
        }
      }
    }

    fetchPredicciones();
    return () => {
      cancelado = true;
    };
  }, [horizonte]);

  const marcarAccion = (id) => {
    if (!accionesCompletadas.includes(id)) {
      setAccionesCompletadas([...accionesCompletadas, id]);
    }
  };

  // Cálculo dinámico de coordenadas SVG para la gráfica comparativa (Real vs Proyección ML)
  const svgPoints = useMemo(() => {
    const actual = data?.grafica?.actual || [];
    const proyectada = data?.grafica?.proyectada || [];
    if (actual.length === 0) {
      return { realPts: '', predPts: '', bandPts: '' };
    }

    const todosValores = [
      ...actual.map((d) => d.valor),
      ...proyectada.map((d) => d.valor),
    ];
    const maxVal = Math.max(...todosValores, 1);
    const minVal = Math.min(...todosValores, 0);
    const rango = maxVal - minVal || 1;

    const mapY = (v) => 140 - ((v - minVal) / rango) * 105;
    const stepX = actual.length > 1 ? 280 / (actual.length - 1) : 140;

    const ptsReal = actual.map((d, i) => `${25 + i * stepX},${mapY(d.valor).toFixed(1)}`);
    const ptsPred = proyectada.map((d, i) => `${25 + i * stepX},${mapY(d.valor).toFixed(1)}`);

    const upperBand = proyectada.map(
      (d, i) => `${25 + i * stepX},${Math.max(15, mapY(d.valor) - 12).toFixed(1)}`
    );
    const lowerBand = [...proyectada]
      .reverse()
      .map(
        (d, i) =>
          `${25 + (proyectada.length - 1 - i) * stepX},${Math.min(148, mapY(d.valor) + 12).toFixed(1)}`
      );

    return {
      realPts: ptsReal.join(' '),
      predPts: ptsPred.join(' '),
      bandPts: [...upperBand, ...lowerBand].join(' '),
    };
  }, [data]);

  const kpis = data?.kpis || {};
  const sensores = data?.sensores || [];
  const factoresImpacto = data?.factoresImpacto || [];
  const accionesSugeridas = data?.accionesSugeridas || [];

  return (
    <div className="dashboard-page">
      {/* 1. ENCABEZADO */}
      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">INTELIGENCIA HÍDRICA Y MODELOS ML</span>
          <h1>Predicciones del Sistema</h1>
          <p>Análisis predictivo avanzado para la anticipación de eventos y riesgos en la red.</p>
        </div>
        <div className="dashboard-demo">
          <span className="demo-indicator" />
          <span>{loading ? 'Sincronizando modelo...' : 'Modelo Activo: Tlaloc-ML (Atlas)'}</span>
        </div>
      </header>

      {/* 2. FILTRO DE HORIZONTE DE PREDICCIÓN (7, 15 y 30 DÍAS) */}
      <section className="dashboard-period">
        <div>
          <span className="section-label">HORIZONTE DE PREDICCIÓN</span>
          <p>Selecciona el intervalo de tiempo para evaluar la proyección del modelo.</p>
        </div>
        <div className="range-selector">
          {[
            { id: '7d', label: '7 días' },
            { id: '15d', label: '15 días' },
            { id: '30d', label: '30 días' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setHorizonte(item.id)}
              className={horizonte === item.id ? 'active' : ''}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="dashboard-card" style={{ borderColor: '#ef4444', color: '#fca5a5', marginBottom: '16px' }}>
          Error al cargar predicciones: {error}
        </div>
      )}

      {/* 3. INDICADORES KPI PREDICTIVOS */}
      <section className="dashboard-kpis">
        {/* KPI 1 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Riesgo de Anomalía</span>
            <div className="kpi-icon alarm-icon">!</div>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '20px', color: kpis.riesgoColor || '#34d399' }}>
              {loading ? '...' : kpis.riesgoTexto || '—'}
            </div>
            <p className="kpi-description">
              Probabilidad de variación crítica {kpis.probabilidadFalla ?? 0}% en los próximos {horizonte}.
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Pico Estimado</span>
            <div className="kpi-icon water-icon">
              <svg className="water-drop-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="kpi-value">
              {loading ? '...' : kpis.picoEstimado ?? '0.00'} <small>hm³</small>
            </div>
            <p className="kpi-description">Confianza del modelo predictivo: {kpis.confianzaModelo ?? 0}%</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Alertas Previas</span>
            <div className="kpi-icon sensor-icon">i</div>
          </div>
          <div>
            <div className="kpi-value">
              {loading ? '...' : kpis.alertasPrevias ?? 0} <small>Presas</small>
            </div>
            <p className="kpi-description">
              {kpis.alertasPrevias > 0
                ? 'Requiere monitoreo preventivo en presas alertadas.'
                : 'Todas las presas dentro de rango operativo.'}
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Estabilidad Red</span>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#16c79a' }}>
              {loading ? '...' : kpis.estabilidadRed ?? '0'} <small>%</small>
            </div>
            <p className="kpi-description">Comportamiento estimado a {horizonte}.</p>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Estado Global</span>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '22px', color: kpis.estadoColor || '#36c5e5' }}>
              {loading ? '...' : kpis.estadoGlobal || '—'}
            </div>
            <p className="kpi-description">Proyección general del sistema hídrico.</p>
          </div>
        </div>
      </section>

      {/* 4. DISTRIBUCIÓN MEDIA: MAPA Y GRÁFICA */}
      <section className="dashboard-middle">
        {/* MAPA PREDICTIVO DE PRESAS */}
        <div className="dashboard-card location-map-container">
          <div className="panel-header">
            <div>
              <span className="section-label">MAPA ESPACIAL</span>
              <h2>Simulación de Presas</h2>
              <p>Estatus proyectado a {horizonte} según modelo predictivo.</p>
            </div>
            <div className="map-filters">
              <button
                onClick={() => setModoMapa('realtime')}
                className={modoMapa === 'realtime' ? 'active' : ''}
              >
                Actual
              </button>
              <button
                onClick={() => setModoMapa('prediccion')}
                className={modoMapa === 'prediccion' ? 'active' : ''}
              >
                Predicción ({horizonte})
              </button>
            </div>
          </div>

          <div className="location-map">
            <div className="map-content">
              <div className="map-street street-one" />
              <div className="map-street street-two" />
              <div className="map-street street-three" />
              <div className="map-street street-four" />

              <span className="map-label map-label-one">Cuenca Norte</span>
              <span className="map-label map-label-two">Sistema Central</span>
              <span className="map-label map-label-three">Cuenca Sur</span>

              {sensores.map((sensor) => {
                const claseEstado = modoMapa === 'realtime' ? 'online' : sensor.status;
                const infoTooltip =
                  modoMapa === 'realtime'
                    ? `${sensor.name}: ${sensor.vol_hoy} hm³ (Actual)`
                    : `${sensor.name}: ${sensor.vol_pred} hm³ (${sensor.desc})`;

                return (
                  <div
                    key={sensor.id}
                    className={`map-marker ${claseEstado}`}
                    style={{ left: `${sensor.x}%`, top: `${sensor.y}%` }}
                    title={infoTooltip}
                  >
                    <span />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="map-legend">
            <span><i className="online" /> Normal</span>
            <span><i className="warning" /> Alerta Predictiva</span>
            <span><i className="alarm" /> Alarma Activa</span>
            <span><i className="offline" /> Sin señal</span>
          </div>
        </div>

        {/* GRÁFICA DE PROYECCIÓN (TENDENCIA) */}
        <div className="dashboard-card">
          <div className="panel-header">
            <div>
              <span className="section-label">TENDENCIA POR PRESA</span>
              <h2>Proyección de Volumen</h2>
              <p>Volumen Actual vs. Estimación del Modelo ({horizonte})</p>
            </div>
            <span className="chart-period-label">Pico: {kpis.picoEstimado ?? 0} hm³</span>
          </div>

          <div className="consumption-chart">
            <svg viewBox="0 0 320 160">
              <line x1="25" y1="30" x2="310" y2="30" className="chart-grid-line" />
              <line x1="25" y1="70" x2="310" y2="70" className="chart-grid-line" />
              <line x1="25" y1="110" x2="310" y2="110" className="chart-grid-line" />
              <line x1="25" y1="145" x2="310" y2="145" className="chart-grid-line" />

              {svgPoints.bandPts && (
                <polygon points={svgPoints.bandPts} fill="rgba(192, 132, 252, 0.15)" />
              )}

              {svgPoints.realPts && (
                <polyline fill="none" stroke="#35c6e8" strokeWidth="2.5" points={svgPoints.realPts} />
              )}

              {svgPoints.predPts && (
                <polyline
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="2.5"
                  strokeDasharray="5,4"
                  points={svgPoints.predPts}
                />
              )}
            </svg>
          </div>

          <div className="chart-footer">
            <span><span className="chart-legend-dot" /> Volumen Actual</span>
            <span style={{ color: '#c084fc' }}>-- Proyección ML ({horizonte})</span>
            <span style={{ color: '#a78bfa' }}>Intervalo Confianza</span>
          </div>
        </div>
      </section>

      {/* 5. DISTRIBUCIÓN INFERIOR: EXPLICABILIDAD Y ACCIONES */}
      <section className="dashboard-bottom" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {/* EXPLICABILIDAD DEL MODELO (XAI) */}
        <div className="dashboard-card">
          <div className="panel-header">
            <div>
              <span className="section-label">INTERPRETADORA IA</span>
              <h2>Factores de Influencia (XAI)</h2>
              <p>Variables que determinan la predicción actual en la red.</p>
            </div>
          </div>

          <div className="installations-chart">
            <div className="trend-average-summary" style={{ marginBottom: '10px' }}>
              <span>Diagnóstico del Modelo:</span>
              <p style={{ margin: 0, color: '#e2ebf6' }}>
                Proyección calculada a <strong>{horizonte}</strong> con base en los registros recientes de MongoDB Atlas.
              </p>
            </div>

            {factoresImpacto.map((item, idx) => (
              <div className="installation-chart-item" key={idx}>
                <div className="installation-chart-heading">
                  <span>{item.factor}</span>
                  <strong>{item.nivel} ({item.porcentaje}%)</strong>
                </div>
                <div className="installation-chart-track">
                  <div
                    className="installation-chart-bar"
                    style={{
                      width: `${item.porcentaje}%`,
                      background:
                        item.claseColor === 'critical'
                          ? 'linear-gradient(90deg, #bd4949, #f06464)'
                          : 'linear-gradient(90deg, #238eae, #39c8e8)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACCIONES SUGERIDAS */}
        <div className="dashboard-card">
          <div className="panel-header">
            <div>
              <span className="section-label">RESPUESTA OPERATIVA</span>
              <h2>Acciones Sugeridas</h2>
              <p>Recomendaciones automáticas basadas en el comportamiento predictivo.</p>
            </div>
          </div>

          <div className="alerts-list">
            {accionesSugeridas.map((accion) => (
              <div className="alert-item" key={accion.id}>
                <div className={`alert-indicator ${accion.tipo}`}>
                  {accion.tipo === 'critical' ? '⚡' : '!'}
                </div>
                <div className="alert-content">
                  <strong>{accion.titulo}</strong>
                  <span>{accion.descripcion}</span>
                  <small>{accion.prioridad}</small>
                </div>
                <button
                  onClick={() => marcarAccion(accion.id)}
                  className="view-all-alarms"
                  style={{ width: 'auto', padding: '6px 12px', marginTop: 0 }}
                >
                  {accionesCompletadas.includes(accion.id) ? 'Completado' : accion.boton}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. PIE DE PÁGINA */}
      <footer className="dashboard-footer">
        <span>ALERTA-TLALOC SMART WATER MANAGEMENT</span>
        <span>Sistema de Monitoreo y Predicción Predictiva © 2026</span>
      </footer>
    </div>
  );
}