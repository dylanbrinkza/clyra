import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUserRole } from '../lib/auth'
import '../styles/app.css'

function SidebarItem({ to, icon, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
      {icon}
      {children}
    </NavLink>
  )
}

const icons = {
  dashboard: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>,
  assets: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M2 8h12M2 13h8"/></svg>,
  questionnaires: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/></svg>,
  certifications: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="7" r="5"/><path d="M5.5 12.5L8 14l2.5-1.5V10H5.5v2.5z"/></svg>,
  risk: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 13L5 5l4 4 3-6 3 8"/></svg>,
  incidents: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11v.5"/></svg>,
  audit: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M3 8h10M3 12h6"/><circle cx="13" cy="12" r="2"/></svg>,
  org: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="8" rx="1"/><path d="M5 14h6M8 10v4"/></svg>,
}

export default function Layout({ session }) {
  const navigate = useNavigate()
  const [role, setRole] = useState(null)

  useEffect(() => {
    getUserRole().then(setRole)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const email = session?.user?.email || ''
  const initials = email ? email.slice(0, 2).toUpperCase() : '??'
  const isAdmin = role === 'admin' || role === 'org_admin'

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">Cly<em>ra</em></div>
        <div style={{ flex: 1 }} />
        <div className="user-area">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12 }}>{email}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
              {isAdmin ? 'Org admin' : 'Member'}
            </div>
          </div>
          <div className="avatar" style={{ cursor: 'pointer' }} onClick={handleSignOut} title="Sign out">
            {initials}
          </div>
        </div>
      </div>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Overview</div>
            <SidebarItem to="/dashboard" icon={icons.dashboard}>Dashboard</SidebarItem>
            <SidebarItem to="/assets" icon={icons.assets}>Asset register</SidebarItem>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Assess</div>
            <SidebarItem to="/questionnaires" icon={icons.questionnaires}>Questionnaires</SidebarItem>
            <SidebarItem to="/certifications" icon={icons.certifications}>Certifications</SidebarItem>
            <SidebarItem to="/risk" icon={icons.risk}>Risk register</SidebarItem>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Respond</div>
            <SidebarItem to="/incidents" icon={icons.incidents}>Incidents</SidebarItem>
          </div>

          {/* Admin-only section */}
          {isAdmin && (
            <div className="sidebar-section">
              <div className="sidebar-label">Admin</div>
              <SidebarItem to="/audit" icon={icons.audit}>Audit log</SidebarItem>
              <SidebarItem to="/org-context" icon={icons.org}>Organisation</SidebarItem>
            </div>
          )}

          <div style={{ position: 'absolute', bottom: '1.5rem', left: 0, width: 210, padding: '0 1.25rem' }}>
            <button onClick={handleSignOut} style={{ width: '100%', padding: '7px 0', fontSize: 12, color: 'var(--muted)', background: 'none', border: '0.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign out
            </button>
          </div>
        </aside>

        <main className="main">
          <Outlet context={{ role, isAdmin }} />
        </main>
      </div>
    </div>
  )
}
