import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TaurusMark } from '@/components/TaurusMark'
import { TripProvider } from '@/contexts/TripContext'
import Login from '@/pages/Login'
import { AppShell } from '@/components/layout/AppShell'
import TripsDashboard from '@/pages/TripsDashboard'
import Explore from '@/pages/Explore'
import TripInfo from '@/pages/TripInfo'
import Itinerary from '@/pages/Itinerary'
import Places from '@/pages/Places'
import Food from '@/pages/Food'
import AllPlans from '@/pages/AllPlans'
import Budget from '@/pages/Budget'

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
      </BrowserRouter>
    </TripProvider>
  )
}
