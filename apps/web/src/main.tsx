import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './lib/pwa'
import { initComfort } from './lib/comfort'

// Text size and calmer motion, applied before the first paint
initComfort()

// Makes the app installable and lets it receive push notifications
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
