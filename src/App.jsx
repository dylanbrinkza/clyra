import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { isSuperAdmin, getUserOrg } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import AdminPortal from './pages/AdminPortal'
import AcceptInvite from './pages/AcceptInvite'
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

export default function App() {
  const [session, setSession] = useState(undefined)
  const [userRole, setUserRole] = useState(undefined) // 'superadmin' | 'tenant' | null
  const [onboardingComplete, setOnboardingComplete] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) resolveUser(session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) resolveUser(session.user)
      else { setUserRole(null); setOnboardingComplete(undefined) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function resolveUser(user) {
    const admin = await isSuperAdmin(user.id)
    if (admin) {
      setUserRole('superadmin')
      setOnboardingComplete(true)
      return
    }
    setUserRole('tenant')
    const { data } = await supabase
      .from('organisation_context')
      .select('onboarding_complete')
      .eq('user_id', user.id)
      .single()
    setOnboardingComplete(data?.onboarding_complete === true)
  }

  // Re-check onboarding when navigating back — handles case where
  // onboarding sets complete=true then navigates to /questionnaires/new
  useEffect(() => {
    async function recheck() {
      if (!session || userRole === 'superadmin' || onboardingComplete) return
      const { data } = await supabase
        .from('organisation_context')
        .select('onboarding_complete')
        .eq('user_id', session.user.id)
        .single()
      if (data?.onboarding_complete === true) setOnboardingComplete(true)
    }
    recheck()
  }, [session, userRole])

  const loading = session === undefined || (session && userRole === undefined)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--muted)', fontSize: 13 }}>
      Loading...
    </div>
  )

  // Where does a logged-in user land?
  const defaultRedirect = () => {
    if (!session) return '/login'
    if (userRole === 'superadmin') return '/admin'
    if (!onboardingComplete) return '/welcome'
    return '/dashboard'
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={session ? <Navigate to={defaultRedirect()} replace /> : <Login />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/vendor/:token" element={<VendorPortal />} />

      {/* Super admin */}
      <Route path="/admin" element={
        !session ? <Navigate to="/login" replace /> :
        userRole !== 'superadmin' ? <Navigate to="/dashboard" replace /> :
        <AdminPortal />
      } />

      {/* Onboarding — tenant users who haven't finished setup */}
      <Route path="/welcome" element={
        !session ? <Navigate to="/login" replace /> :
        userRole === 'superadmin' ? <Navigate to="/admin" replace /> :
        onboardingComplete ? <Navigate to="/dashboard" replace /> :
        <Onboarding onComplete={() => setOnboardingComplete(true)} setOnboardingComplete={setOnboardingComplete} />
      } />

      {/* Main app */}
      <Route path="/" element={
        !session ? <Navigate to="/login" replace /> :
        userRole === 'superadmin' ? <Navigate to="/admin" replace /> :
        onboardingComplete === false ? <Navigate to="/welcome" replace /> :
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

      <Route path="*" element={<Navigate to={defaultRedirect()} replace />} />
    </Routes>
  )
}
