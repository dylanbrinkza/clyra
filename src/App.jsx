import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AssetRegister from './pages/AssetRegister'
import AssetDetail from './pages/AssetDetail'
import Questionnaires from './pages/Questionnaires'
import Certifications from './pages/Certifications'
import RiskRegister from './pages/RiskRegister'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
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
