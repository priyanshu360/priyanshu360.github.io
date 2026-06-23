import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre style="color:#ff4444;padding:20px">Error: ${e.message}\n${e.error?.stack || ''}</pre>`
  }
})

window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `<pre style="color:#ff4444;padding:20px">Unhandled Rejection: ${e.reason?.message || e.reason}</pre>`
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
