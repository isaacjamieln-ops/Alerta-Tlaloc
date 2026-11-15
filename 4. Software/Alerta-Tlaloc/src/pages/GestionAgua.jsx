import React, { useState, useEffect } from 'react'
import './GestionAgua.css'

const API_URL = 'http://localhost:8000/api/gestion-agua'
const PREDICTIONS_URL = 'http://localhost:8000/api/predicciones'

const GestionAgua = () => {
  const [activeTab, setActiveTab] = useState('enVivo')

  // Lista completa de presas y presa actualmente seleccionada
  const [sectors, setSectors] = useState([])
  const [selectedClaveSih, setSelectedClaveSih] = useState(null)
  const [selectedPresa, setSelectedPresa] = useState(null)
  const [historialPresa, setHistorialPresa] = useState([])
  const [predicciones, setPredicciones] = useState({})
  const [loadingPredicciones, setLoadingPredicciones] = useState(false)
  const [predictionError, setPredictionError] = useState('')
  const [loadingSectors, setLoadingSectors] = useState(true)
  const [loadingSelected, setLoadingSelected] = useState(false)
  const [apiError, setApiError] = useState('')


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

  // Consultar los tres horizontes del modelo para la presa seleccionada.
  useEffect(() => {
    if (selectedClaveSih === null || selectedClaveSih === undefined || selectedClaveSih === '') {
      setPredicciones({})
      return
    }

    const controller = new AbortController()

    async function fetchPredicciones() {
      setLoadingPredicciones(true)
      setPredictionError('')
      setPredicciones({})

      try {
        const horizontes = ['7d', '15d', '30d']
        const respuestas = await Promise.all(horizontes.map(async (horizonte) => {
          const params = new URLSearchParams({
            horizonte,
            clave_sih: String(selectedClaveSih),
          })
          const response = await fetch(`${PREDICTIONS_URL}?${params.toString()}`, {
            signal: controller.signal,
          })
          if (!response.ok) {
            const detalle = await response.json().catch(() => ({}))
            throw new Error(detalle.detail || `Error HTTP ${response.status} al consultar ${horizonte}.`)
          }
          const data = await response.json()
          return [horizonte, data]
        }))

        if (!controller.signal.aborted) {
          setPredicciones(Object.fromEntries(respuestas))
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error al consultar predicciones:', error)
          setPredictionError(error.message || 'No fue posible obtener las predicciones.')
        }
      } finally {
        if (!controller.signal.aborted) setLoadingPredicciones(false)
      }
    }

    fetchPredicciones()
    return () => controller.abort()
  }, [selectedClaveSih])

  const obtenerPrediccion = (horizonte) => {
    const data = predicciones[horizonte]
    return data?.sensores?.find((sensor) => String(sensor.id) === String(selectedClaveSih))
      || data?.sensores?.[0]
      || null
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

      </section>

      {/* PANEL DERECHO: CONTROL */}
      <section className="gestion-right-panel">
        <div className="right-panel-top-bar">
          <span className="panel-title-tag">PANEL DE MONITOREO</span>
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

            

          </div>
        )}


