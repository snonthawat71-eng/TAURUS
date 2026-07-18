import { useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TaurusMark } from '@/components/TaurusMark'
import { TripProvider } from '@/contexts/TripContext'
import Login from '@/pages/Login'
import { AppShell } from '@/components/layout/AppShell'
import TripsDashboard from '@/pages/TripsDashboard'
import Explore from '@/pages/Explore'
import ExploreManage from '@/pages/ExploreManage'
import ExplorePlaceDetail from '@/pages/ExplorePlaceDetail'
import Profile from '@/pages/Profile'
import TripInfo from '@/pages/TripInfo'
import Itinerary from '@/pages/Itinerary'
import PlacesFood from '@/pages/PlacesFood'
import AllPlans from '@/pages/AllPlans'
import Budget from '@/pages/Budget'
import TripMap from '@/pages/TripMap'
import CreateTrip from '@/pages/CreateTrip'
import JoinTrip, { PENDING_INVITE_KEY } from '@/pages/JoinTrip'
import { canvasColor } from '@/lib/theme'

// Take scroll fully into our own hands: the browser's automatic restoration on
// back/forward fires at its own (async) time and fights the app's scrolling,
// which shows up as a visible double-jump when swiping back. With 'manual' the
// browser never touches scroll — ScrollManager below decides instead.
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

// Every route change lands at the top, synchronously before first paint
// (useLayoutEffect) so there's no flash of the old position. Exceptions:
// list pages that restore their own saved position when returning from a
// place detail (see pages/Explore.tsx and pages/ExploreManage.tsx).
function ScrollManager() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    if (pathname === '/explore' || pathname === '/explore/mine') return
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

// The profile page paints the whole top of the screen navy (status-bar zone,
// pull-down overscroll, browser theme colour). Driven off the route — asserted
// on EVERY navigation — so the navy can never leak onto other pages.
function ProfileChrome() {
  const { pathname } = useLocation()
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const meta = document.querySelector('meta[name="theme-color"]')
    if (pathname === '/profile') {
      const grad = 'linear-gradient(180deg, #0A2A6B 0%, #0A2A6B 55%, var(--color-canvas) 55%)'
      // Safari colours the status-bar zone from background-COLOR (gradients are
      // background-images and get ignored there) — set both.
      html.style.background = grad
      html.style.backgroundColor = '#0A2A6B'
      body.style.background = grad
      body.style.backgroundColor = '#0A2A6B'
      // no rubber-banding here: the bottom bounce would show the navy that the
      // top needs (iOS paints both edges from one colour)
      html.style.overscrollBehaviorY = 'none'
      meta?.setAttribute('content', '#0A2A6B')
    } else if (pathname.startsWith('/explore/p/')) {
      // Place detail: the photo runs full-bleed to the very top. The page itself
      // then repaints these the colour sampled from the photo's top edge; this
      // is just the pre-sample default. Keep overscroll so pull-to-refresh works.
      html.style.background = '#2a3340'
      html.style.backgroundColor = '#2a3340'
      body.style.background = '#2a3340'
      body.style.backgroundColor = '#2a3340'
      html.style.overscrollBehaviorY = ''
      meta?.setAttribute('content', '#2a3340')
    } else {
      // Explicit colours (not just clearing) — Safari re-samples the status-bar
      // tint more reliably when the value actually changes to a concrete colour.
      const canvas = canvasColor() // follows light/dark theme
      html.style.background = 'var(--color-canvas)'
      html.style.backgroundColor = canvas
      body.style.background = 'var(--color-canvas)'
      body.style.backgroundColor = canvas
      html.style.overscrollBehaviorY = '' // back to the global 'contain'
      meta?.setAttribute('content', canvas)
    }
  }, [pathname])
  return null
}

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
        <ProfileChrome />
        <ScrollManager />
        <Routes>
          <Route path="/" element={<TripsDashboard />} />
          <Route path="/create" element={<CreateTrip />} />
          <Route path="/join/:token" element={<JoinTrip />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/mine" element={<ExploreManage />} />
          <Route path="/explore/p/:id" element={<ExplorePlaceDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route element={<AppShell />}>
            <Route path="/info" element={<TripInfo />} />
            <Route path="/itinerary" element={<Itinerary />} />
            <Route path="/places" element={<PlacesFood />} />
            <Route path="/food" element={<PlacesFood />} />
            <Route path="/plans" element={<AllPlans />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/map" element={<TripMap />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TripProvider>
  )
}
