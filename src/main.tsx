import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/Toaster'
import { ConfirmHost } from '@/components/ConfirmHost'
import { PullToRefresh } from '@/components/PullToRefresh'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { registerPWA } from '@/lib/pwa'
import { initTheme } from '@/lib/theme'

registerPWA()
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
        <Toaster />
        <ConfirmHost />
        <PullToRefresh />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
