import React, { useState } from 'react';
import './Predicciones.css';

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
    { factor: 'Presión de red', porcentaje: 45, nivel: 'Alto', color: '#22d3ee' },
    { factor: 'Humedad ambiental', porcentaje: 30, nivel: 'Medio', color: '#2dd4bf' },
    { factor: 'Temperatura', porcentaje: 15, nivel: 'Bajo', color: '#34d399' },
    { factor: 'Flujo histórico', porcentaje: 10, nivel: 'Mínimo', color: '#94a3b8' },
  ];

  const marcarAccion = (id) => {
    if (!accionesCompletadas.includes(id)) {
      setAccionesCompletadas([...accionesCompletadas, id]);
    }
  };

  return (
    <div className="container-fluid px-0 py-2 predicciones-container">
      
      {/* ENCABEZADO DE SECCIÓN */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 className="pred-title m-0" style={{ fontSize: '1.75rem' }}>Predicciones del Sistema</h2>
          <p className="pred-subtitle m-0">Modelos de Machine Learning y análisis predictivo para la anticipación de eventos.</p>
        </div>
        <div className="d-flex align-items-center gap-2 px-3 py-1.5 rounded-pill pred-card">
          <span className="spinner-grow spinner-grow-sm pred-cyan" role="status" />
          <span className="pred-cyan small fw-semibold">Modelo Activo: Tlaloc-ML v2.4</span>
        </div>
      </div>

      {/* SELECTOR DE HORIZONTE PREDICTIVO */}
      <div className="card pred-card p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <span className="pred-cyan small fw-bold tracking-wider" style={{ fontSize: '0.75rem' }}>HORIZONTE DE PREDICCIÓN</span>
            <p className="text-white m-0 fw-medium">Selecciona el intervalo de análisis proyectado.</p>
          </div>
          <div className="d-flex gap-2">
            {['4h', '12h', '24h', '48h', '7d'].map((item) => (
              <button
                key={item}
                onClick={() => setHorizonte(item)}
                className={`btn-horizonte ${horizonte === item ? 'active' : ''}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TARJETAS DE KPIs PREDICTIVOS */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-4">
          <div className="card pred-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <span className="pred-subtitle text-uppercase fw-semibold">Riesgo de Anomalía</span>
                <h3 className="pred-emerald fw-bold mt-1 mb-0">BAJO / MODERADO</h3>
              </div>
              <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>
                <i className="bi bi-shield-check fs-4" />
              </div>
            </div>
            <p className="pred-subtitle mt-3 mb-0">Probabilidad de falla estructural menor al 12% para las próximas {horizonte}.</p>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card pred-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <span className="pred-subtitle text-uppercase fw-semibold">Pico Estimado ({horizonte})</span>
                <h3 className="text-white fw-bold mt-1 mb-0">42.8 <span className="fs-6 fw-normal text-muted">m³/h</span></h3>
              </div>
              <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee' }}>
                <i className="bi bi-graph-up-arrow fs-4" />
              </div>
            </div>
            <p className="pred-cyan mt-3 mb-0 small">Confianza del modelo predictivo: 94.5%</p>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card pred-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <span className="pred-subtitle text-uppercase fw-semibold">Alertas Previas</span>
                <h3 className="pred-warning fw-bold mt-1 mb-0">2 <span className="fs-6 fw-normal text-muted">(Instalación B)</span></h3>
              </div>
              <div className="p-3 rounded-3" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                <i className="bi bi-exclamation-triangle fs-4" />
              </div>
            </div>
            <p className="pred-subtitle mt-3 mb-0">Requiere inspección preventiva en Sector Sur.</p>
          </div>
        </div>
      </div>

      {/* SECCIÓN PRINCIPAL: MAPA PREDICTIVO Y GRÁFICA */}
      <div className="row g-4 mb-4">
        
        {/* MAPA DE SENSORES */}
        <div className="col-12 col-xl-7">
          <div className="card pred-card p-4 h-100 d-flex flex-column">
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <div>
                <h5 className="pred-title m-0">Mapa Predictivo de Sensores</h5>
                <p className="pred-subtitle m-0">Simulación espacial de estatus proyectado a {horizonte}.</p>
              </div>
              <div className="btn-group p-1 rounded-3 pred-card-inner">
                <button 
                  onClick={() => setModoMapa('realtime')}
                  className={`btn btn-sm px-3 py-1 rounded-2 border-0 ${modoMapa === 'realtime' ? 'bg-info text-dark fw-bold' : 'text-muted'}`}
                  style={modoMapa === 'realtime' ? { backgroundColor: '#22d3ee', color: '#0a131a' } : { color: '#94a3b8' }}
                >
                  Tiempo Real
                </button>
                <button 
                  onClick={() => setModoMapa('prediccion')}
                  className={`btn btn-sm px-3 py-1 rounded-2 border-0 ${modoMapa === 'prediccion' ? 'bg-info text-dark fw-bold' : 'text-muted'}`}
                  style={modoMapa === 'prediccion' ? { backgroundColor: '#22d3ee', color: '#0a131a' } : { color: '#94a3b8' }}
                >
                  Predicción ({horizonte})
                </button>
              </div>
            </div>

            {/* Contenedor del Plano Visual */}
            <div className="pred-map-box flex-grow-1 p-3">
              <div className="position-absolute top-0 start-50 translate-middle-x mt-3 pred-map-badge shadow-sm">
                Planta Norte / Administración A
              </div>
              <div className="position-absolute bottom-0 start-50 translate-middle-x mb-3 pred-map-badge shadow-sm">
                Depósito Principal / Sector Sur
              </div>

              {sensores.map((sensor) => {
                let colorBadge = 'bg-success text-white';
                if (sensor.status === 'warning') colorBadge = 'bg-warning text-dark';
                if (sensor.status === 'alarm') colorBadge = 'bg-danger text-white';
                if (sensor.status === 'offline') colorBadge = 'bg-secondary text-light';

                return (
                  <div
                    key={sensor.id}
                    className="position-absolute translate-middle cursor-pointer"
                    style={{ left: `${sensor.x}%`, top: `${sensor.y}%` }}
                    title={`${sensor.name} - ${sensor.location} (${sensor.desc})`}
                  >
                    <div className={`rounded-circle d-flex align-items-center justify-center shadow-lg border border-light ${colorBadge}`} style={{ width: '30px', height: '30px', fontSize: '0.75rem' }}>
                      <i className={`bi ${sensor.status === 'online' ? 'bi-check-lg' : sensor.status === 'warning' ? 'bi-exclamation' : 'bi-shield-exclamation'}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="d-flex flex-wrap gap-4 mt-3 pred-subtitle small">
              <span className="d-flex align-items-center gap-1.5"><span className="rounded-circle bg-success d-inline-block" style={{ width: '10px', height: '10px' }} /> Normal</span>
              <span className="d-flex align-items-center gap-1.5"><span className="rounded-circle bg-warning d-inline-block" style={{ width: '10px', height: '10px' }} /> Alerta Predictiva</span>
              <span className="d-flex align-items-center gap-1.5"><span className="rounded-circle bg-danger d-inline-block" style={{ width: '10px', height: '10px' }} /> Alarma Activa</span>
            </div>
          </div>
        </div>

        {/* GRÁFICA DE TENDENCIA Y PROYECCIÓN */}
        <div className="col-12 col-xl-5">
          <div className="card pred-card p-4 h-100 d-flex flex-column justify-between">
            <div>
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 className="pred-title m-0">Proyección de Consumo</h5>
                  <p className="pred-subtitle m-0">Tendencia histórica vs. Modelo ML</p>
                </div>
                <span className="badge px-2.5 py-1.5 small" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', border: '1px solid #c084fc', color: '#c084fc' }}>
                  Pico: 42.8 m³/h
                </span>
              </div>

              <div className="p-3 rounded-4 pred-card-inner">
                <svg viewBox="0 0 320 160" className="w-100 h-auto" style={{ maxHeight: '180px' }}>
                  {[30, 70, 110, 145].map((y, i) => (
                    <line key={i} x1="25" y1={y} x2="310" y2={y} stroke="#334155" strokeWidth="1" />
                  ))}
                  
                  <polygon 
                    points="150,90 190,55 230,25 270,40 310,75 310,115 270,75 230,60 190,95 150,90" 
                    fill="rgba(168, 85, 247, 0.18)" 
                  />
                  
                  <polyline fill="none" stroke="#22d3ee" strokeWidth="2.5" points="25,130 65,120 105,125 150,90" />
                  <polyline fill="none" stroke="#c084fc" strokeWidth="2.5" strokeDasharray="5,4" points="150,90 190,75 230,45 270,60 310,95" />
                  
                  <circle cx="150" cy="90" r="4" fill="#22d3ee" />
                </svg>
              </div>
            </div>

            <div className="d-flex flex-column gap-2 mt-3 pt-3 border-top border-secondary pred-subtitle small">
              <div className="d-flex align-items-center gap-2">
                <span className="rounded-1 d-inline-block" style={{ width: '16px', height: '3px', backgroundColor: '#22d3ee' }} /> Datos Reales (Histórico)
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="rounded-1 d-inline-block border-top border-dashed" style={{ width: '16px', height: '3px', borderColor: '#c084fc' }} /> Proyección del Modelo
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="rounded-1 d-inline-block" style={{ width: '16px', height: '10px', backgroundColor: 'rgba(168, 85, 247, 0.3)' }} /> Intervalo de Confianza (90%)
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* FILA 3: EXPLICABILIDAD (XAI) Y ACCIONES SUGERIDAS */}
      <div className="row g-4">
        
        {/* EXPLICABILIDAD XAI */}
        <div className="col-12 col-xl-7">
          <div className="card pred-card p-4 h-100">
            <h5 className="pred-title mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-cpu pred-cyan" />
              Explicabilidad del Modelo (Factores XAI)
            </h5>
            
            <div className="row g-4 align-items-center">
              <div className="col-12 col-md-6">
                <div className="p-3 rounded-4 pred-card-inner h-100 d-flex flex-column justify-content-center">
                  <p className="pred-cyan small fw-semibold mb-2">Interpretación de la IA:</p>
                  <p className="text-light small m-0 lh-base">
                    La predicción de anomalía en el sector de la <strong>Instalación B</strong> se debe principalmente a fluctuaciones anómalas en la presión de red registradas durante las últimas 3 horas, correlacionadas con factores climáticos locales.
                  </p>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="d-flex flex-column gap-3">
                  {factoresImpacto.map((item, idx) => (
                    <div key={idx}>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="text-light">{item.factor}</span>
                        <span className="pred-subtitle">{item.nivel} ({item.porcentaje}%)</span>
                      </div>
                      <div className="progress pred-progress">
                        <div className="progress-bar rounded-pill" style={{ width: `${item.porcentaje}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES SUGERIDAS */}
        <div className="col-12 col-xl-5">
          <div className="card pred-card p-4 h-100 d-flex flex-column justify-between">
            <div>
              <h5 className="pred-title mb-3">Acciones Sugeridas</h5>
              
              <div className="d-flex flex-column gap-3">
                <div className="p-3 rounded-4 pred-card-inner d-flex align-items-center justify-content-between gap-3">
                  <div className="d-flex align-items-start gap-3">
                    <i className="bi bi-shield-exclamation pred-warning fs-5 mt-1" />
                    <div>
                      <p className="text-white fw-medium small mb-0">Inspeccionar Sensor 04</p>
                      <p className="pred-subtitle mb-0">Verificar presión en Instalación B.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => marcarAccion(1)}
                    className={`btn btn-sm px-3 rounded-pill fw-medium ${accionesCompletadas.includes(1) ? 'btn-success text-white' : ''}`}
                    style={accionesCompletadas.includes(1) ? { backgroundColor: '#10b981', border: 'none' } : { borderColor: '#22d3ee', color: '#22d3ee', backgroundColor: 'transparent' }}
                  >
                    {accionesCompletadas.includes(1) ? 'Completado' : 'Aprobar'}
                  </button>
                </div>

                <div className="p-3 rounded-4 pred-card-inner d-flex align-items-center justify-content-between gap-3">
                  <div className="d-flex align-items-start gap-3">
                    <i className="bi bi-sliders pred-cyan fs-5 mt-1" />
                    <div>
                      <p className="text-white fw-medium small mb-0">Ajustar Válvula de Sector</p>
                      <p className="pred-subtitle mb-0">Mitigar pico estimado en 24h.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => marcarAccion(2)}
                    className={`btn btn-sm px-3 rounded-pill fw-medium ${accionesCompletadas.includes(2) ? 'btn-success text-white' : ''}`}
                    style={accionesCompletadas.includes(2) ? { backgroundColor: '#10b981', border: 'none' } : { borderColor: '#334155', color: '#f8fafc', backgroundColor: 'transparent' }}
                  >
                    {accionesCompletadas.includes(2) ? 'Completado' : 'Detalles'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-top border-secondary text-end">
              <span className="pred-subtitle small">Sistema automatizado Alerta Tláloc</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}