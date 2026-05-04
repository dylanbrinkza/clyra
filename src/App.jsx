import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import AssetRegister from './pages/AssetRegister'
import AssetDetail from './pages/AssetDetail'
import Questionnaires from './pages/Questionnaires'
import NewQuestionnaire from './pages/NewQuestionnaire'
import QuestionnaireDetail from './pages/QuestionnaireDetail'
import VendorPortal from './pages/VendorPortal'
import Certifications from './pages/Certifications'
import RiskRegister from './pages/RiskRegister'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import AuditLog from './pages/AuditLog'
import OrgContext from './pages/OrgContext'

function ProtectedRoute({ children, session }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [onboardingComplete, setOnboardingComplete] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkOnboarding(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkOnboarding(session.user.id)
      else setOnboardingComplete(undefined)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function checkOnboarding(userId) {
    const { data } = await supabase
      .from('organisation_context')
      .select('onboarding_complete')
      .eq('user_id', userId)
      .single()
    setOnboardingComplete(data?.onboarding_complete === true)
  }

  if (session === undefined || (session && onboardingComplete === undefined)) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--muted)', fontSize: 13 }}>
      Loading...
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={onboardingComplete ? '/dashboard' : '/welcome'} replace /> : <Login />} />
      <Route path="/vendor/:token" element={<VendorPortal />} />

      {/* Onboarding — shown to logged-in users who haven't completed it */}
      <Route path="/welcome" element={
        session
          ? (onboardingComplete ? <Navigate to="/dashboard" replace /> : <Onboarding onComplete={() => setOnboardingComplete(true)} />)
          : <Navigate to="/login" replace />
      } />

      {/* Main app — requires login AND onboarding complete */}
      <Route path="/" element={
        !session ? <Navigate to="/login" replace /> :
        !onboardingComplete ? <Navigate to="/welcome" replace /> :
        <Layout session={session} />
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="assets" element={<AssetRegister />} />
        <Route path="assets/:id" element={<AssetDetail />} />
        <Route path="questionnaires" element={<Questionnaires />} />
        <Route path="questionnaires/new" element={<NewQuestionnaire />} />
        <Route path="questionnaires/:id" element={<QuestionnaireDetail />} />
        <Route path="certifications" element={<Certifications />} />
        <Route path="risk" element={<RiskRegister />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="org-context" element={<OrgContext />} />
      </Route>
    </Routes>
  )
}
