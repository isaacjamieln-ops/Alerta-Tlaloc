function Inicio({ onNavigate }) {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            TECNOLOGÍA · DATOS · SOSTENIBILIDAD
          </span>

          <h1>
            Anticipar hoy.
            <br />
            <span>Proteger mañana.</span>
          </h1>

          <p className="hero-description">
            Alerta-Tlaloc es una propuesta tecnológica que busca transformar
            los datos en información útil para comprender el consumo del agua
            y apoyar una gestión más responsable de este recurso.
          </p>

          <div className="hero-actions">
            <button
              className="btn button-primary"
              onClick={() => onNavigate('dashboard')}
            >
              Explorar Dashboard
              <i className="bi bi-arrow-right ms-2"></i>
            </button>

            <a href="#contexto" className="btn button-secondary">
              Conocer el proyecto
            </a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="water-circle">
            <div className="water-inner">
              <i className="bi bi-droplet-half water-icon"></i>
              <span className="water-label">ALERTA-TLALOC</span>
            </div>
          </div>

          <div className="visual-decoration decoration-one"></div>
          <div className="visual-decoration decoration-two"></div>
          <p className="water-caption">El futuro del agua comienza hoy</p>
        </div>
      </section>

      {/* CONTEXTO DEL PROYECTO */}
      <section className="project-section" id="contexto">
        <div className="section-heading">
          <span className="eyebrow">01 · CONTEXTO DEL PROYECTO</span>
          <h2>
            El agua es un recurso esencial.
            <br />
            Su gestión necesita mejores decisiones.
          </h2>
          <p>
            La disponibilidad del agua y su aprovechamiento responsable
            representan retos que requieren información clara, seguimiento
            y herramientas tecnológicas.
          </p>
        </div>

        <div className="row g-4">
          <div className="col-md-6">
            <article className="info-card">
              <div className="card-icon">
                <i className="bi bi-exclamation-triangle"></i>
              </div>

              <h3>La problemática</h3>

              <p>
                La falta de información organizada sobre el consumo y el
                comportamiento del recurso puede dificultar la identificación
                de patrones y la toma de decisiones oportunas.
              </p>
            </article>
          </div>

          <div className="col-md-6">
            <article className="info-card">
              <div className="card-icon">
                <i className="bi bi-lightbulb"></i>
              </div>

              <h3>Nuestra propuesta</h3>

              <p>
                Alerta-Tlaloc busca integrar herramientas de visualización,
                análisis de información y predicción para facilitar la
                interpretación de datos relacionados con la gestión del agua.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* OBJETIVOS */}
      <section className="project-section">
        <div className="section-heading">
          <span className="eyebrow">02 · OBJETIVOS</span>
          <h2>¿Qué buscamos lograr?</h2>
          <p>
            Desarrollar una herramienta que permita consultar información
            relevante y apoyar la toma de decisiones relacionadas con el
            aprovechamiento del agua.
          </p>
        </div>

        <div className="identity-grid">
          <article className="identity-card">
            <div className="identity-icon">
              <i className="bi bi-bullseye"></i>
            </div>

            <h3>Objetivo general</h3>

            <p>
              Desarrollar una plataforma web que integre información,
              visualizaciones y herramientas de análisis para apoyar la
              gestión responsable del agua.
            </p>
          </article>
        </div>

        <div className="row g-4 mt-1">
          <div className="col-md-4">
            <article className="info-card">
              <div className="card-icon">
                <i className="bi bi-bar-chart-line"></i>
              </div>

              <h3>Analizar información</h3>

              <p>
                Organizar y visualizar datos para facilitar su interpretación
                e identificar comportamientos relevantes.
              </p>
            </article>
          </div>

          <div className="col-md-4">
            <article className="info-card">
              <div className="card-icon">
                <i className="bi bi-graph-up-arrow"></i>
              </div>

              <h3>Anticipar escenarios</h3>

              <p>
                Incorporar herramientas de predicción que permitan explorar
                posibles comportamientos futuros.
              </p>
            </article>
          </div>

          <div className="col-md-4">
            <article className="info-card">
              <div className="card-icon">
                <i className="bi bi-droplet"></i>
              </div>

              <h3>Promover eficiencia</h3>

              <p>
                Facilitar información que contribuya a una mayor conciencia
                sobre el uso y aprovechamiento del agua.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* MISIÓN Y VISIÓN */}
      <section className="project-section">
        <div className="section-heading">
          <span className="eyebrow">03 · IDENTIDAD DEL PROYECTO</span>
          <h2>Nuestra misión y visión</h2>
        </div>

        <div className="row g-4 identity-grid">
          <div className="col-md-6">
            <article className="identity-card">
              <div className="identity-icon">
                <i className="bi bi-compass"></i>
              </div>

              <h3>Misión</h3>

              <p>
                Proporcionar una plataforma tecnológica que facilite el
                acceso, análisis e interpretación de información relacionada
                con la gestión del agua, apoyando decisiones más informadas.
              </p>
            </article>
          </div>

          <div className="col-md-6">
            <article className="identity-card vision-card">
              <div className="identity-icon">
                <i className="bi bi-eye"></i>
              </div>

              <h3>Visión</h3>

              <p>
                Ser una propuesta tecnológica que impulse el uso de datos y
                herramientas digitales como apoyo para una gestión del agua
                más eficiente, consciente y sostenible.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section className="closing-section">
        <div className="closing-icon">
          <i className="bi bi-water"></i>
        </div>

        <h2>La información también puede proteger el agua.</h2>

        <p>
          Explora los datos y conoce las herramientas que forman parte de
          Alerta-Tlaloc.
        </p>

        <button
          className="btn button-primary"
          onClick={() => onNavigate('dashboard')}
        >
          Ir al Dashboard
          <i className="bi bi-arrow-right ms-2"></i>
        </button>
      </section>
    </>
  );
}

export default Inicio;