import './zod-config'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/anybody/standard.css'
import '@fontsource-variable/instrument-sans/standard.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/tokens.css'
import './styles/app.css'
import './styles/screens.css'
import { App } from './App'

// Any Content-Security-Policy violation is logged, so tests and Diagnostics can see it.
document.addEventListener('securitypolicyviolation', (e) => {
  window.readyup.log('csp.violation', { directive: e.effectiveDirective, blocked: String(e.blockedURI).slice(0, 200) })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
