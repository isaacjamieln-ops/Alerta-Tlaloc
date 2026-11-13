import React, { useState, useEffect } from 'react'
import './GestionAgua.css'

const GestionAgua = () => {
  const [activeTab, setActiveTab] = useState('enVivo')
  const [simulationMode, setSimulationMode] = useState(false)

  // Estados iniciales vacíos o respaldos seguros
  const [sectors, setSectors] = useState([])
  const [selectedSectorName, setSelectedSectorName] = useState('Sector Sur')
  const [auditLog, setAuditLog] = useState([])

  const [demandIncrease, setDemandIncrease] = useState(25)
  const [pressureRestriction, setPressureRestriction] = useState(1.8)

  // =========================================
  // PETICIÓN A LA API DE FASTAPI
  // =========================================
  useEffect(() => {
    async function fetchGestionData() {
      try {
        const response = await fetch('http://localhost:8000/api/gestion-agua');
        const data = await response.json();

        if (data.sectors && data.sectors.length > 0) {
          setSectors(data.sectors);
          // Aseguramos que el sector seleccionado por defecto exista
          setSelectedSectorName(data.sectors[0].name);
        }

        if (data.auditLog) {
          setAuditLog(data.auditLog);
        }
      } catch (error) {
        console.error("Error al conectar con la API de gestión de agua:", error);
      }
    }

    fetchGestionData();
  }, []);

  const selectedSector = sectors.find(
    (sector) => sector.name === selectedSectorName
  ) || sectors[0] || { name: 'Cargando...', pressure: 0, flow: 0, status: 'ABIERTA', valveType: '-', condition: '-' }

  // =========================================
  // REGISTRO DE ACCIONES
  // =========================================
  const addAuditLog = (action) => {
    const now = new Date()
    const timeStr = now.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    setAuditLog((previous) => [
      {
        time: timeStr,
        action,
        user: 'admin',
      },
      ...previous,
    ])
  }

  // =========================================
  // SELECCIONAR SECTOR
  // =========================================
  const selectSector = (sector) => {
    setSelectedSectorName(sector.name)
  }

  // =========================================
  // CAMBIAR ESTADO DE VÁLVULA
  // =========================================
  const toggleValve = () => {
    if (!simulationMode) {
      alert('Activa el Modo Simulación para realizar cambios de válvulas.')
      return
    }

    const newStatus =
      selectedSector.status === 'ABIERTA' ? 'CERRADA' : 'ABIERTA'

    setSectors((previous) =>
      previous.map((sector) =>
        sector.name === selectedSector.name
          ? { ...sector, status: newStatus }
          : sector
      )
    )

    addAuditLog(`Cambio de estado (${selectedSector.name}): ${newStatus}`)
  }

  // =========================================
  // CIERRE DE EMERGENCIA
  // =========================================
  const emergencyClose = () => {
    if (!simulationMode) {
      alert('Activa el Modo Simulación para ejecutar esta acción de prueba.')
      return
    }

    if (selectedSector.status === 'CERRADA') {
      alert('La válvula seleccionada ya está cerrada.')
      return
    }

    setSectors((previous) =>
      previous.map((sector) =>
        sector.name === selectedSector.name
          ? { ...sector, status: 'CERRADA' }
          : sector
      )
    )

    addAuditLog(`Cierre de emergencia (${selectedSector.name})`)
  }

  // =========================================
  // AJUSTE DE CAUDAL
  // =========================================
  const adjustFlow = () => {
    if (!simulationMode) {
      alert('Activa el Modo Simulación para probar el ajuste de caudal.')
      return
    }

    const newFlow = Math.max(
      0,
      Number((selectedSector.flow * 0.9).toFixed(1))
    )

    setSectors((previous) =>
      previous.map((sector) =>
        sector.name === selectedSector.name
          ? { ...sector, flow: newFlow }
          : sector
      )
    )

    addAuditLog(`Ajuste de caudal (${selectedSector.name}): ${newFlow} L/s`)
  }

  // =========================================
  // RESULTADOS DEL SIMULADOR
  // =========================================
  const projectedFlow = (
    selectedSector.flow * (1 + demandIncrease / 100)
  ).toFixed(1)

  const projectedDeficit = (
    selectedSector.flow * (demandIncrease / 100)
  ).toFixed(1)

  const saturationRisk =
    pressureRestriction < 2
      ? 'Alto'
      : pressureRestriction < 3
        ? 'Moderado'
        : 'Bajo'

  const saturationClass =
    saturationRisk === 'Alto'
      ? 'risk-high'
      : saturationRisk === 'Moderado'
        ? 'risk-medium'
        : 'risk-low'

  const resetSimulation = () => {
    setDemandIncrease(25)
    setPressureRestriction(1.8)
    addAuditLog('Restablecimiento de parámetros del simulador')
  }

  return (
    <main className="gestion-agua-container">

      {/* PANEL IZQUIERDO: RED HIDRÁULICA */}
      <section className="gestion-left-panel">
        <div className="map-card-header">
          <div>
            <span className="panel-title-tag">INFRAESTRUCTURA</span>
            <h3>Red Hidrográfica y Sectores</h3>
          </div>
          <span className="live-indicator">● Monitoreo Activo</span>
        </div>

        <div className="interactive-map-wrapper">
          <div className="schematic-map">
            <div className="map-connections">
              <div className="connection-line line-main" />
              <div className="connection-line line-north" />
              <div className="connection-line line-east" />
              <div className="connection-line line-south" />
              <div className="connection-line line-west" />
            </div>

            <div className="map-central-node">
              <span>◉</span>
              <strong>Centro de distribución</strong>
              <small>Red principal</small>
            </div>

            {sectors.map((sector) => {
              const positionClass = {
                'Sector Norte': 'north',
                'Sector Oriente': 'oriente',
                'Sector Sur': 'sur',
                'Sector Poniente': 'poniente',
              }[sector.name] || 'north'

              return (
                <button
                  key={sector.name}
                  type="button"
                  className={`map-node ${positionClass} ${
                    selectedSectorName === sector.name ? 'active' : ''
                  }`}
                  onClick={() => selectSector(sector)}
                  aria-pressed={selectedSectorName === sector.name}
                >
                  <span
                    className={`node-indicator ${
                      sector.status === 'ABIERTA' ? 'node-open' : 'node-closed'
                    }`}
                  />
                  {sector.name}
                  <small>{sector.status}</small>
                </button>
              )
            })}

            <div className="map-legend">
              <span><i className="legend-dot green" /> Abierta</span>
              <span><i className="legend-dot red" /> Cerrada</span>
              <span><i className="legend-dot blue" /> Seleccionada</span>
            </div>
          </div>
        </div>

        {/* BITÁCORA */}
        <div className="audit-log-section">
          <div className="audit-header">
            <h4>BITÁCORA DE ACCIONES OPERATIVAS</h4>
            <span>{auditLog.length} registros</span>
          </div>

          <div className="audit-log-list">
            {auditLog.map((log, index) => (
              <div key={`${log.time}-${index}`} className="audit-log-item">
                <span className="log-time">{log.time}</span>
                <span className="log-action">{log.action}</span>
                <span className="log-user">Usuario: {log.user}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PANEL DERECHO: CONTROL */}
      <section className="gestion-right-panel">
        <div className="right-panel-top-bar">
          <span className="panel-title-tag">PANEL DE CONTROL INTEGRADO</span>

          <label className="simulation-switch-wrapper">
            <span>{simulationMode ? 'Simulación activa' : 'Modo simulación'}</span>
            <input
              type="checkbox"
              checked={simulationMode}
              onChange={(event) => setSimulationMode(event.target.checked)}
            />
            <span className="custom-switch" />
          </label>
        </div>

        {/* PESTAÑAS */}
        <div className="control-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'enVivo' ? 'active' : ''}`}
            onClick={() => setActiveTab('enVivo')}
          >
            EN VIVO
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'simulador' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulador')}
          >
            SIMULADOR
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'zonas' ? 'active' : ''}`}
            onClick={() => setActiveTab('zonas')}
          >
            ZONAS
          </button>
        </div>

        {/* PESTAÑA EN VIVO */}
        {activeTab === 'enVivo' && (
          <div className="tab-content-card animate-fade">
            <div className="sector-header-info">
              <div>
                <span className="panel-title-tag">SECTOR SELECCIONADO</span>
                <h3>{selectedSector.name}</h3>
              </div>
              <span className={`status-badge ${selectedSector.status === 'ABIERTA' ? 'open' : 'closed'}`}>
                {selectedSector.status}
              </span>
            </div>

            <div className="metrics-grid-compact">
              <div className="metric-box">
                <span className="metric-label">Presión del sector</span>
                <strong className="metric-val">{Number(selectedSector.pressure || 0).toFixed(1)} bar</strong>
                <div className="gauge-mock">
                  <div
                    className="gauge-fill"
                    style={{
                      width: `${Math.min(((selectedSector.pressure || 0) / 6) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="metric-caption">Escala visual de 0 a 6 bar</span>
              </div>

              <div className="metric-box">
                <span className="metric-label">Caudal instantáneo</span>
                <strong className="metric-val">{selectedSector.flow} L/s</strong>
                <div className="bar-bars-mock">
                  {[35, 65, 50, 90, 70, 100].map((height, index) => (
                    <span key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <span className="metric-caption">Lectura demostrativa</span>
              </div>
            </div>

            <div className="valve-control-row">
              <div>
                <span className="metric-label">Control de válvula</span>
                <strong>{selectedSector.valveType}</strong>
              </div>
              <button
                type="button"
                className={`valve-toggle-btn ${selectedSector.status === 'ABIERTA' ? 'abierta' : 'cerrada'}`}
                onClick={toggleValve}
              >
                {selectedSector.status === 'ABIERTA' ? 'Cerrar válvula' : 'Abrir válvula'}
              </button>
            </div>

            <div className="quick-actions-section">
              <h4>Acciones rápidas</h4>
              <div className="actions-buttons-grid">
                <button type="button" className="action-sub-btn" onClick={adjustFlow}>
                  Ajuste de caudal
                </button>
                <button type="button" className="action-sub-btn danger" onClick={emergencyClose}>
                  Cierre de emergencia
                </button>
              </div>
              {!simulationMode && (
                <p className="simulation-notice">Activa el modo simulación para probar las operaciones.</p>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA SIMULADOR */}
        {activeTab === 'simulador' && (
          <div className="tab-content-card animate-fade">
            <div>
              <span className="panel-title-tag">ENTORNO DE PRUEBAS</span>
              <h3>Caja de Arena - Tláloc ML</h3>
              <p className="sim-desc">Explora cómo los cambios de demanda y presión pueden afectar la distribución del agua.</p>
            </div>

            <div className="slider-group">
              <label>Incremento de demanda <strong>+{demandIncrease}%</strong></label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={demandIncrease}
                onChange={(event) => setDemandIncrease(Number(event.target.value))}
              />
              <div className="slider-limits"><span>0%</span><span>100%</span></div>
            </div>

            <div className="slider-group">
              <label>Restricción de presión maestra <strong>{pressureRestriction.toFixed(1)} bar</strong></label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={pressureRestriction}
                onChange={(event) => setPressureRestriction(Number(event.target.value))}
              />
              <div className="slider-limits"><span>1 bar</span><span>5 bar</span></div>
            </div>

            <div className="simulation-result-box">
              <span className="simulation-result-title">RESULTADOS PROYECTADOS</span>
              <div className="simulation-result-row"><span>Sector analizado</span><strong>{selectedSector.name}</strong></div>
              <div className="simulation-result-row"><span>Caudal proyectado</span><strong>{projectedFlow} L/s</strong></div>
              <div className="simulation-result-row"><span>Incremento de demanda</span><strong>+{projectedDeficit} L/s</strong></div>
              <div className="simulation-result-row"><span>Riesgo estimado</span><strong className={saturationClass}>{saturationRisk}</strong></div>
              <p className="simulation-disclaimer">Modelo ilustrativo. No representa una predicción validada por Tláloc ML.</p>
            </div>

            <button type="button" className="action-sub-btn reset-btn" onClick={resetSimulation}>
              Restablecer parámetros
            </button>
          </div>
        )}

        {/* PESTAÑA ZONAS */}
        {activeTab === 'zonas' && (
          <div className="tab-content-card animate-fade">
            <div>
              <span className="panel-title-tag">DISTRIBUCIÓN HIDRÁULICA</span>
              <h3>Matriz de distribución por zonas</h3>
            </div>

            <div className="zones-list-mini">
              {sectors.map((sector) => (
                <button
                  type="button"
                  key={sector.name}
                  className={`zone-row ${selectedSectorName === sector.name ? 'zone-selected' : ''}`}
                  onClick={() => {
                    selectSector(sector)
                    setActiveTab('enVivo')
                  }}
                >
                  <span className="zone-info">
                    <strong>{sector.name}</strong>
                    <small>{sector.flow} L/s · {Number(sector.pressure || 0).toFixed(1)} bar</small>
                  </span>
                  <span className={sector.condition === 'Óptimo' ? 'badge-ok' : 'badge-alert'}>
                    {sector.condition}
                  </span>
                </button>
              ))}
            </div>

            <div className="zones-summary">
              <div>
                <span>Sectores abiertos</span>
                <strong>{sectors.filter((sector) => sector.status === 'ABIERTA').length}</strong>
              </div>
              <div>
                <span>Sectores cerrados</span>
                <strong>{sectors.filter((sector) => sector.status === 'CERRADA').length}</strong>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default GestionAgua