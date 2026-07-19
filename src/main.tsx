import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { DemoTargetApp } from './DemoTargetApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/demo-target' ? <DemoTargetApp /> : <App />}
  </StrictMode>
)
