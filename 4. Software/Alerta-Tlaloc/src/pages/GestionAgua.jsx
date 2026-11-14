import React, { useState, useEffect } from 'react'
import './GestionAgua.css'

const API_URL = 'http://localhost:8000/api/gestion-agua'

const GestionAgua = () => {
  const [activeTab, setActiveTab] = useState('enVivo')
  const [simulationMode, setSimulationMode] = useState(false)

  // Lista completa de presas y presa actualmente seleccionada
  const [sectors, setSectors] = useState([])
  const [selectedClaveSih, setSelectedClaveSih] = useState(null)
  const [selectedPresa, setSelectedPresa] = useState(null)
  const [historialPresa, setHistorialPresa] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [loadingSectors, setLoadingSectors] = useState(true)
  const [loadingSelected, setLoadingSelected] = useState(false)
  const [apiError, setApiError] = useState('')

  const [demandIncrease, setDemandIncrease] = useState(25)
  const [pressureRestriction, setPressureRestriction] = useState(1.8)

  // 1. Obtener la lista completa de presas y la bitácora al entrar al componente.
  useEffect(() => {
    const controller = new AbortController()

    async function fetchGestionData() {
      setLoadingSectors(true)
      setApiError('')

      try {
        const response = await fetch(API_URL, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}: no se pudo cargar la gestión del agua.`)
        }

        const data = await response.json()
        const lista = Array.isArray(data.sectors) ? data.sectors : []

        setSectors(lista)
        setAuditLog(Array.isArray(data.auditLog) ? data.auditLog : [])

        // Seleccionar la primera presa disponible. El efecto siguiente pedirá su último registro.
        if (lista.length > 0) {
          setSelectedClaveSih(lista[0].clave_sih)
        } else {
          setSelectedClaveSih(null)
          setSelectedPresa(null)
          setHistorialPresa([])
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error al conectar con la API de gestión de agua:', error)
          setApiError(error.message || 'No fue posible conectar con el servidor.')
        }
      } finally {
        if (!controller.signal.aborted) setLoadingSectors(false)
      }
    }

    fetchGestionData()
    return () => controller.abort()
  }, [])

  // 2. Cada vez que cambia la presa seleccionada, pedir su último registro a FastAPI.
  // 2. Cada vez que cambia la presa seleccionada, pedir su último registro a FastAPI.
  useEffect(() => {
    if (selectedClaveSih === null || selectedClaveSih === undefined || selectedClaveSih === '') {
      setSelectedPresa(null)
      setHistorialPresa([])
      return
    }

    const controller = new AbortController()

    async function fetchSelectedPresa() {
      setLoadingSelected(true)
      setSelectedPresa(null)
      setHistorialPresa([])

      try {
        const url = `${API_URL}?clave_sih=${encodeURIComponent(selectedClaveSih)}`
        const response = await fetch(url, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}: no se pudo obtener el registro de la presa.`)
        }

        const data = await response.json()
        
        // Guardamos correctamente el último registro individual y el historial
        setSelectedPresa(data.selectedPresa || null)
        setHistorialPresa(Array.isArray(data.historial) ? data.historial : [])

        // Mantener sincronizada la bitácora si viene en la respuesta
        if (Array.isArray(data.auditLog)) setAuditLog(data.auditLog)
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error al consultar el último registro de la presa:', error)
          setApiError(error.message || 'No fue posible obtener el registro seleccionado.')
        }
      } finally {
        if (!controller.signal.aborted) setLoadingSelected(false)
      }
    }

    fetchSelectedPresa()
    return () => controller.abort()
  }, [selectedClaveSih])

  const selectedSector = sectors.find(
    (sector) => String(sector.clave_sih) === String(selectedClaveSih)
  ) || sectors[0] || {
    name: 'Sin presas disponibles',
    clave_sih: null,
    llenado_pct: 0,
    flow: 0,
    status: 'SIN DATOS',
    valveType: '-',
    condition: '-',
  }

  // El registro individual tiene prioridad sobre los datos resumidos de la lista.
  const llenadoActual = selectedPresa?.llenado_pct ?? selectedSector.llenado_pct
