import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TaurusMark } from '@/components/TaurusMark'
import { TripProvider } from '@/contexts/TripContext'
import Login from '@/pages/Login'
import { AppShell } from '@/components/layout/AppShell'
import TripsDashboard from '@/pages/TripsDashboard'
import Explore from '@/pages/Explore'
import ExploreManage from '@/pages/ExploreManage'
import TripInfo from '@/pages/TripInfo'
import Itinerary from '@/pages/Itinerary'
import PlacesFood from '@/pages/PlacesFood'
import AllPlans from '@/pages/AllPlans'
import Budget from '@/pages/Budget'
import TripMap from '@/pages/TripMap'
import CreateTrip from '@/pages/CreateTrip'
import JoinTrip, { PENDING_INVITE_KEY } from '@/pages/JoinTrip'

// After the OAuth redirect (which always lands on "/"), resume a pending
// invite so the user comes straight back to the welcome page to confirm.
function PendingInviteRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (location.pathname.startsWith('/join/')) return
    let tok: string | null = null
    try { tok = localStorage.getItem(PENDING_INVITE_KEY) } catch { /* ignore */ }
    if (tok) navigate(`/join/${tok}`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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

  // invite links work logged-out — the join page walks the user through login
  if (!session) {
    if (window.location.pathname.startsWith('/join/')) {
      return (
        <BrowserRouter>
          <Routes>
            <Route path="/join/:token" element={<JoinTrip />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </BrowserRouter>
      )
    }
    return <Login />
  }

  return (
    <TripProvider>
      <BrowserRouter>
        <PendingInviteRedirect />
        <Routes>
          <Route path="/" element={<TripsDashboard />} />
          <Route path="/create" element={<CreateTrip />} />
          <Route path="/join/:token" element={<JoinTrip />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/mine" element={<ExploreManage />} />
          <Route element={<AppShell />}>
            <Route path="/info" element={<TripInfo />} />
            <Route path="/itinerary" element={<Itinerary />} />
            <Route path="/places" element={<PlacesFood />} />
            <Route path="/food" element={<PlacesFood />} />
            <Route path="/plans" element={<AllPlans />} />
            <Route path="/budget" element={<Budget />} />
            {/* test-only map, not in the nav yet */}
            <Route path="/map" element={<TripMap />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TripProvider>
  )
}
