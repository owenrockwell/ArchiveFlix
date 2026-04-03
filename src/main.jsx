import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const redirectedPath = new URLSearchParams(window.location.search).get('p')

if (redirectedPath) {
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const normalizedPath = redirectedPath.startsWith('/') ? redirectedPath : `/${redirectedPath}`
  const nextUrl = `${basePath}${normalizedPath}${window.location.hash}`
  window.history.replaceState(null, '', nextUrl)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
