import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/ibm-plex-sans/wght.css'
import '@fontsource/ibm-plex-mono/400.css'
import { App } from './App'
import { DemoTargetApp } from './DemoTargetApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/demo-target' ? <DemoTargetApp /> : <App />}
  </StrictMode>
)
