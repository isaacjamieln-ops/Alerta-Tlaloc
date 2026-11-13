import { useEffect, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import './Dashboard.css'
import JSZip from 'jszip'

//Hook para el uso de la API
function Dashboard() {
  const [range, setRange] = useState('31')
  const [showAllAlarms, setShowAllAlarms] = useState(false)

  // ===== ESTADOS DE CARGA DE EXPORTACIÓN =====
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportMessage, setExportMessage] = useState('')

  // =========================================
  // 1. ESTADOS PARA CONECTAR CON LA API
  // =========================================
  const [consumptionData, setConsumptionData] = useState({
    hoy: [12, 15, 21, 18, 13, 12, 16, 20, 24, 28, 25, 18],
    7: [120, 150, 140, 160, 180, 170, 190],
    14: Array(14).fill(100),
    21: Array(21).fill(100),
    31: [12, 15, 21, 18, 13, 12, 16, 20, 24, 28, 25, 18, 20, 22, 19, 15, 14, 18, 22, 25, 27, 24, 20, 18, 16, 15, 19, 23, 26, 28, 25]
  })

  const [sensors, setSensors] = useState([])
  const [sensorStatusData, setSensorStatusData] = useState({
    total: 126,
    online: 124,
    warning: 1,
    offline: 1
  })
  const [alarms, setAlarms] = useState([])

  // Datos fijos de instalaciones
  const installations = [
    { id: '1', name: 'Tanque Principal Sur', percentage: 0.4 },
    { id: '2', name: 'Planta de Bombeo Norte', percentage: 0.35 },
    { id: '3', name: 'Tanque de Regulación Oriente', percentage: 0.25 },
  ]

  // =========================================
  // 2. PETICIÓN A LA API DE FASTAPI
  // =========================================
  useEffect(() => {
    const controller = new AbortController()

    async function fetchDashboardData() {
      try {
        const [resConsumo, resSensores, resAlarmas] = await Promise.all([
          fetch(`http://localhost:8000/api/consumo?range=${range}`, {
            signal: controller.signal,
          }),
          fetch('http://localhost:8000/api/sensores', {
            signal: controller.signal,
          }),
          fetch(`http://localhost:8000/api/alarmas?range=${range}`, {
            signal: controller.signal,
          }),
        ])

        if (!resConsumo.ok || !resSensores.ok || !resAlarmas.ok) {
          throw new Error(
            `Error HTTP: consumo=${resConsumo.status}, sensores=${resSensores.status}, alarmas=${resAlarmas.status}`
          )
        }

        const [dataConsumo, dataSensores, dataAlarmas] = await Promise.all([
          resConsumo.json(),
          resSensores.json(),
          resAlarmas.json(),
        ])

        const values = Array.isArray(dataConsumo)
          ? dataConsumo
          : dataConsumo?.values

        if (Array.isArray(values)) {
          const validValues = values
            .map(Number)
            .filter((value) => Number.isFinite(value))

          if (validValues.length > 0) {
            setConsumptionData((prev) => ({
              ...prev,
              [range]: validValues,
            }))
          } else {
            console.warn('La API de consumo no devolvió valores numéricos.', dataConsumo)
          }
        } else {
          console.warn('Formato inesperado en /api/consumo. Se conservan los datos de demostración.', dataConsumo)
        }

        const sensorList = Array.isArray(dataSensores)
          ? dataSensores
          : dataSensores?.sensors

        if (Array.isArray(sensorList)) {
          setSensors(sensorList)
        } else {
          console.warn('Formato inesperado en /api/sensores: se esperaba un arreglo "sensors".', dataSensores)
        }

        const summary = dataSensores?.statusSummary
        if (summary && typeof summary === 'object') {
          setSensorStatusData((prev) => ({
            total: Number(summary.total ?? prev.total) || 0,
            online: Number(summary.online ?? prev.online) || 0,
            warning: Number(summary.warning ?? prev.warning) || 0,
            offline: Number(summary.offline ?? prev.offline) || 0,
          }))
        }

        const alarmList = Array.isArray(dataAlarmas)
          ? dataAlarmas
          : dataAlarmas?.alarms

        if (Array.isArray(alarmList)) {
          setAlarms(alarmList)
        } else {
          console.warn('Formato inesperado en /api/alarmas: se esperaba un arreglo.', dataAlarmas)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error al conectar con la API de FastAPI:', error)
        }
      }
    }

    fetchDashboardData()

    return () => controller.abort()
  }, [range])

  // =========================================
  // 2. FUNCIONES AUXILIARES
  // =========================================

  function getTotalConsumption(values = []) {
    return values.reduce((total, value) => total + (Number(value) || 0), 0)
  }

  function getAverageConsumption(values = []) {
    if (!Array.isArray(values) || !values.length) return 0
    return getTotalConsumption(values) / values.length
  }

  function getConsumptionTrend(values = []) {
    if (!Array.isArray(values) || values.length < 2) {
      return { percentage: 0, direction: 'neutral' }
    }

    const midpoint = Math.floor(values.length / 2)
    const firstHalf = values.slice(0, midpoint)
    const secondHalf = values.slice(midpoint)

    const firstAverage = getAverageConsumption(firstHalf)
    const secondAverage = getAverageConsumption(secondHalf)

    if (firstAverage === 0) {
      return { percentage: 0, direction: 'neutral' }
    }

    const percentage =
      ((secondAverage - firstAverage) / firstAverage) * 100

    return {
      percentage: Math.abs(percentage).toFixed(1),
      direction:
        percentage > 0.5
          ? 'up'
          : percentage < -0.5
            ? 'down'
            : 'neutral',
    }
  }

  function getInstallationsData(total) {
    return installations.map((installation) => ({
      ...installation,
      value: total * installation.percentage,
    }))
  }

  function getPeriodAlarms(range) {
    if (range === 'hoy') {
      return alarms.filter((alarm) => alarm.dayOffset === 0)
    }
    return alarms.filter((alarm) => alarm.dayOffset < Number(range))
  }

  function getAlarmDate(dayOffset) {
    if (dayOffset === 0) return 'Hoy'
    if (dayOffset === 1) return 'Ayer'
    return `Hace ${dayOffset} días`
  }

  function formatNumber(value, decimals = 1) {
    const numericValue = Number(value)
    return (Number.isFinite(numericValue) ? numericValue : 0).toLocaleString('es-MX', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  // =========================================
  // 3. COMPONENTES DE VISUALIZACIÓN
  // =========================================

  function ViewToggle({ value, onChange }) {
    return (
      <div className="view-toggle" role="group" aria-label="Cambiar visualización">
        <button
          type="button"
          className={value === 'chart' ? 'active' : ''}
          onClick={() => onChange('chart')}
        >
          <span>▥</span> Gráfica
        </button>

        <button
          type="button"
          className={value === 'data' ? 'active' : ''}
          onClick={() => onChange('data')}
        >
          <span>☷</span> Datos
        </button>
      </div>
    )
  }

  function DataTable({ headers, rows }) {
    return (
      <div className="data-table-container">
        <table className="dashboard-data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="table-empty">
                  No hay registros para este periodo.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    )
  }

  // =========================================
  // TABLA DE CONSUMO
  // =========================================

  function ConsumptionDataTable({ values, range }) {
    const rows = values.map((value, index) => {
      const label =
        range === 'hoy'
          ? `${String(index).padStart(2, '0')}:00`
          : `Día ${index + 1}`

      return [
        index + 1,
        label,
        `${formatNumber(value, 1)} m³`,
      ]
    })

    return (
      <DataTable
        headers={['Registro', 'Periodo', 'Consumo']}
        rows={rows}
      />
    )
  }

  // =========================================
  // GRÁFICA DE INSTALACIONES
  // =========================================

  function InstallationsChart({ items, maxValue }) {
    return (
      <div className="installations-chart">
        {items.map((item) => (
          <div className="installation-chart-item" key={item.id}>
            <div className="installation-chart-heading">
              <span>{item.name}</span>
              <strong>{formatNumber(item.value, 1)} m³</strong>
            </div>

            <div className="installation-chart-track">
              <div
                className="installation-chart-bar"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                }}
              />
            </div>

            <span className="installation-chart-percentage">
              {(item.percentage * 100).toFixed(1)}% del consumo
            </span>
          </div>
        ))}
      </div>
    )
  }

  function InstallationsDataTable({ items }) {
    const rows = items.map((item) => [
      item.name,
      `${formatNumber(item.value, 1)} m³`,
      `${(item.percentage * 100).toFixed(1)}%`,
    ])

    return (
      <DataTable
        headers={['Instalación', 'Consumo', 'Participación']}
        rows={rows}
      />
    )
  }

  // =========================================
  // TABLA DE ESTADO DE SENSORES
  // =========================================

  function StatusData() {
    const { total, online, warning, offline } = sensorStatusData

    const rows = [
      ['En línea', online, `${formatNumber((online / total) * 100, 1)}%`],
      ['Advertencia', warning, `${formatNumber((warning / total) * 100, 1)}%`],
      ['Desconectados', offline, `${formatNumber((offline / total) * 100, 1)}%`],
      ['Total', total, '100%'],
    ]

    return (
      <DataTable
        headers={['Estado', 'Sensores', 'Porcentaje']}
        rows={rows}
      />
    )
  }

  // =========================================
  // GRÁFICA DE ALERTAS
  // =========================================

  function AlertsChart({ items }) {
    const critical = items.filter((item) => item.type === 'critical').length
    const warning = items.filter((item) => item.type === 'warning').length
    const total = items.length
    const maxValue = Math.max(critical, warning, 1)

    const categories = [
      { label: 'Alertas críticas', value: critical, type: 'critical' },
      { label: 'Advertencias', value: warning, type: 'warning' },
    ]

    return (
      <div className="alerts-chart">
        <div className="alerts-chart-total">
          <strong>{total}</strong>
          <span>Eventos en el periodo</span>
        </div>

        {categories.map((category) => (
          <div className="alert-chart-item" key={category.type}>
            <div className="alert-chart-heading">
              <span>
                <i className={category.type} />
                {category.label}
              </span>
              <strong>{category.value}</strong>
            </div>

            <div className="alert-chart-track">
              <div
                className={`alert-chart-bar ${category.type}`}
                style={{
                  width: `${(category.value / maxValue) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}

        {total === 0 && (
          <p className="empty-alarms">
            No hay alertas registradas en este periodo.
          </p>
        )}
      </div>
    )
  }

  function AlertsDataTable({ items }) {
    const rows = items.map((alarm) => [
      alarm.title,
      alarm.type === 'critical' ? 'Crítica' : 'Advertencia',
      alarm.location,
      getAlarmDate(alarm.dayOffset),
      alarm.time,
    ])

    return (
      <DataTable
        headers={['Evento', 'Tipo', 'Ubicación', 'Fecha', 'Hora']}
        rows={rows}
      />
    )
  }

  // =========================================
  // COMPARACIÓN DE PROMEDIOS
  // =========================================

  function TrendComparison({ values, trend }) {
    const midpoint = Math.floor(values.length / 2)

    const firstHalf = values.slice(0, midpoint)
    const secondHalf = values.slice(midpoint)

    const firstAverage = getAverageConsumption(firstHalf)
    const secondAverage = getAverageConsumption(secondHalf)
    const maxAverage = Math.max(firstAverage, secondAverage, 1)

    return (
      <div className="trend-comparison">
        <div className="trend-average-summary">
          <span>Promedio general</span>
          <strong>{formatNumber(getAverageConsumption(values), 1)} m³</strong>
        </div>

        <div className="trend-bars">
          <div className="trend-bar-item">
            <div className="trend-bar-heading">
              <span>Primera mitad</span>
              <strong>{formatNumber(firstAverage, 1)} m³</strong>
            </div>

            <div className="trend-bar-track">
              <div
                className="trend-bar first"
                style={{
                  width: `${(firstAverage / maxAverage) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="trend-bar-item">
            <div className="trend-bar-heading">
              <span>Segunda mitad</span>
              <strong>{formatNumber(secondAverage, 1)} m³</strong>
            </div>

            <div className="trend-bar-track">
              <div
                className="trend-bar second"
                style={{
                  width: `${(secondAverage / maxAverage) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className={`trend-result ${trend.direction}`}>
          <span>Tendencia del consumo</span>
          <strong>
            {trend.direction === 'up'
              ? '↑ Incremento'
              : trend.direction === 'down'
                ? '↓ Disminución'
                : '→ Sin variación significativa'}
            {' '}({trend.percentage}%)
          </strong>
        </div>
      </div>
    )
  }

  function TrendData({ values, trend }) {
    const midpoint = Math.floor(values.length / 2)
    const firstAverage = getAverageConsumption(values.slice(0, midpoint))
    const secondAverage = getAverageConsumption(values.slice(midpoint))

    const rows = [
      ['Promedio general', `${formatNumber(getAverageConsumption(values), 1)} m³`],
      ['Primera mitad', `${formatNumber(firstAverage, 1)} m³`],
      ['Segunda mitad', `${formatNumber(secondAverage, 1)} m³`],
      ['Variación', `${trend.percentage}%`],
      [
        'Comportamiento',
        trend.direction === 'up'
          ? 'Incremento'
          : trend.direction === 'down'
            ? 'Disminución'
            : 'Sin variación significativa',
      ],
    ]

    return (
      <DataTable
        headers={['Indicador', 'Resultado']}
        rows={rows}
      />
    )
  }

  // =========================================
  // ICONO DE AGUA
  // =========================================

  function WaterDrop() {
    return (
      <svg viewBox="0 0 40 40" className="water-drop-icon">
        <path
          d="M20 3 C16 11 8 19 8 26 A12 12 0 0 0 32 26 C32 19 24 11 20 3Z"
          fill="currentColor"
        />
        <path
          d="M14 27 C14 30 16 32 19 33"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // =========================================
  // 4. GRÁFICA DE CONSUMO
  // =========================================

  function ConsumptionChart({ values, range }) {
    const width = 600
    const height = 220
    const padding = 30

    const maxValue = Math.max(...values, 1) * 1.2
    const minValue = 0

    const points = values.map((value, index) => {
      const x =
        padding +
        (index / Math.max(values.length - 1, 1)) *
          (width - padding * 2)

      const y =
        height -
        padding -
        ((value - minValue) / (maxValue - minValue)) *
          (height - padding * 2)

      return { x, y, value, index }
    })

    const linePoints = points
      .map((point) => `${point.x},${point.y}`)
      .join(' ')

    const areaPoints = [
      `${padding},${height - padding}`,
      linePoints,
      `${width - padding},${height - padding}`,
    ].join(' ')

    const labelIndexes =
      values.length <= 7
        ? values.map((_, index) => index)
        : Array.from({ length: 7 }, (_, index) =>
            Math.round((index / 6) * (values.length - 1))
          )

    return (
      <div className="consumption-chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Gráfica de consumo de agua"
        >
          {[0, 1, 2, 3].map((line) => {
            const y =
              padding +
              (line / 3) * (height - padding * 2)

            return (
              <line
                key={line}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                className="chart-grid-line"
              />
            )
          })}

          <polygon
            points={areaPoints}
            className="chart-area"
          />

          <polyline
            points={linePoints}
            className="chart-line"
          />

          {points.map((point) => (
            <circle
              key={point.index}
              cx={point.x}
              cy={point.y}
              r="4"
              className="chart-point"
            >
              <title>{`Registro ${point.index + 1}: ${point.value} m³`}</title>
            </circle>
          ))}

          {labelIndexes.map((dataIndex) => {
            const x =
              padding +
              (dataIndex / Math.max(values.length - 1, 1)) *
                (width - padding * 2)

            let label

            if (range === 'hoy') {
              label = `${String(dataIndex).padStart(2, '0')}:00`
            } else if (range === '7') {
              label = `Día ${dataIndex + 1}`
            } else {
              label = `${dataIndex + 1}`
            }

            return (
              <text
                key={dataIndex}
                x={x}
                y={height - 5}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {label}
              </text>
            )
          })}
        </svg>
      </div>
    )
  }

  // =========================================
  // 5. MAPA INTERACTIVO DE SENSORES
  // =========================================

  function LocationMap() {
    const [selectedSensor, setSelectedSensor] = useState(null)
    const [zoom, setZoom] = useState(1)
    const [activeFilter, setActiveFilter] = useState('all')

    const filterOptions = [
      { id: 'all', label: 'Todos' },
      { id: 'online', label: 'En línea' },
      { id: 'warning', label: 'Advertencia' },
      { id: 'alarm', label: 'Alarma' },
      { id: 'offline', label: 'Desconectados' },
    ]

    const filteredSensors =
      activeFilter === 'all'
        ? sensors
        : sensors.filter(
            (sensor) => sensor.status === activeFilter
          )

    const statusLabels = {
      online: 'En línea',
      warning: 'Advertencia',
      alarm: 'Alarma',
      offline: 'Desconectado',
    }

    return (
      <div className="location-map-container">
        <div className="map-filters">
          {filterOptions.map((filter) => (
            <button
              key={filter.id}
              className={activeFilter === filter.id ? 'active' : ''}
              onClick={() => {
                setActiveFilter(filter.id)
                setSelectedSensor(null)
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="location-map">
          <div
            className="map-content"
            style={{ transform: `scale(${zoom})` }}
          >
            <div className="map-street street-one" />
            <div className="map-street street-two" />
            <div className="map-street street-three" />
            <div className="map-street street-four" />

            <span className="map-label map-label-one">
              Administración
            </span>
            <span className="map-label map-label-two">
              Edificio principal
            </span>
            <span className="map-label map-label-three">
              Almacén
            </span>

            {filteredSensors.map((sensor) => (
              <button
                key={sensor.id}
                className={`map-marker ${sensor.status} ${
                  selectedSensor?.id === sensor.id ? 'selected' : ''
                }`}
                style={{
                  left: `${sensor.x}%`,
                  top: `${sensor.y}%`,
                }}
                onClick={() => setSelectedSensor(sensor)}
                title={sensor.name}
                aria-label={`Seleccionar ${sensor.name}`}
              >
                <span />
              </button>
            ))}
          </div>

          <div className="map-zoom">
            <button
              onClick={() =>
                setZoom((current) =>
                  Math.min(1.8, current + 0.2)
                )
              }
              aria-label="Acercar mapa"
            >
              +
            </button>
            <button
              onClick={() =>
                setZoom((current) =>
                  Math.max(1, current - 0.2)
                )
              }
              aria-label="Alejar mapa"
            >
              −
            </button>
            <button
              onClick={() => setZoom(1)}
              aria-label="Restablecer zoom"
            >
              ↺
            </button>
          </div>
        </div>

        <div className="map-legend">
          <span><i className="online" /> En línea</span>
          <span><i className="warning" /> Advertencia</span>
          <span><i className="alarm" /> Alarma</span>
          <span><i className="offline" /> Desconectado</span>
        </div>

        {selectedSensor && (
          <div className="sensor-info">
            <div>
              <strong>{selectedSensor.name}</strong>
              <p>{selectedSensor.location}</p>
            </div>

            <span className={`sensor-status ${selectedSensor.status}`}>
              {statusLabels[selectedSensor.status]}
            </span>

            <button
              onClick={() => setSelectedSensor(null)}
              aria-label="Cerrar información del sensor"
            >
              ×
            </button>
          </div>
        )}

        <p className="map-disclaimer">
          Representación ilustrativa de ubicaciones. Los puntos no
          representan el total de sensores instalados.
        </p>
      </div>
    )
  }

  // =========================================
  // 6. ESTADO GENERAL DE SENSORES
  // =========================================

  function StatusChart() {
    const { total, online, warning, offline } = sensorStatusData

    const safeTotal = Number(total) > 0 ? Number(total) : 1
    const onlinePercentage = (Number(online) / safeTotal) * 100
    const warningPercentage = (Number(warning) / safeTotal) * 100
    const offlinePercentage = (Number(offline) / safeTotal) * 100

    return (
      <div className="status-chart-content">
        <div
          className="status-donut"
          style={{
            background: `conic-gradient(
              #16c79a 0% ${onlinePercentage}%,
              #f6b94a ${onlinePercentage}% ${onlinePercentage + warningPercentage}%,
              #f06464 ${onlinePercentage + warningPercentage}% ${onlinePercentage + warningPercentage + offlinePercentage}%,
              transparent ${onlinePercentage + warningPercentage + offlinePercentage}% 100%
            )`,
          }}
        >
          <div className="status-donut-inner">
            <strong>{total}</strong>
            <span>Sensores</span>
          </div>
        </div>

        <div className="status-legend">
          <div>
            <span className="status-dot online" />
            <span>En línea</span>
            <strong>{online}</strong>
          </div>

          <div>
            <span className="status-dot warning" />
            <span>Advertencia</span>
            <strong>{warning}</strong>
          </div>

          <div>
            <span className="status-dot offline" />
            <span>Desconectados</span>
            <strong>{offline}</strong>
          </div>
        </div>
      </div>
    )
  }

  // =========================================
  // 7. HISTORIAL DE ALARMAS
  // =========================================

  function AlarmHistoryModal({ onClose }) {
    const [filter, setFilter] = useState('all')

    useEffect(() => {
      function handleEscape(event) {
        if (event.key === 'Escape') onClose()
      }

      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'

      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = ''
      }
    }, [onClose])

    const filteredAlarms = alarms.filter((alarm) => {
      if (filter === 'all') return true
      return alarm.type === filter
    })

    const criticalCount = alarms.filter(
      (alarm) => alarm.type === 'critical'
    ).length

    const warningCount = alarms.filter(
      (alarm) => alarm.type === 'warning'
    ).length

    return (
      <div
        className="alarm-modal-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <section
          className="alarm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="alarm-modal-title"
        >
          <header className="alarm-modal-header">
            <div>
              <span className="modal-eyebrow">MONITOREO</span>
              <h2 id="alarm-modal-title">Historial de alarmas</h2>
              <p>Consulta los eventos registrados en el sistema.</p>
            </div>

            <button
              className="modal-close"
              onClick={onClose}
              aria-label="Cerrar historial"
            >
              ×
            </button>
          </header>

          <div className="alarm-modal-summary">
            <div>
              <span>Total de eventos</span>
              <strong>{alarms.length}</strong>
            </div>
            <div>
              <span>Críticas</span>
              <strong>{criticalCount}</strong>
            </div>
            <div>
              <span>Advertencias</span>
              <strong>{warningCount}</strong>
            </div>
          </div>

          <div className="alarm-modal-filters">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>
            <button
              className={filter === 'critical' ? 'active' : ''}
              onClick={() => setFilter('critical')}
            >
              Críticas
            </button>
            <button
              className={filter === 'warning' ? 'active' : ''}
              onClick={() => setFilter('warning')}
            >
              Advertencias
            </button>
          </div>

          <div className="alarm-modal-list">
            {filteredAlarms.length === 0 ? (
              <p className="empty-alarms">
                No hay alarmas en esta categoría.
              </p>
            ) : (
              filteredAlarms.map((alarm) => (
                <article className="alarm-modal-item" key={alarm.id}>
                  <span className={`alarm-type-icon ${alarm.type}`}>
                    {alarm.type === 'critical' ? '!' : '⚠'}
                  </span>

                  <div className="alarm-modal-item-content">
                    <div className="alarm-modal-item-title">
                      <strong>{alarm.title}</strong>
                      <span className={`alarm-badge ${alarm.type}`}>
                        {alarm.type === 'critical'
                          ? 'Crítica'
                          : 'Advertencia'}
                      </span>
                    </div>

                    <p>{alarm.description}</p>

                    <div className="alarm-modal-meta">
                      <span>{alarm.sensor}</span>
                      <span>{alarm.location}</span>
                      <span>{getAlarmDate(alarm.dayOffset)}</span>
                      <span>{alarm.time}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <footer className="alarm-modal-footer">
            <span>Información demostrativa del sistema</span>
            <button onClick={onClose}>Cerrar</button>
          </footer>
        </section>
      </div>
    )
  }

  // =========================================
  // 8. ESTADO Y LÓGICA PRINCIPAL DEL DASHBOARD
  // =========================================

  const [panelViews, setPanelViews] = useState({
    consumption: 'chart',
    installations: 'chart',
    status: 'chart',
    alerts: 'chart',
    trends: 'chart',
  })

  const changePanelView = (panel, view) => {
    setPanelViews((current) => ({
      ...current,
      [panel]: view,
    }))
  }

  const periods = [
    { value: 'hoy', label: 'Hoy' },
    { value: '7', label: '7 días' },
    { value: '14', label: '14 días' },
    { value: '21', label: '21 días' },
    { value: '31', label: '31 días' },
  ]

  const selectedValues = Array.isArray(consumptionData[range])
    ? consumptionData[range]
    : []
  const totalConsumption = getTotalConsumption(selectedValues)
  const averageConsumption = getAverageConsumption(selectedValues)
  const consumptionTrend = getConsumptionTrend(selectedValues)
  const selectedInstallations = getInstallationsData(totalConsumption)
  const selectedAlarms = getPeriodAlarms(range)

  const maxInstallation = Math.max(
    ...selectedInstallations.map((item) => item.value),
    1
  )

  const periodLabel =
    range === 'hoy'
      ? 'de hoy'
      : `de los últimos ${range} días`

  const latestReading = selectedValues[selectedValues.length - 1] ?? 0

  const trendText =
    consumptionTrend.direction === 'up'
      ? 'Incremento'
      : consumptionTrend.direction === 'down'
        ? 'Disminución'
        : 'Sin variación significativa'

  const onlinePercentage =
    sensorStatusData.total > 0
      ? (sensorStatusData.online / sensorStatusData.total) * 100
      : 0

  // =========================================
  // ANIMACIÓN DE KPIs
  // =========================================
  useEffect(() => {
    const counters = document.querySelectorAll('.kpi-value')
    const rafIds = []

    counters.forEach((counter) => {
      const targetRaw = counter.dataset.target
      if (targetRaw === undefined) return

      const target = parseFloat(String(targetRaw).replace(/,/g, ''))
      if (!Number.isFinite(target)) return

      let node = Array.from(counter.childNodes).find(
        (n) =>
          n.nodeType === Node.TEXT_NODE &&
          n.textContent.trim() !== ''
      )

      if (!node) {
        node = document.createTextNode('')
        counter.insertBefore(node, counter.firstChild)
      }

      const decimals = (String(targetRaw).split('.')[1] || '').length
      const duration = 1100
      const startTime = performance.now()
      const startValue =
        parseFloat(node.textContent.replace(/[^\d.-]/g, '')) || 0

      const updateCounter = (now) => {
        const progress = Math.min((now - startTime) / duration, 1)
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        const current = startValue + (target - startValue) * ease

        node.textContent = current.toLocaleString('es-MX', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })

        if (progress < 1) {
          rafIds.push(requestAnimationFrame(updateCounter))
        } else {
          node.textContent = target.toLocaleString('es-MX', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        }
      }

      rafIds.push(requestAnimationFrame(updateCounter))
    })

    return () => {
      rafIds.forEach((id) => cancelAnimationFrame(id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    range,
    totalConsumption,
    averageConsumption,
    latestReading,
    sensorStatusData.online,
    sensorStatusData.total,
    selectedAlarms.length,
  ])

  // =========================================
  // EXPORTACIÓN DEL PDF Y ZIP
  // =========================================

  // Esperar fuentes y estabilizar la interfaz antes de capturar.
  const waitForDashboardAnimations = async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready
    }

    document.body.classList.add('pdf-capture-mode')

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    )
  }

  // ✅ Helper FUERA de waitForDashboardAnimations
  const updateProgress = async (value, message) => {
    setExportMessage(message)
    setExportProgress(value)
    await new Promise((r) => setTimeout(r, 120))
  }

  const exportDashboardPDF = async () => {
    let zipUrl = null

    setIsExporting(true)
    setExportProgress(0)
    setExportMessage('Preparando exportación...')

    try {
      console.log('Iniciando exportación de Alerta-Tlaloc...')

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      })

      // =========================================
      // 1. CONFIGURACIÓN DEL DOCUMENTO
      // =========================================

      const dashboardElement = document.querySelector('.dashboard-page')

      if (!dashboardElement) {
        throw new Error('No se encontró el dashboard.')
      }

      const margin = 8
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const contentWidth = pageWidth - margin * 2
      const contentHeight = pageHeight - margin * 2 - 8
      const zip = new JSZip()

      await updateProgress(3, 'Preparando documento...')

      // =========================================
      // 2. VISUALIZACIONES PARA EXPORTAR
      // =========================================

      const visualizations = [
        { id: 'pdf-chart-consumption',   name: '01_Consumo_de_agua' },
        { id: 'pdf-chart-installations', name: '02_Consumo_por_instalacion' },
        { id: 'pdf-chart-status',        name: '03_Estado_de_sensores' },
        { id: 'pdf-chart-alerts',        name: '04_Distribucion_de_alertas' },
        { id: 'pdf-chart-trends',        name: '05_Promedios_y_tendencias' },
        { id: 'pdf-map-sensors',         name: '06_Mapa_de_sensores' },
      ]

      // =========================================
      // 3. CAPTURA INDIVIDUAL DE VISUALIZACIONES
      // =========================================

      const addVisualPage = async (visual, index) => {
        const element = document.getElementById(visual.id)

        if (!element) {
          throw new Error(`No se encontró la visualización: ${visual.id}`)
        }

        await updateProgress(
          10 + (index / visualizations.length) * 50,
          `Capturando ${visual.name.replace(/_/g, ' ')}...`
        )

        await waitForDashboardAnimations()

        const canvas = await html2canvas(element, {
          scale: 4,
          useCORS: true,
          backgroundColor: '#0b1422',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          imageTimeout: 15000,
          removeContainer: true,
        })

        if (!canvas.width || !canvas.height) {
          throw new Error(`La captura de ${visual.name} está vacía.`)
        }

        const imageData = canvas.toDataURL('image/png')
        const imageBase64 = imageData.split(',')[1]

        zip.file(`Graficas/${visual.name}.png`, imageBase64, { base64: true })

        doc.addPage('a4', 'portrait')

        const imageScale = Math.min(
          contentWidth / canvas.width,
          contentHeight / canvas.height
        )

        const imageWidth = canvas.width * imageScale
        const imageHeight = canvas.height * imageScale
        const imageX = (pageWidth - imageWidth) / 2
        const imageY = margin + (contentHeight - imageHeight) / 2

        doc.addImage(imageData, 'PNG', imageX, imageY, imageWidth, imageHeight)

        console.log(`Visualización exportada: ${visual.name}`)

        canvas.width = 0
        canvas.height = 0
      }

      // =========================================
      // 4. ENCABEZADO DEL REPORTE
      // =========================================

      await updateProgress(8, 'Construyendo encabezado...')

      const generatedAt = new Date().toLocaleString('es-MX')
      const periodName = range === 'hoy' ? 'Hoy' : `Últimos ${range} días`
      let y = 80

      doc.setFillColor(8, 20, 34)
      doc.rect(0, 0, pageWidth, 43, 'F')

      doc.setTextColor(0, 210, 230)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('SISTEMA DE MONITOREO HÍDRICO', 14, 14)

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('ALERTA-TLALOC', 14, 25)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Reporte ejecutivo del Dashboard', 14, 33)

      doc.setTextColor(30, 45, 60)
      doc.setFontSize(10)
      doc.text(`Periodo consultado: ${periodName}`, 14, 53)
      doc.text(`Generado: ${generatedAt}`, 14, 60)

      // =========================================
      // 5. FUNCIÓN PARA AGREGAR TABLAS
      // =========================================

      const addSection = (title, headers, rows) => {
        if (y > 250) {
          doc.addPage('a4', 'portrait')
          y = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(10, 45, 65)
        doc.text(title, 14, y)

        const tableRows =
          rows.length > 0
            ? rows
            : [headers.map((_, index) => (index === 0 ? 'Sin registros' : '—'))]

        autoTable(doc, {
          startY: y + 5,
          head: [headers],
          body: tableRows,
          theme: 'grid',
          margin: { left: 14, right: 14 },
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 3,
            textColor: [45, 60, 75],
            lineColor: [220, 230, 235],
          },
          headStyles: {
            fillColor: [8, 40, 60],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          alternateRowStyles: { fillColor: [242, 248, 250] },
        })

        y = doc.lastAutoTable.finalY + 12
      }

      // =========================================
      // 6. INDICADORES PRINCIPALES
      // =========================================

      addSection('1. Indicadores principales', ['Indicador', 'Resultado'], [
        ['Consumo acumulado', `${formatNumber(totalConsumption, 1)} m³`],
        ['Promedio por registro', `${formatNumber(averageConsumption, 1)} m³`],
        ['Último registro', `${formatNumber(latestReading, 1)} m³`],
        ['Sensores en línea', `${formatNumber(onlinePercentage, 1)}%`],
        ['Alarmas del periodo', selectedAlarms.length],
      ])

      // =========================================
      // 7. REGISTRO DE CONSUMO
      // =========================================

      const consumptionRows = selectedValues.map((value, index) => [
        index + 1,
        range === 'hoy'
          ? `${String(index).padStart(2, '0')}:00`
          : `Día ${index + 1}`,
        `${formatNumber(value, 1)} m³`,
      ])

      addSection(
        '2. Registro de consumo de agua',
        ['Registro', 'Periodo', 'Consumo'],
        consumptionRows
      )

      // =========================================
      // 8. CONSUMO POR INSTALACIÓN
      // =========================================

      const installationRows = selectedInstallations.map((item) => [
        item.name,
        `${formatNumber(item.value, 1)} m³`,
        `${(item.percentage * 100).toFixed(1)}%`,
      ])

      addSection(
        '3. Distribución por instalación',
        ['Instalación', 'Consumo', 'Participación'],
        installationRows
      )

      // =========================================
      // 9. ESTADO DE SENSORES
      // =========================================

      const safeSensorTotal = Number(sensorStatusData.total) || 0

      const sensorPercentage = (value) =>
        safeSensorTotal > 0
          ? formatNumber((Number(value) / safeSensorTotal) * 100, 1)
          : '0.0'

      addSection('4. Estado general de sensores', ['Estado', 'Cantidad', 'Porcentaje'], [
        ['En línea', sensorStatusData.online, `${sensorPercentage(sensorStatusData.online)}%`],
        ['Advertencia', sensorStatusData.warning, `${sensorPercentage(sensorStatusData.warning)}%`],
        ['Desconectados', sensorStatusData.offline, `${sensorPercentage(sensorStatusData.offline)}%`],
        ['Total', sensorStatusData.total, '100%'],
      ])

      // =========================================
      // 10. HISTORIAL DE ALERTAS
      // =========================================

      const alarmRows = selectedAlarms.map((alarm) => [
        alarm.title,
        alarm.type === 'critical' ? 'Crítica' : 'Advertencia',
        alarm.location,
        getAlarmDate(alarm.dayOffset),
        alarm.time,
      ])

      addSection(
        '5. Historial de alertas del periodo',
        ['Evento', 'Tipo', 'Ubicación', 'Fecha', 'Hora'],
        alarmRows
      )

      // =========================================
      // 11. PROMEDIOS Y TENDENCIAS
      // =========================================

      const midpoint = Math.floor(selectedValues.length / 2)
      const firstAverage = getAverageConsumption(selectedValues.slice(0, midpoint))
      const secondAverage = getAverageConsumption(selectedValues.slice(midpoint))

      addSection('6. Análisis de promedios y tendencias', ['Indicador', 'Resultado'], [
        ['Promedio general', `${formatNumber(averageConsumption, 1)} m³`],
        ['Promedio de la primera mitad', `${formatNumber(firstAverage, 1)} m³`],
        ['Promedio de la segunda mitad', `${formatNumber(secondAverage, 1)} m³`],
        ['Variación', `${consumptionTrend.percentage}%`],
        ['Comportamiento', trendText],
      ])

      await updateProgress(10, 'Tablas generadas...')

      // =========================================
      // 12. EXPORTAR LAS SEIS VISUALIZACIONES
      // =========================================

      for (let i = 0; i < visualizations.length; i++) {
        await addVisualPage(visualizations[i], i)
      }

      // =========================================
      // 13. CAPTURAR EL DASHBOARD COMPLETO
      // =========================================

      await updateProgress(62, 'Capturando dashboard completo...')

      console.log('Capturando dashboard completo...')

      await waitForDashboardAnimations()

      const dashboardCanvas = await html2canvas(dashboardElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0b1422',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 15000,
        removeContainer: true,
        ignoreElements: (element) =>
          element.classList?.contains('pdf-visuals-source') ||
          element.classList?.contains('dashboard-export'),
      })

      if (!dashboardCanvas.width || !dashboardCanvas.height) {
        throw new Error('No se pudo capturar el dashboard completo.')
      }

      const dashboardImage = dashboardCanvas.toDataURL('image/png')
      const dashboardBase64 = dashboardImage.split(',')[1]

      zip.file('Graficas/00_Dashboard_Completo.png', dashboardBase64, { base64: true })

      // =========================================
      // 14. AGREGAR DASHBOARD COMPLETO AL PDF
      // =========================================

      doc.addPage('a4', 'portrait')

      const dashboardScale = Math.min(
        contentWidth / dashboardCanvas.width,
        contentHeight / dashboardCanvas.height
      )

      const dashboardWidth = dashboardCanvas.width * dashboardScale
      const dashboardHeight = dashboardCanvas.height * dashboardScale
      const dashboardX = (pageWidth - dashboardWidth) / 2
      const dashboardY = margin + (contentHeight - dashboardHeight) / 2

      doc.addImage(
        dashboardImage,
        'PNG',
        dashboardX,
        dashboardY,
        dashboardWidth,
        dashboardHeight
      )

      console.log('Dashboard completo agregado al PDF y ZIP.')

      dashboardCanvas.width = 0
      dashboardCanvas.height = 0

      // =========================================
      // 15. NUMERACIÓN DE TODAS LAS PÁGINAS
      // =========================================

      await updateProgress(72, 'Numerando páginas...')

      const pageCount = doc.internal.getNumberOfPages()

      for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page)
        doc.setDrawColor(210, 225, 232)
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(110, 125, 135)

        doc.text('Alerta-Tlaloc | Sistema de Monitoreo Hídrico', 14, pageHeight - 9)
        doc.text(`Página ${page} de ${pageCount}`, pageWidth - 14, pageHeight - 9, {
          align: 'right',
        })
      }

      // =========================================
      // 16. GENERAR Y DESCARGAR ZIP
      // =========================================

      await updateProgress(78, 'Comprimiendo archivos...')

      console.log('Generando ZIP...')

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
        (metadata) => {
          // progreso REAL de compresión: 78 → 94 %
          setExportProgress(78 + metadata.percent * 0.16)
        }
      )

      await updateProgress(95, 'Descargando ZIP...')

      zipUrl = URL.createObjectURL(zipBlob)

      const downloadLink = document.createElement('a')
      downloadLink.href = zipUrl
      downloadLink.download = `Graficas_Alerta-Tlaloc_${range}_dias.zip`

      document.body.appendChild(downloadLink)
      downloadLink.click()
      downloadLink.remove()

      console.log('Descarga del ZIP iniciada.')

      // =========================================
      // 17. DESCARGAR PDF
      // =========================================

      await updateProgress(97, 'Descargando PDF...')

      await new Promise((resolve) => setTimeout(resolve, 1200))

      console.log('Iniciando descarga del PDF...')

      doc.save(`Alerta-Tlaloc_Reporte_${range}_dias.pdf`)

      await updateProgress(100, '¡Reporte listo!')

      await new Promise((resolve) => setTimeout(resolve, 600))

      console.log('Exportación finalizada.')
    } catch (error) {
      console.error('Error al generar el reporte:', error)
      setExportMessage(`Error: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportMessage('')

      document.body.classList.remove('pdf-capture-mode')

      if (zipUrl) {
        setTimeout(() => URL.revokeObjectURL(zipUrl), 5000)
      }
    }
  }

  return (
    <main className="dashboard-page">

      {/* ENCABEZADO */}

      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">
            SISTEMA DE MONITOREO HÍDRICO
          </span>
          <h1>Dashboard</h1>
          <p>
            Visualiza el consumo de agua y el estado general de las
            instalaciones.
          </p>
        </div>
      </header>

      {/* FILTRO GLOBAL */}

      <section className="dashboard-period">
        <div>
          <span className="section-label">PERIODO DE CONSULTA</span>
          <p>Selecciona el intervalo que deseas analizar.</p>
        </div>

        <div className="range-selector">
          {periods.map((period) => (
            <button
              key={period.value}
              className={range === period.value ? 'active' : ''}
              onClick={() => setRange(period.value)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </section>

      {/* INDICADORES PRINCIPALES */}

      <section className="dashboard-kpis">

        <article className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Consumo del periodo</span>
            <span className="kpi-icon water-icon">
              <WaterDrop />
            </span>
          </div>

          <strong
            className="kpi-value"
            data-target={totalConsumption.toFixed(0)}
          >
            {formatNumber(totalConsumption, 0)}
            <small>m³</small>
          </strong>

          <span className="kpi-description">
            Consumo acumulado {periodLabel}
          </span>
        </article>

        <article className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Promedio por registro</span>
            <span className="kpi-icon average-icon">∿</span>
          </div>

          <strong
            className="kpi-value"
            data-target={averageConsumption.toFixed(1)}
          >
            {formatNumber(averageConsumption, 1)}
            <small>m³</small>
          </strong>

          <span className="kpi-description">
            Promedio del periodo seleccionado
          </span>
        </article>

        <article className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Último registro</span>
            <span className="kpi-icon current-icon">◉</span>
          </div>

          <strong
            className="kpi-value"
            data-target={latestReading.toFixed(0)}
          >
            {formatNumber(latestReading, 0)}
            <small>m³</small>
          </strong>

          <span className="kpi-description">
            Último dato del periodo seleccionado
          </span>
        </article>

        <article className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Sensores en línea</span>
            <span className="kpi-icon sensor-icon">⌁</span>
          </div>

          <strong
            className="kpi-value"
            data-target={onlinePercentage.toFixed(1)}
          >
            {formatNumber(onlinePercentage, 1)}
            <small>%</small>
          </strong>

          <span className="kpi-description">
            {sensorStatusData.online} de {sensorStatusData.total} sensores
          </span>
        </article>

        <article className="dashboard-card kpi-card">
          <div className="kpi-top">
            <span>Alarmas del periodo</span>
            <span className="kpi-icon alarm-icon">!</span>
          </div>

          <strong
            className="kpi-value"
            data-target={selectedAlarms.length}
          >
            {selectedAlarms.length}
          </strong>

          <span className="kpi-description">
            Eventos registrados {periodLabel}
          </span>
        </article>

      </section>

      {/* GRÁFICA Y MAPA */}

      <section className="dashboard-middle">

        <article className="dashboard-card consumption-card">
          <div className="panel-header">
            <div>
              <span className="section-label">ANÁLISIS DE CONSUMO</span>
              <h2>Consumo de agua</h2>
              <p>Comportamiento registrado {periodLabel}.</p>
            </div>

            <div className="panel-actions">
              <div className="chart-period-label">
                {periods.find((period) => period.value === range)?.label}
              </div>

              <ViewToggle
                value={panelViews.consumption}
                onChange={(view) => changePanelView('consumption', view)}
              />
            </div>
          </div>

          <div className="chart-summary">
            <div>
              <strong>{formatNumber(totalConsumption, 0)} m³</strong>
              <span>Consumo acumulado</span>
            </div>

            <div className={`kpi-change ${consumptionTrend.direction}`}>
              <strong>
                {consumptionTrend.direction === 'up'
                  ? '↑'
                  : consumptionTrend.direction === 'down'
                    ? '↓'
                    : '→'}
                {' '}{consumptionTrend.percentage}%
              </strong>
              <span>{trendText}</span>
            </div>
          </div>

          {panelViews.consumption === 'chart' ? (
            <ConsumptionChart
              key={range}
              values={selectedValues}
              range={range}
            />
          ) : (
            <ConsumptionDataTable
              values={selectedValues}
              range={range}
            />
          )}

          <div className="chart-footer">
            <span><i className="chart-legend-dot" /> Consumo registrado</span>
            <span>Unidad: m³</span>
          </div>
        </article>

        <article className="dashboard-card map-card">
          <div className="panel-header">
            <div>
              <span className="section-label">UBICACIÓN</span>
              <h2>Mapa de sensores</h2>
              <p>Distribución ilustrativa de dispositivos.</p>
            </div>
          </div>

          <LocationMap />
        </article>

      </section>

      {/* INFORMACIÓN COMPLEMENTARIA */}

      <section className="dashboard-bottom">

        <article className="dashboard-card installations-card">
          <div className="panel-header">
            <div>
              <span className="section-label">DISTRIBUCIÓN</span>
              <h2>Consumo por instalación</h2>
              <p>Participación del consumo {periodLabel}.</p>
            </div>

            <ViewToggle
              value={panelViews.installations}
              onChange={(view) => changePanelView('installations', view)}
            />
          </div>

          {panelViews.installations === 'chart' ? (
            <InstallationsChart
              items={selectedInstallations}
              maxValue={maxInstallation}
            />
          ) : (
            <InstallationsDataTable items={selectedInstallations} />
          )}
        </article>

        <article className="dashboard-card status-card">
          <div className="panel-header">
            <div>
              <span className="section-label">DISPOSITIVOS</span>
              <h2>Estado de sensores</h2>
              <p>Estado general de la red de monitoreo.</p>
            </div>

            <ViewToggle
              value={panelViews.status}
              onChange={(view) => changePanelView('status', view)}
            />
          </div>

          {panelViews.status === 'chart' ? (
            <StatusChart />
          ) : (
            <StatusData />
          )}

          <div className="status-card-footer">
            <span>
              <i className="online" />
              Red de monitoreo
            </span>
            <strong>Operativa</strong>
          </div>
        </article>

        <article className="dashboard-card alerts-card">
          <div className="panel-header">
            <div>
              <span className="section-label">NOTIFICACIONES</span>
              <h2>Últimas alarmas</h2>
              <p>Eventos registrados {periodLabel}.</p>
            </div>

            <div className="panel-actions">
              <span className="alerts-counter">
                {selectedAlarms.length}
              </span>

              <ViewToggle
                value={panelViews.alerts}
                onChange={(view) => changePanelView('alerts', view)}
              />
            </div>
          </div>

          {panelViews.alerts === 'chart' ? (
            <AlertsChart items={selectedAlarms} />
          ) : (
            <AlertsDataTable items={selectedAlarms} />
          )}

          <button
            className="view-all-alarms"
            onClick={() => setShowAllAlarms(true)}
          >
            Consultar todas las alarmas
            <span>→</span>
          </button>
        </article>

        <article className="dashboard-card trends-card">
          <div className="panel-header">
            <div>
              <span className="section-label">ANÁLISIS COMPARATIVO</span>
              <h2>Promedios y tendencias</h2>
              <p>Comportamiento del consumo {periodLabel}.</p>
            </div>

            <ViewToggle
              value={panelViews.trends}
              onChange={(view) => changePanelView('trends', view)}
            />
          </div>

          {panelViews.trends === 'chart' ? (
            <TrendComparison
              values={selectedValues}
              trend={consumptionTrend}
            />
          ) : (
            <TrendData
              values={selectedValues}
              trend={consumptionTrend}
            />
          )}
        </article>

      </section>

      {/* VISUALIZACIONES EXCLUSIVAS PARA EL PDF */}

      <div
        className="pdf-visuals-source"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-12000px',
          top: 0,
          width: '1000px',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >

        <article id="pdf-chart-consumption" className="dashboard-card pdf-visual-card">
          <span className="section-label">ANÁLISIS DE CONSUMO</span>
          <h2>Consumo de agua</h2>
          <p>Comportamiento registrado {periodLabel}.</p>

          <div className="chart-summary">
            <div>
              <strong>{formatNumber(totalConsumption, 1)} m³</strong>
              <span>Consumo acumulado</span>
            </div>
            <div>
              <strong>{consumptionTrend.percentage}%</strong>
              <span>{trendText}</span>
            </div>
          </div>

          <ConsumptionChart
            key={`pdf-${range}`}
            values={selectedValues}
            range={range}
          />
        </article>

        <article id="pdf-chart-installations" className="dashboard-card pdf-visual-card">
          <span className="section-label">DISTRIBUCIÓN</span>
          <h2>Consumo por instalación</h2>
          <p>Participación del consumo {periodLabel}.</p>

          <InstallationsChart
            items={selectedInstallations}
            maxValue={maxInstallation}
          />
        </article>

        <article id="pdf-chart-status" className="dashboard-card pdf-visual-card">
          <span className="section-label">DISPOSITIVOS</span>
          <h2>Estado de sensores</h2>
          <p>Estado general de la red de monitoreo.</p>

          <StatusChart />
        </article>

        <article id="pdf-chart-alerts" className="dashboard-card pdf-visual-card">
          <span className="section-label">NOTIFICACIONES</span>
          <h2>Distribución de alertas</h2>
          <p>Eventos registrados {periodLabel}.</p>

          <AlertsChart items={selectedAlarms} />
        </article>

        <article id="pdf-chart-trends" className="dashboard-card pdf-visual-card">
          <span className="section-label">ANÁLISIS COMPARATIVO</span>
          <h2>Promedios y tendencias</h2>
          <p>Comportamiento del consumo {periodLabel}.</p>

          <TrendComparison
            values={selectedValues}
            trend={consumptionTrend}
          />
        </article>

        <article id="pdf-map-sensors" className="dashboard-card pdf-visual-card">
          <span className="section-label">UBICACIÓN</span>
          <h2>Mapa de sensores</h2>
          <p>Distribución ilustrativa de dispositivos.</p>

          <LocationMap />
        </article>

      </div>

      {/* EXPORTACIÓN DEL REPORTE */}

      <div className="dashboard-export">
        <button
          type="button"
          className="export-pdf-button"
          onClick={exportDashboardPDF}
          disabled={isExporting}
        >
          <span>↓</span>
          {isExporting ? 'Generando reporte...' : 'Exportar reporte en PDF'}
        </button>

        {/* BARRA DE PROGRESO */}
        {isExporting && (
          <div className="export-progress">
            <div className="export-progress-header">
              <span>{exportMessage || 'Generando reporte...'}</span>
              <span className="export-progress-percent">
                {Math.round(exportProgress)}%
              </span>
            </div>
            <div className="export-progress-track">
              <div
                className="export-progress-fill"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        <p>
          Descarga los indicadores, registros y análisis del periodo seleccionado.
        </p>
      </div>

      {/* MODAL DE HISTORIAL */}

      {showAllAlarms && (
        <AlarmHistoryModal
          onClose={() => setShowAllAlarms(false)}
        />
      )}

      {/* PIE DE PÁGINA */}

      <footer className="dashboard-footer">
        <span>Alerta-Tlaloc · Sistema de monitoreo hídrico</span>
      </footer>

    </main>
  )
}

export default Dashboard