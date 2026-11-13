import React, { useState } from 'react';

export default function Predicciones() {
  const [horizonte, setHorizonte] = useState('4h');
  const [modoMapa, setModoMapa] = useState('prediccion');
  const [accionesCompletadas, setAccionesCompletadas] = useState([]);

  const sensores = [
    { id: 1, name: 'Sensor 01', location: 'Administración A', x: 28, y: 30, status: 'online', desc: 'Normal' },
    { id: 2, name: 'Sensor 02', location: 'Edificio principal', x: 45, y: 45, status: 'online', desc: 'Normal' },
    { id: 3, name: 'Sensor 03', location: 'Almacén', x: 62, y: 28, status: 'online', desc: 'Normal' },
    { id: 4, name: 'Sensor 04', location: 'Instalación B', x: 78, y: 40, status: 'warning', desc: 'Alerta Predictiva - Variación de flujo' },
    { id: 5, name: 'Sensor 05', location: 'Área tecnológica', x: 85, y: 65, status: 'online', desc: 'Normal' },
    { id: 6, name: 'Sensor 06', location: 'Administración A', x: 32, y: 70, status: 'online', desc: 'Normal' },
    { id: 7, name: 'Sensor 07', location: 'Edificio principal', x: 55, y: 75, status: 'alarm', desc: 'ALARMA PREDICTIVA ACTIVA' },
    { id: 8, name: 'Sensor 08', location: 'Almacén', x: 75, y: 82, status: 'offline', desc: 'Sin señal estimada' },
  ];

  const factoresImpacto = [
    { factor: 'Presión de red', porcentaje: 45, nivel: 'Alto', claseColor: 'critical' },
    { factor: 'Humedad ambiental', porcentaje: 30, nivel: 'Medio', claseColor: 'warning' },
    { factor: 'Temperatura', porcentaje: 15, nivel: 'Bajo', claseColor: 'online' },
    { factor: 'Flujo histórico', porcentaje: 10, nivel: 'Mínimo', claseColor: 'offline' },
  ];

  const marcarAccion = (id) => {
    if (!accionesCompletadas.includes(id)) {
      setAccionesCompletadas([...accionesCompletadas, id]);
    }
  };

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
          <span>Modelo Activo: Tlaloc-ML v2.4</span>
        </div>
      </header>

      {/* 2. FILTRO DE HORIZONTE DE PREDICCIÓN */}
      <section className="dashboard-period">
        <div>
          <span className="section-label">HORIZONTE DE PREDICCIÓN</span>
          <p>Selecciona el intervalo de tiempo para evaluar la proyección del modelo.</p>
        </div>
        <div className="range-selector">
          {['4h', '12h', '24h', '48h', '7d'].map((item) => (
            <button
              key={item}
              onClick={() => setHorizonte(item)}
              className={horizonte === item ? 'active' : ''}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {/* 3. INDICADORES KPI PREDICTIVOS */}
      <section className="dashboard-kpis">
        
        {/* KPI 1 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Riesgo de Anomalía</span>
            <div className="kpi-icon alarm-icon">!</div>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '20px', color: '#34d399' }}>
              BAJO / MOD.
            </div>
            <p className="kpi-description">Probabilidad de falla estructural 12% en las próximas {horizonte}.</p>
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
              42.8 <small>m³/h</small>
            </div>
            <p className="kpi-description">Confianza del modelo predictivo: 94.5%</p>
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
              2 <small>Zonas</small>
            </div>
            <p className="kpi-description">Requiere inspección preventiva en Sector Sur.</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Estabilidad Red</span>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#16c79a' }}>
              88.4 <small>%</small>
            </div>
            <p className="kpi-description">Comportamiento estable estimado.</p>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Estado Global</span>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '22px', color: '#36c5e5' }}>
              ÓPTIMO
            </div>
            <p className="kpi-description">Sin incidentes críticos proyectados.</p>
          </div>
        </div>

      </section>

      {/* 4. DISTRIBUCIÓN MEDIA: MAPA Y GRÁFICA */}
      <section className="dashboard-middle">
        
        {/* MAPA PREDICTIVO DE SENSORES */}
        <div className="dashboard-card location-map-container">
          <div className="panel-header">
            <div>
              <span className="section-label">MAPA ESPACIAL</span>
              <h2>Simulación de Sensores</h2>
              <p>Estatus proyectado a {horizonte} según modelo predictivo.</p>
            </div>
            <div className="map-filters">
              <button 
                onClick={() => setModoMapa('realtime')}
                className={modoMapa === 'realtime' ? 'active' : ''}
              >
                Tiempo Real
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

              <span className="map-label map-label-one">Planta Norte</span>
              <span className="map-label map-label-two">Edificio Central</span>
              <span className="map-label map-label-three">Depósito Sur</span>

              {sensores.map((sensor) => {
                let claseEstado = 'online';
                if (sensor.status === 'warning') claseEstado = 'warning';
                if (sensor.status === 'alarm') claseEstado = 'alarm';
                if (sensor.status === 'offline') claseEstado = 'offline';

                return (
                  <div
                    key={sensor.id}
                    className={`map-marker ${claseEstado}`}
                    style={{ left: `${sensor.x}%`, top: `${sensor.y}%` }}
                    title={`${sensor.name} - ${sensor.location} (${sensor.desc})`}
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
              <span className="section-label"> TENDENCIA</span>
              <h2>Proyección de Consumo</h2>
              <p>Histórico vs. Estimación del Modelo ML</p>
            </div>
            <span className="chart-period-label">Pico: 42.8 m³/h</span>
          </div>

          <div className="consumption-chart">
            <svg viewBox="0 0 320 160">
              <line x1="25" y1="30" x2="310" y2="30" className="chart-grid-line" />
              <line x1="25" y1="70" x2="310" y2="70" className="chart-grid-line" />
              <line x1="25" y1="110" x2="310" y2="110" className="chart-grid-line" />
              <line x1="25" y1="145" x2="310" y2="145" className="chart-grid-line" />

              {/* Banda de Confianza */}
              <polygon 
                points="150,90 190,55 230,25 270,40 310,75 310,115 270,75 230,60 190,95 150,90" 
                fill="rgba(192, 132, 252, 0.15)" 
              />

              {/* Línea Real */}
              <polyline fill="none" stroke="#35c6e8" strokeWidth="2.5" points="25,130 65,120 105,125 150,90" />
              
              {/* Línea Proyectada */}
              <polyline fill="none" stroke="#c084fc" strokeWidth="2.5" strokeDasharray="5,4" points="150,90 190,75 230,45 270,60 310,95" />

              <circle cx="150" cy="90" r="4" fill="#35c6e8" />
            </svg>
          </div>

          <div className="chart-footer">
            <span><span className="chart-legend-dot" /> Consumo Real</span>
            <span style={{ color: '#c084fc' }}>-- Proyección ML</span>
            <span style={{ color: '#a78bfa' }}>Intervalo Confianza (90%)</span>
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
                La alerta en <strong>Instalación B</strong> se debe principalmente a variaciones anómalas de presión y humedad registradas.
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
                      background: item.claseColor === 'critical' ? 'linear-gradient(90deg, #bd4949, #f06464)' : 'linear-gradient(90deg, #238eae, #39c8e8)'
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
            <div className="alert-item">
              <div className="alert-indicator warning">!</div>
              <div className="alert-content">
                <strong>Inspeccionar Sensor 04 (Instalación B)</strong>
                <span>Verificar niveles de presión antes del pico proyectado.</span>
                <small>Prioridad Media • Urgencia en {horizonte}</small>
              </div>
              <button 
                onClick={() => marcarAccion(1)}
                className="view-all-alarms"
                style={{ width: 'auto', padding: '6px 12px', marginTop: 0 }}
              >
                {accionesCompletadas.includes(1) ? 'Completado' : 'Aprobar'}
              </button>
            </div>

            <div className="alert-item">
              <div className="alert-indicator critical">⚡</div>
              <div className="alert-content">
                <strong>Ajustar Válvula de Sector Norte</strong>
                <span>Mitigación automática recomendada para evitar sobrecarga.</span>
                <small>Prioridad Alta • Preventivo</small>
              </div>
              <button 
                onClick={() => marcarAccion(2)}
                className="view-all-alarms"
                style={{ width: 'auto', padding: '6px 12px', marginTop: 0 }}
              >
                {accionesCompletadas.includes(2) ? 'Completado' : 'Ejecutar'}
              </button>
            </div>
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