import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminPortal() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [showInvite, setShowInvite] = useState(null) // org object
  const [newOrgName, setNewOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteUserConfirm, setDeleteUserConfirm] = useState(null) // { userId, email, orgId }
  const [members, setMembers] = useState({}) // orgId -> [{ user_id, role, email }]
  const [loadingMembers, setLoadingMembers] = useState({})

  useEffect(() => { fetchOrgs() }, [])

  async function fetchOrgs() {
    const { data: orgsData } = await supabase
      .from('organisations')
      .select('*, org_memberships(user_id, role, created_at)')
      .order('created_at')

    // Get asset and questionnaire counts per org
    const enriched = await Promise.all((orgsData || []).map(async org => {
      const [{ count: assetCount }, { count: qCount }, invitesData, acceptedInvites] = await Promise.all([
        supabase.from('assets').select('*', { count: 'exact', head: true }).eq('org_id', org.id).is('deleted_at', null),
        supabase.from('questionnaires').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('org_invites').select('*').eq('org_id', org.id).eq('accepted', false),
        supabase.from('org_invites').select('email, user_id').eq('org_id', org.id).eq('accepted', true),
      ])
      // Enrich memberships with emails from accepted invites
      const enrichedMemberships = (org.org_memberships || []).map(m => ({
        ...m,
        email: acceptedInvites.data?.find(i => i.user_id === m.user_id)?.email || null,
      }))
      return { ...org, org_memberships: enrichedMemberships, asset_count: assetCount || 0, q_count: qCount || 0, pending_invites: invitesData.data || [] }
    }))
    setOrgs(enriched)
    setLoading(false)
  }

  const fetchMembers = async (orgId) => {
    if (members[orgId]) return // already loaded
    setLoadingMembers(prev => ({ ...prev, [orgId]: true }))
    const { data } = await supabase
      .from('org_memberships')
      .select('user_id, role, created_at')
      .eq('org_id', orgId)
    // Get emails from org_invites (accepted) as proxy since we can't query auth.users directly
    const { data: invites } = await supabase
      .from('org_invites')
      .select('email, token')
      .eq('org_id', orgId)
      .eq('accepted', true)
    const enriched = (data || []).map(m => ({
      ...m,
      email: invites?.find(i => i.token)?.email || m.user_id,
    }))
    setMembers(prev => ({ ...prev, [orgId]: enriched }))
    setLoadingMembers(prev => ({ ...prev, [orgId]: false }))
  }

  const deleteUser = async () => {
    if (!deleteUserConfirm) return
    try {
      // Remove from org memberships
      await supabase
        .from('org_memberships')
        .delete()
        .eq('user_id', deleteUserConfirm.userId)
        .eq('org_id', deleteUserConfirm.orgId)

      // Reset their onboarding context so they can re-onboard if re-invited
      await supabase
        .from('organisation_context')
        .delete()
        .eq('user_id', deleteUserConfirm.userId)

      setDeleteUserConfirm(null)
      await fetchOrgs()
      // Refresh members for this org
      setMembers(prev => {
        const updated = { ...prev }
        delete updated[deleteUserConfirm.orgId]
        return updated
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const updateRole = async (userId, orgId, newRole) => {
    await supabase
      .from('org_memberships')
      .update({ role: newRole })
      .eq('user_id', userId)
      .eq('org_id', orgId)
    // Refresh orgs
    await fetchOrgs()
    setMembers(prev => {
      const updated = { ...prev }
      delete updated[orgId]
      return updated
    })
  }

  const createOrg = async () => {
    if (!newOrgName.trim()) return
    setCreating(true)
    setError('')
    try {
      const slug = newOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      const { data, error } = await supabase
        .from('organisations')
        .insert([{ name: newOrgName.trim(), slug, created_by: 'dylanbrinkza@gmail.com' }])
        .select()
        .single()
      if (error) throw error
      setNewOrgName('')
      setShowCreateOrg(false)
      await fetchOrgs()
    } catch (err) {
      setError(err.message)
    }
    setCreating(false)
  }

  const createInvite = async () => {
    if (!inviteEmail.trim() || !showInvite) return
    setInviting(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('org_invites')
        .insert([{ org_id: showInvite.id, email: inviteEmail.trim(), role: inviteRole }])
        .select()
        .single()
      if (error) throw error
      const link = `${window.location.origin}/invite/${data.token}`
      setInviteLink(link)
      setInviteEmail('')
    } catch (err) {
      setError(err.message)
    }
    setInviting(false)
  }

  const deleteOrg = async (orgId) => {
    try {
      await supabase.from('organisations').delete().eq('id', orgId)
      setDeleteConfirm(null)
      await fetchOrgs()
    } catch (err) {
      setError(err.message)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F0A05', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5F0E8', fontSize: 13 }}>Loading...</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0F0A05', color: '#F5F0E8', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '0.5px solid rgba(245,240,232,0.1)', padding: '0 2rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Cly<em style={{ fontStyle: 'italic', color: '#D4A97A' }}>ra</em></div>
          <div style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(181,73,10,0.3)', color: '#D4A97A', borderRadius: 4, fontWeight: 500, letterSpacing: '0.06em' }}>SUPER ADMIN</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)' }}>dylanbrinkza@gmail.com</span>
          <button onClick={signOut} style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)', background: 'none', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '2rem' }}>
          {[
            ['Total organisations', orgs.filter(o => o.id !== '00000000-0000-0000-0000-000000000001').length],
            ['Total users', orgs.reduce((acc, o) => acc + (o.org_memberships?.length || 0), 0)],
            ['Total assets', orgs.reduce((acc, o) => acc + (o.asset_count || 0), 0)],
          ].map(([label, val]) => (
            <div key={label} style={{ background: 'rgba(245,240,232,0.05)', border: '0.5px solid rgba(245,240,232,0.1)', borderRadius: 10, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>{val}</div>
              <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Organisations</div>
          <button onClick={() => setShowCreateOrg(true)} style={{ fontSize: 13, padding: '7px 16px', background: '#B5490A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New organisation
          </button>
        </div>

        {error && <div style={{ fontSize: 12, color: '#ff6b6b', padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        {/* Orgs list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orgs.map(org => {
            const isAdmin = org.id === '00000000-0000-0000-0000-000000000001'
            return (
              <div key={org.id} style={{ background: 'rgba(245,240,232,0.04)', border: `0.5px solid ${isAdmin ? 'rgba(212,169,122,0.3)' : 'rgba(245,240,232,0.1)'}`, borderRadius: 10, padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{org.name}</div>
                      {isAdmin && <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(212,169,122,0.2)', color: '#D4A97A', borderRadius: 3, fontWeight: 500 }}>ADMIN TENANT</span>}
                      <span style={{ fontSize: 11, color: 'rgba(245,240,232,0.35)' }}>/{org.slug}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'rgba(245,240,232,0.5)' }}>
                      <span>{org.org_memberships?.length || 0} member{org.org_memberships?.length !== 1 ? 's' : ''}</span>
                      <span>{org.asset_count} asset{org.asset_count !== 1 ? 's' : ''}</span>
                      <span>{org.q_count} questionnaire{org.q_count !== 1 ? 's' : ''}</span>
                      <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                      {org.pending_invites?.length > 0 && <span style={{ color: '#D4A97A' }}>{org.pending_invites.length} pending invite{org.pending_invites.length !== 1 ? 's' : ''}</span>}
                    </div>

                    {/* Members with delete */}
                    {org.org_memberships?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {org.org_memberships.length} member{org.org_memberships.length !== 1 ? 's' : ''}
                        </div>
                        {org.org_memberships.map((m, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(245,240,232,0.06)', borderRadius: 6, marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,240,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#F5F0E8' }}>
                                {(m.email || m.user_id || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 12, color: '#F5F0E8' }}>{m.email || m.user_id}</div>
                                <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>{m.role === 'admin' ? 'Org admin' : 'Member'} · joined {new Date(m.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                            {/* Show controls for all members except the super admin */}
                            {m.user_id !== 'de9ef1de-9441-4ea2-b5ef-a32ad0a5c04a' && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select
                                  value={m.role || 'member'}
                                  onChange={e => updateRole(m.user_id, org.id, e.target.value)}
                                  style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(245,240,232,0.08)', border: '0.5px solid rgba(245,240,232,0.2)', borderRadius: 4, color: '#F5F0E8', fontFamily: 'inherit', cursor: 'pointer' }}>
                                  <option value="admin">Org admin</option>
                                  <option value="member">Member</option>
                                </select>
                                <button
                                  onClick={() => setDeleteUserConfirm({ userId: m.user_id, orgId: org.id, orgName: org.name })}
                                  style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(192,57,43,0.15)', color: '#ff6b6b', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pending invites */}
                    {org.pending_invites?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {org.pending_invites.map(inv => (
                          <div key={inv.id} style={{ fontSize: 11, color: '#D4A97A', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span>⏳ Invite pending: {inv.email}</span>
                            <span style={{ color: 'rgba(245,240,232,0.3)' }}>expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => { setShowInvite(org); setInviteLink(''); setInviteEmail('') }}
                      style={{ fontSize: 12, padding: '6px 14px', background: 'rgba(245,240,232,0.08)', color: '#F5F0E8', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Invite user
                    </button>
                    {!isAdmin && (
                      <button onClick={() => setDeleteConfirm(org)}
                        style={{ fontSize: 12, padding: '6px 14px', background: 'rgba(192,57,43,0.15)', color: '#ff6b6b', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Org Modal */}
      {showCreateOrg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowCreateOrg(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'relative', background: '#1A1208', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 12, padding: '1.5rem', width: 420, zIndex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Create organisation</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)', display: 'block', marginBottom: 6 }}>Organisation name</label>
              <input value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                placeholder="Acme Corp" onKeyDown={e => e.key === 'Enter' && createOrg()}
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(245,240,232,0.08)', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 8, fontSize: 13, color: '#F5F0E8', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            {error && <div style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCreateOrg(false)} style={{ flex: 1, padding: '8px', background: 'none', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 8, color: 'rgba(245,240,232,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
              <button onClick={createOrg} disabled={creating || !newOrgName.trim()} style={{ flex: 2, padding: '8px', background: '#B5490A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {creating ? 'Creating...' : 'Create organisation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowInvite(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'relative', background: '#1A1208', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 12, padding: '1.5rem', width: 460, zIndex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Invite user to {showInvite.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', marginBottom: 16 }}>They will receive a link to set up their account and complete onboarding.</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@company.com" type="email"
                style={{ flex: 1, padding: '9px 12px', background: 'rgba(245,240,232,0.08)', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 8, fontSize: 13, color: '#F5F0E8', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                style={{ flex: 1, padding: '9px 12px', background: 'rgba(245,240,232,0.08)', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 8, fontSize: 13, color: '#F5F0E8', fontFamily: 'inherit' }}>
                <option value="member">Member — view only</option>
                <option value="admin">Org admin — full access</option>
              </select>
              <button onClick={createInvite} disabled={inviting || !inviteEmail.trim()} style={{ padding: '9px 18px', background: '#B5490A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {inviting ? '...' : 'Generate link'}
              </button>
            </div>
            {inviteLink && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.5)', marginBottom: 6 }}>Invite link — share this with the user:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 11, padding: '8px 10px', background: 'rgba(245,240,232,0.06)', borderRadius: 6, color: 'rgba(245,240,232,0.6)', wordBreak: 'break-all', lineHeight: 1.5 }}>{inviteLink}</div>
                  <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ padding: '8px 14px', background: 'rgba(245,240,232,0.08)', color: '#F5F0E8', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Copy</button>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)', marginTop: 6 }}>Expires in 7 days · Single use</div>
              </div>
            )}
            {error && <div style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 12 }}>{error}</div>}
            <button onClick={() => { setShowInvite(null); setInviteLink(''); setInviteEmail(''); setInviteRole('member') }} style={{ width: '100%', padding: '8px', background: 'none', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 8, color: 'rgba(245,240,232,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Close</button>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUserConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteUserConfirm(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'relative', background: '#1A1208', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 12, padding: '1.5rem', width: 420, zIndex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Remove user from {deleteUserConfirm.orgName}?</div>
            <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', marginBottom: 8, lineHeight: 1.5 }}>
              This will remove the user from the organisation and delete their onboarding context. They will need to be re-invited to regain access.
            </div>
            <div style={{ fontSize: 12, padding: '8px 10px', background: 'rgba(245,240,232,0.06)', borderRadius: 6, marginBottom: 20, color: 'rgba(245,240,232,0.5)', wordBreak: 'break-all' }}>
              User ID: {deleteUserConfirm.userId}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteUserConfirm(null)} style={{ flex: 1, padding: '8px', background: 'none', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 8, color: 'rgba(245,240,232,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
              <button onClick={deleteUser} style={{ flex: 2, padding: '8px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Remove user</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirm(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'relative', background: '#1A1208', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 12, padding: '1.5rem', width: 400, zIndex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Delete {deleteConfirm.name}?</div>
            <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
              This will permanently delete the organisation and all its data including assets, questionnaires, and users. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '8px', background: 'none', border: '0.5px solid rgba(245,240,232,0.15)', borderRadius: 8, color: 'rgba(245,240,232,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
              <button onClick={() => deleteOrg(deleteConfirm.id)} style={{ flex: 2, padding: '8px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Delete permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
