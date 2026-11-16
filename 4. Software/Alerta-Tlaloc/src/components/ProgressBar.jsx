import React from 'react'
import './ProgressBar.css'

function ProgressBar({ visible, progress, message }) {
  if (!visible) return null

  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar-header">
        <span className="progress-bar-label">
          {message || 'Generando reporte...'}
        </span>
        <span className="progress-bar-percent">{Math.round(progress)}%</span>
      </div>

      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar