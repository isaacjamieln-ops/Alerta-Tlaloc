import { useEffect, useState } from 'react';

export default function Dashboard() {
const [metrics, setMetrics] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
// Petición a la API de FastAPI
fetch('http://localhost:8000/api/alarmas')
    .then((res) => res.json())
    .then((data) => {
    setMetrics(data);
    setLoading(false);
    })
    .catch((err) => console.error('Error al conectar con la API:', err));
}, []);

if (loading) return <div>Cargando datos del sistema Alerta Tláloc...</div>;

return (
<div className="dashboard-container">
    <h2>Monitoreo en Tiempo Real - Alerta Tláloc</h2>
    
    {/* Tarjetas KPI */}
    <div className="row g-3 my-3">
    <div className="col-md-3">
        <div className="card p-3">
        <span>Consumo Total</span>
        <h3>{metrics.kpis.consumo_total_m3} m³</h3>
        </div>
    </div>
    <div className="col-md-3">
        <div className="card p-3">
        <span>Nivel Promedio</span>
        <h3>{metrics.kpis.nivel_promedio_tanques}</h3>
        </div>
    </div>
    <div className="col-md-3">
        <div className="card p-3">
        <span>Alertas Activas</span>
        <h3>{metrics.kpis.alertas_activas}</h3>
        </div>
    </div>
    <div className="col-md-3">
        <div className="card p-3">
        <span>Eficiencia</span>
        <h3>{metrics.kpis.eficiencia_sistema}</h3>
        </div>
    </div>
    </div>

    {/* Aquí puedes mapear metrics.historico_almacenamiento a tu librería de gráficos (Chart.js / Recharts) */}
</div>
);
}