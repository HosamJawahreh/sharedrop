import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { primeFlowAudio } from '@/features/nearby-send/ux/flow-sounds'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

function primeAudioOnFirstGesture(): void {
  window.addEventListener('pointerdown', () => primeFlowAudio(), { once: true, passive: true })
}

primeAudioOnFirstGesture()

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