{/* PESTAÑA SIMULADOR: DATO REAL Y PROYECCIÓN ML */}
{activeTab === 'simulador' && (
  <div className="tab-content-card animate-fade">

    <div className="simulator-heading">
      <span className="panel-title-tag">MONITOREO Y PREDICCIÓN</span>
      <h3>{selectedSector.name}</h3>
      <p className="sim-desc">
        Comparación del último dato registrado con las estimaciones
        generadas por Tláloc ML.
      </p>
    </div>

    {predictionError && (
      <p className="simulation-notice">{predictionError}</p>
    )}

    <div className="projection-container">

      {/* ENCABEZADO */}
      <div className="projection-header">
        <div>
          <div className="projection-title">
            Nivel de almacenamiento
          </div>
          <div className="projection-subtitle">
            Estado actual y estimación futura
          </div>
        </div>

        <span className="projection-label real">
          DATO REAL
        </span>
      </div>

      {loadingSelected ? (
        <p className="simulation-notice">
          Consultando último registro...
        </p>
      ) : (
        <>
          {/* VALOR REAL */}
          <div className="projection-main-value">
            <strong>
              {llenadoActual == null
                ? '—'
                : `${Number(llenadoActual).toFixed(1)}%`}
            </strong>
            <span>de capacidad</span>
          </div>

          {/* BARRA DE NIVEL REAL */}
          <div>
            <div
              className="projection-track"
              style={{
                '--real-position': `${
                  Math.min(100, Math.max(0, Number(llenadoActual) || 0))
                }%`
              }}
            >
              <div
                className="projection-real"
                style={{
                  width: `${
                    Math.min(100, Math.max(0, Number(llenadoActual) || 0))
                  }%`
                }}
              />

              <div className="projection-divider" />
              <div className="projection-marker" />
            </div>

            <div className="projection-scale">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* DATOS REALES COMPLEMENTARIOS */}
          <div className="simulator-metrics">
            <div className="simulator-metric">
              <span>Volumen actual</span>
              <strong>
                {volumenActual == null ||
                !Number.isFinite(Number(volumenActual))
                  ? '—'
                  : `${Number(volumenActual).toFixed(2)} hm³`}
              </strong>
            </div>

            <div className="simulator-metric">
              <span>Lluvia acumulada</span>
              <strong>
                {lluviaActual == null ||
                !Number.isFinite(Number(lluviaActual))
                  ? '—'
                  : `${Number(lluviaActual).toFixed(2)} mm`}
              </strong>
            </div>

            <div className="simulator-metric">
              <span>Última actualización</span>
              <strong className="simulator-date">
                {formatDate(fechaActualizacion)}
              </strong>
            </div>
          </div>
        </>
      )}

      <div className="projection-divider-section" />

      {/* PROYECCIÓN ML */}
      <div className="projection-header">
        <div>
          <div className="projection-title">
            Evolución estimada
          </div>
          <div className="projection-subtitle">
            Predicciones generadas por el modelo
          </div>
        </div>

        <span className="projection-label future">
          PROYECCIÓN ML
        </span>
      </div>

      {loadingPredicciones ? (
        <p className="simulation-notice">
          Generando predicciones para 7, 15 y 30 días...
        </p>
      ) : (
        <div className="projection-details">
          {[
            { key: '7d', label: '7 días' },
            { key: '15d', label: '15 días' },
            { key: '30d', label: '30 días' }
          ].map(({ key, label }) => {
            const prediccion = obtenerPrediccion(key);

            return (
              <div className="projection-point" key={key}>
                <span>{label}</span>

                <strong>
                  {prediccion?.llenado_pred_pct == null
                    ? '—'
                    : `${Number(
                        prediccion.llenado_pred_pct
                      ).toFixed(1)}%`}
                </strong>

                <small>
                  {prediccion?.vol_pred == null
                    ? 'Volumen: —'
                    : `Volumen: ${Number(
                        prediccion.vol_pred
                      ).toFixed(2)} hm³`}
                </small>

                {prediccion?.desc && (
                  <small
                    className={`prediction-status ${
                      prediccion.status || ''
                    }`}
                  >
                    {prediccion.desc}
                  </small>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LEYENDA */}
      <div className="projection-legend">
        <div className="projection-legend-item">
          <div className="projection-legend-color real" />
          Dato registrado
        </div>

        <div className="projection-legend-item">
          <div className="projection-legend-color future" />
          Predicción del modelo
        </div>
      </div>

      <p className="simulation-disclaimer">
        Las estimaciones provienen del endpoint /api/predicciones
        y de los modelos cargados en el servidor. No modifican
        los registros reales.
      </p>

    </div>
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
