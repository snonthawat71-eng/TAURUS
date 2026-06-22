import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/Toaster'
import { ConfirmHost } from '@/components/ConfirmHost'
import { registerPWA } from '@/lib/pwa'

registerPWA()

// If we landed on an invite link while logged out, remember the token before the
// login round-trip can drop the /join/<token> path (see PendingInvite in App).
const joinMatch = window.location.pathname.match(/^\/join\/([^/?#]+)/)
if (joinMatch) localStorage.setItem('taurus:pendingInvite', decodeURIComponent(joinMatch[1]))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster />
      <ConfirmHost />
    </AuthProvider>
  </StrictMode>,
)
