import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { IconPlane } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { TripProvider } from '@/contexts/TripContext'
import Login from '@/pages/Login'
import { AppShell } from '@/components/layout/AppShell'
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
        <div className="size-9 rounded-[10px] bg-brand grid place-items-center text-white animate-pulse">
          <IconPlane size={20} stroke={1.75} />
        </div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <TripProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<TripInfo />} />
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
