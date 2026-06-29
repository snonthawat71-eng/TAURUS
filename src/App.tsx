import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
          <Route path="/explore/mine" element={<ExploreManage />} />
          <Route element={<AppShell />}>
            <Route path="/info" element={<TripInfo />} />
            <Route path="/itinerary" element={<Itinerary />} />
            <Route path="/places" element={<PlacesFood />} />
            <Route path="/food" element={<PlacesFood />} />
            <Route path="/plans" element={<AllPlans />} />
            <Route path="/budget" element={<Budget />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TripProvider>
  )
}
