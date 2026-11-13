import Inicio from './pages/Inicio';
import Dashboard from './pages/Dashboard';
import Predicciones from './pages/Predicciones';
import GestionAgua from './pages/GestionAgua';


import { useState } from 'react'
import './App.css'

const sections = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: 'bi-house-door',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'bi-grid-1x2',
  },
  {
    id: 'predicciones',
    label: 'Predicciones',
    icon: 'bi-graph-up-arrow',
  },
  {
    id: 'gestion',
    label: 'Gestión del agua',
    icon: 'bi-droplet-half',
  },
]

function App() {
  const [activeSection, setActiveSection] = useState('inicio')
  const [menuOpen, setMenuOpen] = useState(false)

  const navigateTo = (sectionId) => {
    setActiveSection(sectionId)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderHome = () => (
    <>
      {/* PORTADA PRINCIPAL */}
      <section className="hero">
        <div className="row align-items-center g-4">
          <div className="col-12 col-lg-7">
            <div className="hero-content">
              <span className="eyebrow">
                TECNOLOGÍA PARA EL FUTURO DEL AGUA
              </span>

              <h1>
                Anticipar hoy.
                <span> Proteger mañana.</span>
              </h1>

              <p className="hero-description">
                Transformamos datos en información útil para comprender,
                predecir y mejorar el consumo y manejo del agua.
              </p>

              <div className="hero-actions">
                <button
                  className="btn button-primary"
                  onClick={() => navigateTo('dashboard')}
                >
                  Explorar plataforma
                  <i className="bi bi-arrow-right" />
                </button>

                <a href="#proyecto" className="btn button-secondary">
                  Conocer el proyecto
                </a>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="hero-visual">
              <div className="water-circle">
                <div className="water-inner">
                  <i className="bi bi-droplet-half water-icon" />
                  <span className="water-label">ALERTA</span>
                  <strong>TLALOC</strong>
                  <span className="water-caption">
                    Inteligencia hídrica
                  </span>
                </div>
              </div>

              <div className="visual-decoration decoration-one" />
              <div className="visual-decoration decoration-two" />
            </div>
          </div>
        </div>
      </section>

      {/* CONTEXTO Y OBJETIVOS */}
      <section className="project-section" id="proyecto">
        <div className="section-heading">
          <span className="eyebrow">NUESTRA PROPUESTA</span>
          <h2>¿Qué es Alerta-Tlaloc?</h2>
          <p>
            Una propuesta tecnológica que busca mejorar la gestión
            del agua mediante el análisis de datos y modelos predictivos.
          </p>
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <article className="info-card h-100">
              <div className="card-icon">
                <i className="bi bi-globe-americas" />
              </div>
              <h3>Contexto</h3>
              <p>
                La disponibilidad y administración del agua representan
                desafíos importantes. Contar con información que permita
                comprender los patrones de consumo puede ayudar a tomar
                mejores decisiones.
              </p>
            </article>
          </div>

          <div className="col-12 col-lg-6">
            <article className="info-card h-100">
              <div className="card-icon">
                <i className="bi bi-bullseye" />
              </div>
              <h3>Objetivo general</h3>
              <p>
                Desarrollar una plataforma que analice y visualice
                información relacionada con el consumo del agua, utilizando
                modelos predictivos para facilitar su aprovechamiento.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* MISIÓN Y VISIÓN */}
      <section className="identity-grid row g-4">
        <div className="col-12 col-lg-6">
          <article className="identity-card h-100">
            <span className="eyebrow">01 / PROPÓSITO</span>
            <div className="identity-icon">
              <i className="bi bi-compass" />
            </div>
            <h3>Nuestra misión</h3>
            <p>
              Mejorar la manera en que las personas y organizaciones
              comprenden, administran y aprovechan el agua mediante
              soluciones tecnológicas basadas en datos y modelos predictivos.
            </p>
          </article>
        </div>

        <div className="col-12 col-lg-6">
          <article className="identity-card vision-card h-100">
            <span className="eyebrow">02 / FUTURO</span>
            <div className="identity-icon">
              <i className="bi bi-eye" />
            </div>
            <h3>Nuestra visión</h3>
            <p>
              Convertirnos en una solución tecnológica de referencia
              en la gestión inteligente del agua, contribuyendo a un futuro
              donde la información y la prevención impulsen un consumo
              más eficiente y sostenible.
            </p>
          </article>
        </div>
      </section>

      {/* CIERRE */}
      <section className="closing-section">
        <i className="bi bi-water closing-icon" />
        <span className="eyebrow">ALERTA-TLALOC</span>
        <h2>Los datos nos permiten anticiparnos.</h2>
        <p>
          Comprender el presente es el primer paso para gestionar
          mejor el agua del futuro.
        </p>
      </section>
    </>
  )

  const renderComingSoon = () => {
    const selectedSection = sections.find(
      (section) => section.id === activeSection
    )

    return (
      <section className="coming-soon">
        <span className="eyebrow">
          ALERTA-TLALOC / {selectedSection.label.toUpperCase()}
        </span>

        <div className="coming-icon">
          <i className={`bi ${selectedSection.icon}`} />
        </div>

        <h1>{selectedSection.label}</h1>

        <p>
          Esta sección estará disponible próximamente.
          Estamos preparando sus funcionalidades.
        </p>

        <button
          className="btn button-primary"
          onClick={() => navigateTo('inicio')}
        >
          <i className="bi bi-arrow-left" />
          Volver al inicio
        </button>
      </section>
    )
  }

  const renderNavigation = () => (
    <nav className="sidebar-nav">
      {sections.map((section) => (
        <button
          key={section.id}
          className={`nav-item ${
            activeSection === section.id ? 'active' : ''
          }`}
          onClick={() => navigateTo(section.id)}
        >
          <i className={`bi ${section.icon} nav-icon`} />
          <span>{section.label}</span>

          {activeSection === section.id && (
            <span className="active-indicator" />
          )}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="app-layout">

      {/* SIDEBAR PARA ESCRITORIO */}
      <aside className="sidebar d-none d-md-flex">
        <a
          href="#inicio"
          className="brand"
          onClick={() => navigateTo('inicio')}
        >
          <div className="brand-icon">
            <i className="bi bi-droplet-half" />
          </div>

          <div className="brand-text">
            <strong>ALERTA-TLALOC</strong>
            <span>SMART WATER MANAGEMENT</span>
          </div>
        </a>

        <div className="menu-label">MENÚ PRINCIPAL</div>

        {renderNavigation()}

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" />
            <span>Plataforma en desarrollo</span>
          </div>

          <span className="sidebar-version">
            ALERTA-TLALOC © 2026
          </span>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="main-area">

        {/* ENCABEZADO PARA MÓVIL */}
        <header className="mobile-header d-md-none">
          <a
            href="#inicio"
            className="brand"
            onClick={() => navigateTo('inicio')}
          >
            <div className="brand-icon">
              <i className="bi bi-droplet-half" />
            </div>

            <div className="brand-text">
              <strong>ALERTA-TLALOC</strong>
              <span>SMART WATER MANAGEMENT</span>
            </div>
          </a>

          <button
            className="mobile-menu-button"
            type="button"
            aria-label="Abrir menú de navegación"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} />
          </button>
        </header>

        {/* MENÚ DESPLEGABLE PARA MÓVIL */}
        <div className={`mobile-menu d-md-none ${menuOpen ? 'open' : ''}`}>
          <div className="menu-label">MENÚ PRINCIPAL</div>
          {renderNavigation()}
        </div>

        {/* BARRA SUPERIOR PARA ESCRITORIO */}
        <header className="topbar d-none d-md-flex">
          <div>
            <span className="topbar-label">PLATAFORMA /</span>
            <strong>
              {sections.find(
                (section) => section.id === activeSection
              ).label}
            </strong>
          </div>

          <div className="topbar-right">
            <span className="topbar-indicator" />
            <span>Gestión inteligente del agua</span>
          </div>
        </header>

        
<div className="page-content container-fluid">
  {activeSection === 'inicio' ? (
    <Inicio onNavigate={navigateTo} />
  ) : activeSection === 'dashboard' ? (
    <Dashboard />
  ) : activeSection === 'predicciones' ? (
    <Predicciones />
  ) : activeSection === 'gestion' ? (
    <GestionAgua />
  ) : (
    renderComingSoon()
  )}
</div>


        <footer className="footer">
          <span>ALERTA-TLALOC</span>
          <span>Tecnología orientada a un futuro sostenible.</span>
        </footer>
      </main>
    </div>
  )
}

export default App
