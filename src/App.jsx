import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AssetRegister from './pages/AssetRegister'
import AssetDetail from './pages/AssetDetail'
import Questionnaires from './pages/Questionnaires'
import Certifications from './pages/Certifications'
import RiskRegister from './pages/RiskRegister'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'

function ProtectedRoute({ children, session }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--muted)', fontSize: 13 }}>
      Loading...
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={
        <ProtectedRoute session={session}>
          <Layout session={session} />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="assets" element={<AssetRegister />} />
        <Route path="assets/:id" element={<AssetDetail />} />
        <Route path="questionnaires" element={<Questionnaires />} />
        <Route path="certifications" element={<Certifications />} />
        <Route path="risk" element={<RiskRegister />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
      </Route>
    </Routes>
  )
}
