import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../styles/app.css'

function SidebarItem({ to, icon, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
      {icon}
      {children}
    </NavLink>
  )
}

export default function Layout({ session }) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const email = session?.user?.email || ''
  const initials = email ? email.slice(0, 2).toUpperCase() : 'JH'

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">Cly<em>ra</em></div>
        <nav className="nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Dashboard</NavLink>
          <NavLink to="/assets" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Vendors</NavLink>
          <NavLink to="/risk" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Risk</NavLink>
          <NavLink to="/incidents" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Incidents</NavLink>
        </nav>
        <div className="user-area">
          <span style={{ fontSize: 12 }}>{email}</span>
          <div className="avatar" style={{ cursor: 'pointer' }} onClick={handleSignOut} title="Sign out">
            {initials}
          </div>
        </div>
      </div>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Overview</div>
            <SidebarItem to="/dashboard" icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
              </svg>
            }>Dashboard</SidebarItem>
            <SidebarItem to="/assets" icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 3h12M2 8h12M2 13h8"/>
              </svg>
            }>Asset register</SidebarItem>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Assess</div>
            <SidebarItem to="/questionnaires" icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/>
              </svg>
            }>Questionnaires</SidebarItem>
            <SidebarItem to="/certifications" icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="7" r="5"/><path d="M5.5 12.5L8 14l2.5-1.5V10H5.5v2.5z"/>
              </svg>
            }>Certifications</SidebarItem>
            <SidebarItem to="/risk" icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 13L5 5l4 4 3-6 3 8"/>
              </svg>
            }>Risk register</SidebarItem>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Respond</div>
            <SidebarItem to="/incidents" icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11v.5"/>
              </svg>
            }>Incidents</SidebarItem>
          </div>

          <div style={{ position: 'absolute', bottom: '1.5rem', left: 0, width: 210, padding: '0 1.25rem' }}>
            <button onClick={handleSignOut} style={{
              width: '100%', padding: '7px 0', fontSize: 12, color: 'var(--muted)',
              background: 'none', border: '0.5px solid var(--border)', borderRadius: 6,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>
              Sign out
            </button>
          </div>
        </aside>

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
