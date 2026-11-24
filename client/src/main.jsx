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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
