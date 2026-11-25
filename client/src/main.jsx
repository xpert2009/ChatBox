import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { startBackendKeepAlive } from './lib/api'

function syncAuroraPlayback() {
  document.documentElement.style.setProperty(
    '--aurora-play-state',
    document.hidden ? 'paused' : 'running',
  )
}

document.addEventListener('visibilitychange', syncAuroraPlayback)
syncAuroraPlayback()
startBackendKeepAlive()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Dream Chat service worker registration failed:', error)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
