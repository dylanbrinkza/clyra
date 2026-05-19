import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SUPER_ADMIN_ID = 'de9ef1de-9441-4ea2-b5ef-a32ad0a5c04a'

export default function AdminPortal() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('orgs') // 'orgs' | 'users'
  const [allMembers, setAllMembers] = useState([])

  // Modals
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [showInvite, setShowInvite] = useState(null)
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState(null)
  const [deleteUserConfirm, setDeleteUserConfirm] = useState(null)
  const [resetPasswordModal, setResetPasswordModal] = useState(null)
  const [resetSent, setResetSent] = useState(false)

  // Form state
  const [newOrgName, setNewOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLink, setInviteLink] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: orgsData } = await supabase
      .from('organisations')
      .select('*, org_memberships(user_id, role, created_at)')
      .order('created_at')

    const enriched = await Promise.all((orgsData || []).map(async org => {
      const [{ count: assetCount }, { count: qCount }, pendingInvites, acceptedInvites] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }).eq('org_id', org.id).is('deleted_at', null),
        supabase.from('questionnaires').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('org_invites').select('*').eq('org_id', org.id).eq('accepted', false).gt('expires_at', new Date().toISOString()),
        supabase.from('org_invites').select('email, user_id').eq('org_id', org.id).eq('accepted', true),
      ])
      const memberships = (org.org_memberships || []).map(m => ({
        ...m,
        email: acceptedInvites.data?.find(i => i.user_id === m.user_id)?.email || null,
        org_id: org.id,
        org_name: org.name,
      }))
      return {
        ...org,
        org_memberships: memberships,
        asset_count: assetCount || 0,
        q_count: qCount || 0,
        pending_invites: pendingInvites.data || [],
      }
    }))

    setOrgs(enriched)

    // Build flat users list across all orgs
    const members = []
    enriched.forEach(org => {
      org.org_memberships.forEach(m => {
        if (m.user_id !== SUPER_ADMIN_ID) {
          members.push({ ...m, org_name: org.name, org_id: org.id })
        }
      })
    })
    setAllMembers(members)
    setLoading(false)
  }

  const createOrg = async () => {
    if (!newOrgName.trim()) return
    setCreating(true)
    setError('')
    try {
      const slug = newOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      const { error } = await supabase.from('organisations').insert([{ name: newOrgName.trim(), slug, created_by: 'dylanbrinkza@gmail.com' }])
      if (error) throw error
      setNewOrgName('')
      setShowCreateOrg(false)
      await fetchAll()
    } catch (err) { setError(err.message) }
    setCreating(false)
  }

  const createInvite = async () => {
    if (!inviteEmail.trim() || !showInvite) return
    setInviting(true)
    setError('')
    try {
      const { data, error } = await supabase.from('org_invites')
        .insert([{ org_id: showInvite.id, email: inviteEmail.trim(), role: inviteRole }])
        .select().single()
      if (error) throw error
      setInviteLink(`${window.location.origin}/invite/${data.token}`)
      setInviteEmail('')
    } catch (err) { setError(err.message) }
    setInviting(false)
  }

  const deleteOrg = async (orgId) => {
    await supabase.from('organisations').delete().eq('id', orgId)
    setDeleteOrgConfirm(null)
    await fetchAll()
  }

  const removeUser = async () => {
    if (!deleteUserConfirm) return
    await supabase.from('org_memberships').delete().eq('user_id', deleteUserConfirm.userId).eq('org_id', deleteUserConfirm.orgId)
    await supabase.from('organisation_context').delete().eq('user_id', deleteUserConfirm.userId)
    setDeleteUserConfirm(null)
    await fetchAll()
  }

  const updateRole = async (userId, orgId, newRole) => {
    await supabase.from('org_memberships').update({ role: newRole }).eq('user_id', userId).eq('org_id', orgId)
    await fetchAll()
  }

  const sendPasswordReset = async () => {
    if (!resetPasswordModal) return
    setResetSent(false)
    const { error } = await supabase.auth.resetPasswordForEmail(resetPasswordModal.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (!error) setResetSent(true)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const stats = {
    orgs: orgs.filter(o => o.id !== '00000000-0000-0000-0000-000000000001').length,
    users: allMembers.length,
    assets: orgs.reduce((a, o) => a + o.asset_count, 0),
    pending: orgs.reduce((a, o) => a + o.pending_invites.length, 0),
  }

  const isAdminTenant = (org) => org.id === '00000000-0000-0000-0000-000000000001'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F0A05', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5F0E8', fontSize: 13 }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0F0A05', color: '#F5F0E8', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ borderBottom: '0.5px solid rgba(245,240,232,0.08)', padding: '0 2rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#0F0A05', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 500 }}>Cly<em style={{ fontStyle: 'italic', color: '#D4A97A' }}>ra</em></div>
          <div style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(181,73,10,0.25)', color: '#D4A97A', borderRadius: 4, fontWeight: 600, letterSpacing: '0.08em' }}>SUPER ADMIN</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)' }}>dylanbrinkza@gmail.com</span>
          <button onClick={signOut} style={ghostBtn}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '2rem' }}>
          {[
            ['Organisations', stats.orgs, '#D4A97A'],
            ['Users', stats.users, '#F5F0E8'],
            ['Assets', stats.assets, '#F5F0E8'],
            ['Pending invites', stats.pending, stats.pending > 0 ? '#D4A97A' : '#F5F0E8'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: 'rgba(245,240,232,0.04)', border: '0.5px solid rgba(245,240,232,0.08)', borderRadius: 10, padding: '1.25rem 1.5rem' }}>
              <div style={{ fontSize: 28, fontWeight: 500, color, marginBottom: 4 }}>{val}</div>
              <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.45)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '0.5px solid rgba(245,240,232,0.08)' }}>
          {[['orgs', 'Organisations'], ['users', 'All users']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: '10px 20px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === key ? '#F5F0E8' : 'rgba(245,240,232,0.4)',
              fontWeight: activeTab === key ? 500 : 400,
              borderBottom: activeTab === key ? '2px solid #D4A97A' : '2px solid transparent',
              marginBottom: -1, fontFamily: 'inherit',
            }}>{label}</button>
          ))}
          <div style={{ flex: 1 }} />
          {activeTab === 'orgs' && (
            <button onClick={() => setShowCreateOrg(true)} style={{ margin: '6px 0', padding: '6px 16px', background: '#B5490A', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              + New organisation
            </button>
          )}
        </div>

        {error && <div style={{ fontSize: 12, color: '#ff6b6b', padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: 6, marginBottom: 16 }}>{error}</div>}

        {/* ORGS TAB */}
        {activeTab === 'orgs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orgs.map(org => (
              <div key={org.id} style={{ background: 'rgba(245,240,232,0.03)', border: `0.5px solid ${isAdminTenant(org) ? 'rgba(212,169,122,0.25)' : 'rgba(245,240,232,0.08)'}`, borderRadius: 12, overflow: 'hidden' }}>

                {/* Org header */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(245,240,232,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: isAdminTenant(org) ? 'rgba(212,169,122,0.15)' : 'rgba(245,240,232,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: isAdminTenant(org) ? '#D4A97A' : '#F5F0E8' }}>
                      {org.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{org.name}</span>
                        {isAdminTenant(org) && <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(212,169,122,0.15)', color: '#D4A97A', borderRadius: 3, fontWeight: 600, letterSpacing: '0.06em' }}>ADMIN TENANT</span>}
                        <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)' }}>/{org.slug}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginTop: 2 }}>
                        {org.org_memberships.length} member{org.org_memberships.length !== 1 ? 's' : ''} · {org.asset_count} asset{org.asset_count !== 1 ? 's' : ''} · {org.q_count} questionnaire{org.q_count !== 1 ? 's' : ''} · Created {new Date(org.created_at).toLocaleDateString()}
                        {org.pending_invites.length > 0 && <span style={{ color: '#D4A97A', marginLeft: 8 }}>· {org.pending_invites.length} pending invite{org.pending_invites.length !== 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setShowInvite(org); setInviteLink(''); setInviteEmail(''); setInviteRole('member') }} style={ghostBtn}>Invite user</button>
                    {!isAdminTenant(org) && <button onClick={() => setDeleteOrgConfirm(org)} style={dangerBtn}>Delete</button>}
                  </div>
                </div>

                {/* Members table */}
                {org.org_memberships.length > 0 && (
                  <div style={{ padding: '0 1.25rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['User', 'Role', 'Joined', 'Actions'].map(h => (
                            <th key={h} style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)', textAlign: 'left', padding: '10px 0 8px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '0.5px solid rgba(245,240,232,0.06)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {org.org_memberships.map((m, i) => (
                          <tr key={m.user_id} style={{ borderBottom: i < org.org_memberships.length - 1 ? '0.5px solid rgba(245,240,232,0.04)' : 'none' }}>
                            <td style={{ padding: '10px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(245,240,232,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                                  {(m.email || m.user_id)[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontSize: 13 }}>{m.email || <span style={{ color: 'rgba(245,240,232,0.4)', fontStyle: 'italic' }}>Pending email...</span>}</div>
                                  <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)' }}>{m.user_id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 0' }}>
                              {m.user_id === SUPER_ADMIN_ID ? (
                                <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(212,169,122,0.15)', color: '#D4A97A', borderRadius: 4 }}>Super admin</span>
                              ) : (
                                <select value={m.role || 'member'} onChange={e => updateRole(m.user_id, org.id, e.target.value)}
                                  style={{ fontSize: 12, padding: '4px 8px', background: 'rgba(245,240,232,0.06)', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 6, color: '#F5F0E8', fontFamily: 'inherit', cursor: 'pointer' }}>
                                  <option value="admin">Org admin</option>
                                  <option value="member">Member</option>
                                </select>
                              )}
                            </td>
                            <td style={{ padding: '10px 0', fontSize: 12, color: 'rgba(245,240,232,0.4)' }}>
                              {new Date(m.created_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '10px 0' }}>
                              {m.user_id !== SUPER_ADMIN_ID && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {m.email && (
                                    <button onClick={() => { setResetPasswordModal({ email: m.email, name: m.email }); setResetSent(false) }} style={smallGhostBtn}>
                                      Reset password
                                    </button>
                                  )}
                                  <button onClick={() => setDeleteUserConfirm({ userId: m.user_id, orgId: org.id, orgName: org.name, email: m.email })} style={smallDangerBtn}>
                                    Remove
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pending invites */}
                {org.pending_invites.length > 0 && (
                  <div style={{ padding: '8px 1.25rem 10px', background: 'rgba(212,169,122,0.04)', borderTop: '0.5px solid rgba(212,169,122,0.1)' }}>
                    {org.pending_invites.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(245,240,232,0.5)', padding: '4px 0' }}>
                        <span style={{ color: '#D4A97A' }}>⏳</span>
                        <span>Invite pending: <strong style={{ color: '#D4A97A' }}>{inv.email}</strong></span>
                        <span>expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div style={{ background: 'rgba(245,240,232,0.03)', border: '0.5px solid rgba(245,240,232,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(245,240,232,0.08)' }}>
                  {['User', 'Organisation', 'Role', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)', textAlign: 'left', padding: '12px 16px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allMembers.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'rgba(245,240,232,0.3)', fontSize: 13 }}>No users yet</td></tr>
                ) : allMembers.map((m, i) => (
                  <tr key={`${m.user_id}-${m.org_id}`} style={{ borderBottom: i < allMembers.length - 1 ? '0.5px solid rgba(245,240,232,0.05)' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(245,240,232,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {(m.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13 }}>{m.email || <span style={{ color: 'rgba(245,240,232,0.4)', fontStyle: 'italic' }}>No email yet</span>}</div>
                          <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)' }}>{m.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(245,240,232,0.6)' }}>{m.org_name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <select value={m.role || 'member'} onChange={e => updateRole(m.user_id, m.org_id, e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', background: 'rgba(245,240,232,0.06)', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 6, color: '#F5F0E8', fontFamily: 'inherit', cursor: 'pointer' }}>
                        <option value="admin">Org admin</option>
                        <option value="member">Member</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(245,240,232,0.4)' }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {m.email && (
                          <button onClick={() => { setResetPasswordModal({ email: m.email }); setResetSent(false) }} style={smallGhostBtn}>
                            Reset password
                          </button>
                        )}
                        <button onClick={() => setDeleteUserConfirm({ userId: m.user_id, orgId: m.org_id, orgName: m.org_name, email: m.email })} style={smallDangerBtn}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE ORG MODAL */}
      {showCreateOrg && (
        <Modal onClose={() => setShowCreateOrg(false)}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Create organisation</div>
          <label style={mLabel}>Organisation name</label>
          <input value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Acme Corp"
            onKeyDown={e => e.key === 'Enter' && createOrg()} autoFocus style={mInput} />
          {error && <div style={errStyle}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setShowCreateOrg(false)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
            <button onClick={createOrg} disabled={creating || !newOrgName.trim()} style={{ flex: 2, padding: '9px', background: '#B5490A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {creating ? 'Creating...' : 'Create organisation'}
            </button>
          </div>
        </Modal>
      )}

      {/* INVITE MODAL */}
      {showInvite && (
        <Modal onClose={() => { setShowInvite(null); setInviteLink(''); setInviteEmail(''); setInviteRole('member') }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Invite user</div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 20 }}>Invite someone to <strong style={{ color: '#D4A97A' }}>{showInvite.name}</strong></div>
          <label style={mLabel}>Email address</label>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@company.com" type="email" style={mInput} />
          <label style={{ ...mLabel, marginTop: 12 }}>Role</label>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...mInput, cursor: 'pointer' }}>
            <option value="member">Member — view only</option>
            <option value="admin">Org admin — full access</option>
          </select>
          <button onClick={createInvite} disabled={inviting || !inviteEmail.trim()} style={{ width: '100%', marginTop: 16, padding: '9px', background: '#B5490A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {inviting ? 'Generating...' : 'Generate invite link'}
          </button>
          {inviteLink && (
            <div style={{ marginTop: 16, padding: '12px', background: 'rgba(245,240,232,0.04)', borderRadius: 8, border: '0.5px solid rgba(245,240,232,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', marginBottom: 8 }}>Share this link with the user — expires in 7 days</div>
              <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.7)', wordBreak: 'break-all', marginBottom: 10, lineHeight: 1.5 }}>{inviteLink}</div>
              <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ ...ghostBtn, width: '100%' }}>Copy link</button>
            </div>
          )}
          {error && <div style={{ ...errStyle, marginTop: 10 }}>{error}</div>}
        </Modal>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordModal && (
        <Modal onClose={() => { setResetPasswordModal(null); setResetSent(false) }}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Reset password</div>
          <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
            Send a password reset email to <strong style={{ color: '#F5F0E8' }}>{resetPasswordModal.email}</strong>
          </div>
          {resetSent ? (
            <div style={{ padding: '12px', background: 'rgba(46,125,50,0.15)', borderRadius: 8, fontSize: 13, color: '#81C784', textAlign: 'center' }}>
              ✓ Reset email sent successfully
            </div>
          ) : (
            <button onClick={sendPasswordReset} style={{ width: '100%', padding: '9px', background: '#B5490A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Send reset email
            </button>
          )}
        </Modal>
      )}

      {/* DELETE ORG MODAL */}
      {deleteOrgConfirm && (
        <Modal onClose={() => setDeleteOrgConfirm(null)}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Delete {deleteOrgConfirm.name}?</div>
          <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
            This permanently deletes the organisation and all its data — assets, questionnaires, users. Cannot be undone.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeleteOrgConfirm(null)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
            <button onClick={() => deleteOrg(deleteOrgConfirm.id)} style={{ flex: 2, padding: '9px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Delete permanently
            </button>
          </div>
        </Modal>
      )}

      {/* REMOVE USER MODAL */}
      {deleteUserConfirm && (
        <Modal onClose={() => setDeleteUserConfirm(null)}>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Remove user?</div>
          <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', marginBottom: 8, lineHeight: 1.5 }}>
            Remove <strong style={{ color: '#F5F0E8' }}>{deleteUserConfirm.email || deleteUserConfirm.userId}</strong> from <strong style={{ color: '#F5F0E8' }}>{deleteUserConfirm.orgName}</strong>?
          </div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 20 }}>They will lose access immediately and need to be re-invited.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setDeleteUserConfirm(null)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
            <button onClick={removeUser} style={{ flex: 2, padding: '9px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Remove user
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
      <div style={{ position: 'relative', background: '#1A1208', border: '0.5px solid rgba(245,240,232,0.12)', borderRadius: 14, padding: '1.75rem', width: 440, zIndex: 1, maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

const ghostBtn = { fontSize: 12, padding: '6px 14px', background: 'rgba(245,240,232,0.06)', color: 'rgba(245,240,232,0.7)', border: '0.5px solid rgba(245,240,232,0.12)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }
const dangerBtn = { fontSize: 12, padding: '6px 14px', background: 'rgba(192,57,43,0.12)', color: '#ff6b6b', border: '0.5px solid rgba(192,57,43,0.25)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }
const smallGhostBtn = { fontSize: 11, padding: '4px 10px', background: 'rgba(245,240,232,0.06)', color: 'rgba(245,240,232,0.6)', border: '0.5px solid rgba(245,240,232,0.1)', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit' }
const smallDangerBtn = { fontSize: 11, padding: '4px 10px', background: 'rgba(192,57,43,0.1)', color: '#ff6b6b', border: '0.5px solid rgba(192,57,43,0.2)', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit' }
const mLabel = { fontSize: 12, color: 'rgba(245,240,232,0.5)', display: 'block', marginBottom: 6 }
const mInput = { width: '100%', padding: '9px 12px', background: 'rgba(245,240,232,0.06)', border: '0.5px solid rgba(245,240,232,0.12)', borderRadius: 8, fontSize: 13, color: '#F5F0E8', outline: 'none', fontFamily: 'inherit' }
const errStyle = { fontSize: 12, color: '#ff6b6b', padding: '8px 10px', background: 'rgba(255,107,107,0.08)', borderRadius: 6 }
