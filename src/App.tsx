import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TaurusMark } from '@/components/TaurusMark'
import { TripProvider } from '@/contexts/TripContext'
import Login from '@/pages/Login'
import { AppShell } from '@/components/layout/AppShell'

// Each page is loaded on demand so opening the app only downloads the page being
// viewed; the rest arrive when the user navigates to them.
const TripsDashboard = lazy(() => import('@/pages/TripsDashboard'))
const Explore = lazy(() => import('@/pages/Explore'))
const TripInfo = lazy(() => import('@/pages/TripInfo'))
const Itinerary = lazy(() => import('@/pages/Itinerary'))
const Places = lazy(() => import('@/pages/Places'))
const Food = lazy(() => import('@/pages/Food'))
const AllPlans = lazy(() => import('@/pages/AllPlans'))
const Budget = lazy(() => import('@/pages/Budget'))

function PageLoader() {
  return (
    <div className="min-h-dvh grid place-items-center bg-canvas">
      <span className="animate-pulse"><TaurusMark size={40} /></span>
    </div>
  )
}

export default function App() {
  const { loading, session } = useAuth()

  if (loading) return <PageLoader />

  if (!session) return <Login />

  return (
    <TripProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<TripsDashboard />} />
            <Route path="/explore" element={<Explore />} />
            <Route element={<AppShell />}>
              <Route path="/info" element={<TripInfo />} />
              <Route path="/itinerary" element={<Itinerary />} />
              <Route path="/places" element={<Places />} />
              <Route path="/food" element={<Food />} />
              <Route path="/plans" element={<AllPlans />} />
              <Route path="/budget" element={<Budget />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TripProvider>
  )
}
