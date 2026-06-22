import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TaurusMark } from '@/components/TaurusMark'
import { TripProvider } from '@/contexts/TripContext'
import Login from '@/pages/Login'
import { AppShell } from '@/components/layout/AppShell'
import TripsDashboard from '@/pages/TripsDashboard'
import Explore from '@/pages/Explore'
import ExploreManage from '@/pages/ExploreManage'
import JoinTrip from '@/pages/JoinTrip'
import TripInfo from '@/pages/TripInfo'
import Itinerary from '@/pages/Itinerary'
import Places from '@/pages/Places'
import Food from '@/pages/Food'
import AllPlans from '@/pages/AllPlans'
import Budget from '@/pages/Budget'

// After logging in via an invite link, the OAuth/magic-link round-trip can drop
// the /join/<token> path (it redirects to the site root). main.tsx stashes the
// token before that happens; here we send the now-authenticated user back to it.
function PendingInvite() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    const tok = localStorage.getItem('taurus:pendingInvite')
    if (tok && !pathname.startsWith('/join')) navigate(`/join/${tok}`, { replace: true })
  }, [pathname, navigate])
  return null
}

export default function App() {
  const { loading, session } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-canvas">
        <span className="animate-pulse"><TaurusMark size={40} /></span>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <TripProvider>
      <BrowserRouter>
        <PendingInvite />
        <Routes>
          <Route path="/" element={<TripsDashboard />} />
          <Route path="/join/:token" element={<JoinTrip />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/mine" element={<ExploreManage />} />
          <Route element={<AppShell />}>
            <Route path="/info" element={<TripInfo />} />
            <Route path="/itinerary" element={<Itinerary />} />
            <Route path="/places" element={<Places />} />
            <Route path="/food" element={<Food />} />
            <Route path="/plans" element={<AllPlans />} />
            <Route path="/budget" element={<Budget />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TripProvider>
  )
}
