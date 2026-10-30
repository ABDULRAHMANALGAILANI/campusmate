import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { startLanguage } from './lib/i18n'
import './rtl.css'

// Pages are now downloaded on demand. If you publish a new version while
// someone has the site open, their old page files no longer exist on the
// server. Reloading once fetches the new version instead of showing an error.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

// Installable app ("Add to Home screen"). Only on the live site,
// so the dev server never serves an old cached version.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not supported here (e.g. private window): the site still works.
    })
  })
}

// Remember the browser's "install" offer so the Install button can use it
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__campusmateInstall = event
  window.dispatchEvent(new Event('campusmate-installable'))
})

// Load the chosen language first, so pages don't flash in English
startLanguage().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