// Priorizamos las diferentes variantes de nombres de volumen que puede mandar la API
  // Forzamos a que busque 'vol_hoy' primero, luego 'flow' en cualquiera de los dos objetos
  const volumenActual = selectedPresa?.vol_hoy ?? selectedSector?.vol_hoy ?? selectedSector?.flow ?? 0
  const lluviaActual = selectedPresa?.lluvia_1d ?? selectedSector?.lluvia_1d ?? 0
  const fechaActualizacion = selectedPresa?.fecha ?? selectedSector.ultima_actualizacion

  const formatDate = (value) => {
    if (!value) return 'Sin fecha disponible'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  // =========================================
  // REGISTRO DE ACCIONES LOCALES DE SIMULACIÓN
  // =========================================
  const addAuditLog = (action) => {
    const now = new Date()
    const timeStr = now.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    setAuditLog((previous) => [
      { time: timeStr, action, user: 'admin' },
      ...previous,
    ])
  }

  // =========================================
  // SELECCIONAR PRESA
  // =========================================
  const selectSector = (sector) => {
    if (sector.clave_sih === null || sector.clave_sih === undefined) {
      console.error('La presa seleccionada no contiene clave_sih:', sector)
      return
    }

    setSelectedClaveSih(sector.clave_sih)
    setApiError('')
    setActiveTab('enVivo')
  }

  // =========================================
  // CAMBIAR ESTADO DE VÁLVULA (SOLO SIMULACIÓN)
  // =========================================
  const toggleValve = () => {
    if (!simulationMode) {
      alert('Activa el Modo Simulación para realizar cambios de válvulas.')
      return
    }

    const newStatus = selectedSector.status === 'ABIERTA' ? 'CERRADA' : 'ABIERTA'

    setSectors((previous) => previous.map((sector) =>
      String(sector.clave_sih) === String(selectedClaveSih)
        ? { ...sector, status: newStatus }
        : sector
    ))

    addAuditLog(`Cambio simulado de estado (${selectedSector.name}): ${newStatus}`)
  }

  // =========================================
  // CIERRE DE EMERGENCIA (SOLO SIMULACIÓN)
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

    setSectors((previous) => previous.map((sector) =>
      String(sector.clave_sih) === String(selectedClaveSih)
        ? { ...sector, status: 'CERRADA' }
        : sector
    ))

    addAuditLog(`Cierre de emergencia simulado (${selectedSector.name})`)
  }

  // =========================================
  // AJUSTE DE VOLUMEN (SOLO SIMULACIÓN)
  // =========================================
  const adjustFlow = () => {
    if (!simulationMode) {
      alert('Activa el Modo Simulación para probar el ajuste de caudal.')
      return
    }

    const currentVolume = Number(volumenActual) || 0
    const newVolume = Math.max(0, Number((currentVolume * 0.9).toFixed(2)))

    setSectors((previous) => previous.map((sector) =>
      String(sector.clave_sih) === String(selectedClaveSih)
        ? { ...sector, flow: newVolume }
        : sector
    ))

    addAuditLog(`Ajuste simulado de volumen (${selectedSector.name}): ${newVolume} hm³`)
  }

  // =========================================
  // RESULTADOS DEL SIMULADOR (ILUSTRATIVOS)
  // =========================================
  const volumenBase = Number(volumenActual) || 0
  const projectedFlow = (volumenBase * (1 + demandIncrease / 100)).toFixed(2)
  const projectedDeficit = (volumenBase * (demandIncrease / 100)).toFixed(2)

  const saturationRisk = pressureRestriction < 2
    ? 'Alto'
    : pressureRestriction < 3
      ? 'Moderado'
      : 'Bajo'

  const saturationClass = saturationRisk === 'Alto'
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
            <h3>Red Hidrográfica y Presas</h3>
          </div>
          <span className="live-indicator">● Monitoreo Activo</span>
        </div>

        {apiError && <p className="simulation-notice">{apiError}</p>}

        <div className="interactive-map-wrapper">
          <div className="schematic-map">
            <div className="map-central-node">
              <span>◉</span>
              <strong>Red hidrográfica</strong>
              <small>{sectors.length} presas registradas</small>
            </div>

            {loadingSectors && <p className="map-empty-state">Cargando presas...</p>}

            {!loadingSectors && sectors.length === 0 && (
              <p className="map-empty-state">No se encontraron presas en la base de datos.</p>
            )}

            <div className="map-nodes-grid">
              {sectors.map((sector) => {
                const isSelected = String(selectedClaveSih) === String(sector.clave_sih)

                return (
                  <button
                    key={sector.clave_sih ?? sector.name}
                    type="button"
                    className={`map-node-card ${isSelected ? 'active' : ''}`}
                    onClick={() => selectSector(sector)}
                    aria-pressed={isSelected}
                  >
                    <span className="map-node-card-icon">⌖</span>
                    <span className="map-node-card-name">{sector.name}</span>
                    <small>Clave SIH: {sector.clave_sih}</small>
                    <span className="map-node-card-level">
                      {Number(sector.llenado_pct || 0).toFixed(1)}% de llenado
                    </span>
                    <span className="map-node-card-date">
                      {formatDate(sector.ultima_actualizacion)}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="map-legend">
              <span><i className="legend-dot blue" /> Presa seleccionada</span>
              <span><i className="legend-dot green" /> Presa disponible</span>
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
          <button type="button" className={`tab-btn ${activeTab === 'enVivo' ? 'active' : ''}`} onClick={() => setActiveTab('enVivo')}>
            EN VIVO
          </button>
          <button type="button" className={`tab-btn ${activeTab === 'simulador' ? 'active' : ''}`} onClick={() => setActiveTab('simulador')}>
            SIMULADOR
          </button>
          <button type="button" className={`tab-btn ${activeTab === 'zonas' ? 'active' : ''}`} onClick={() => setActiveTab('zonas')}>
            ZONAS
          </button>
        </div>

        {/* PESTAÑA EN VIVO */}
        {activeTab === 'enVivo' && (
          <div className="tab-content-card animate-fade">
            <div className="sector-header-info">
              <div>
                <span className="panel-title-tag">PRESA SELECCIONADA</span>
                <h3>{selectedSector.name}</h3>
                <small>Clave SIH: {selectedSector.clave_sih ?? 'No disponible'}</small>
              </div>
              <span className={`status-badge ${selectedSector.status === 'ABIERTA' ? 'open' : 'closed'}`}>
                {selectedSector.status}
              </span>
            </div>

            {loadingSelected && <p className="simulation-notice">Consultando último registro...</p>}
            {!loadingSelected && selectedClaveSih !== null && !selectedPresa && (
              <p className="simulation-notice">No se encontró un registro para esta presa.</p>
            )}

            <div className="metrics-grid-compact">
              <div className="metric-box">
                <span className="metric-label">Nivel de llenado</span>
                <strong className="metric-val">
                  {llenadoActual === null || llenadoActual === undefined ? '—' : `${Number(llenadoActual).toFixed(1)}%`}
                </strong>
                <div className="gauge-mock">
                  <div className="gauge-fill" style={{ width: `${Math.min(Math.max(Number(llenadoActual) || 0, 0), 100)}%` }} />
                </div>
                <span className="metric-caption">Porcentaje de llenado registrado</span>
              </div>

                <div className="metric-box">
                  <span className="metric-label">Volumen de hoy</span>

                  <strong className="metric-val">
                    {volumenActual === null || volumenActual === undefined || volumenActual === '' || !Number.isFinite(Number(volumenActual)) 
                    ? '—' 
                    : `${Number(volumenActual).toFixed(2)} hm³`}
                  </strong>

                  <div className="bar-bars-mock">
                    {[35, 65, 50, 90, 70, 100].map((height, index) => (
                      <span key={index} style={{ height: `${height}%` }} />
                    ))}
                  </div>

                  <span className="metric-caption">
                    Último registro: {formatDate(fechaActualizacion)}
                  </span>
                </div>



              <div className="metric-box">
                <span className="metric-label">Lluvia acumulada (1 día)</span>
                    <strong className="metric-val">
                      {lluviaActual === null || lluviaActual === undefined || lluviaActual === '' || !Number.isFinite(Number(lluviaActual)) 
                                          ? '—' 
                                          : `${Number(lluviaActual).toFixed(2)} mm`}  
                </strong>
                <span className="metric-caption">Dato del último registro, si está disponible</span>
              </div>
            </div>

            <p className="metric-caption">Última actualización: {formatDate(fechaActualizacion)}</p>

            <section className="presa-history-section">
              <div className="presa-history-header">
                <div>
                  <span className="panel-title-tag">MONITOREO HISTÓRICO</span>
                  <h4>Últimos registros de {selectedSector.name}</h4>
                </div>
                <span>{historialPresa.length} lecturas</span>
              </div>

              {loadingSelected ? (
                <p className="simulation-notice">Cargando historial...</p>
              ) : historialPresa.length === 0 ? (
                <p className="simulation-notice">No hay historial disponible para esta presa.</p>
              ) : (
                <div className="presa-history-table-wrapper">
                  <table className="presa-history-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Llenado</th>
                        <th>Volumen (hm³)</th>
                        <th>Lluvia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialPresa.map((registro, index) => (
                        <tr key={`${registro.fecha || 'registro'}-${index}`}>
                          <td>{formatDate(registro.fecha)}</td>
                          <td>{registro.llenado_pct == null ? '—' : `${Number(registro.llenado_pct).toFixed(1)}%`}</td>
                          <td>{registro.vol_hoy == null ? '—' : Number(registro.vol_hoy).toFixed(2)}</td>
                          <td>{registro.lluvia_1d == null ? '—' : Number(registro.lluvia_1d).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="valve-control-row">
              <div>
                <span className="metric-label">Control de válvula</span>
                <strong>{selectedSector.valveType || 'No especificado'}</strong>
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
                  Ajuste de volumen (simulación)
                </button>
                <button type="button" className="action-sub-btn danger" onClick={emergencyClose}>
                  Cierre de emergencia (simulación)
                </button>
              </div>
              {!simulationMode && (
                <p className="simulation-notice">Activa el modo simulación para probar las operaciones. Estos cambios no modifican MongoDB.</p>
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
              <input type="range" min="0" max="100" step="5" value={demandIncrease} onChange={(event) => setDemandIncrease(Number(event.target.value))} />
              <div className="slider-limits"><span>0%</span><span>100%</span></div>
            </div>

            <div className="slider-group">
              <label>Restricción de presión maestra <strong>{pressureRestriction.toFixed(1)} bar</strong></label>
              <input type="range" min="1" max="5" step="0.1" value={pressureRestriction} onChange={(event) => setPressureRestriction(Number(event.target.value))} />
              <div className="slider-limits"><span>1 bar</span><span>5 bar</span></div>
            </div>

            <div className="simulation-result-box">
              <span className="simulation-result-title">RESULTADOS PROYECTADOS</span>
              <div className="simulation-result-row"><span>Presa analizada</span><strong>{selectedSector.name}</strong></div>
              <div className="simulation-result-row"><span>Volumen proyectado</span><strong>{projectedFlow} hm³</strong></div>
              <div className="simulation-result-row"><span>Incremento estimado</span><strong>+{projectedDeficit} hm³</strong></div>
              <div className="simulation-result-row"><span>Riesgo estimado</span><strong className={saturationClass}>{saturationRisk}</strong></div>
              <p className="simulation-disclaimer">Modelo ilustrativo. No representa una predicción validada por Tláloc ML ni modifica los datos reales.</p>
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
              <h3>Lista de presas</h3>
            </div>

            <div className="zones-list-mini">
              {sectors.map((sector) => {
                const isSelected = String(selectedClaveSih) === String(sector.clave_sih)
                return (
                  <button
                    type="button"
                    key={sector.clave_sih ?? sector.name}
                    className={`zone-row ${isSelected ? 'zone-selected' : ''}`}
                    onClick={() => selectSector(sector)}
                  >
                    <span className="zone-info">
                      <strong>{sector.name}</strong>
                      <small>Clave: {sector.clave_sih} · Llenado: {Number(sector.llenado_pct || 0).toFixed(1)}%</small>
                    </span>
                    <span className={sector.condition === 'Óptimo' ? 'badge-ok' : 'badge-alert'}>
                      {sector.condition}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="zones-summary">
              <div>
                <span>Presas con estado abierto</span>
                <strong>{sectors.filter((sector) => sector.status === 'ABIERTA').length}</strong>
              </div>
              <div>
                <span>Presas con estado cerrado</span>
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
