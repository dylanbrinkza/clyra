import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchInvite() {
      const { data, error } = await supabase
        .from('org_invites')
        .select('*, organisations(name)')
        .eq('token', token)
        .single()

      if (error || !data) { setError('This invite link is invalid or has expired.'); setLoading(false); return }
      if (data.accepted) { setError('This invite has already been used.'); setLoading(false); return }
      if (new Date(data.expires_at) < new Date()) { setError('This invite link has expired. Please request a new one.'); setLoading(false); return }

      setInvite(data)
      setLoading(false)
    }
    fetchInvite()
  }, [token])

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSubmitting(true)
    setError('')

    try {
      // Sign up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
      })
      if (signUpError) throw signUpError

      const userId = authData.user?.id
      if (!userId) throw new Error('Sign up failed — please try again.')

      // Add to org
      await supabase.from('org_memberships').insert([{
        org_id: invite.org_id,
        user_id: userId,
        role: invite.role || 'admin',
      }])

      // Mark invite accepted and store user_id for admin panel
      await supabase.from('org_invites').update({ accepted: true, user_id: userId }).eq('token', token)

      // Sign in
      await supabase.auth.signInWithPassword({ email: invite.email, password })

      // Check if the org has already completed onboarding
      // If so, skip wizard and go straight to dashboard
      const { data: orgCtx } = await supabase
        .from('organisation_context')
        .select('onboarding_complete')
        .eq('org_id', invite.org_id)
        .single()

      if (orgCtx?.onboarding_complete === true) {
        navigate('/dashboard')
      } else {
        navigate('/welcome')
      }
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading...</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.3px', marginBottom: 6 }}>
          Cly<em style={{ fontStyle: 'italic', color: '#D4A97A' }}>ra</em>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Security, Risk & Compliance</div>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 400 }}>
        {error && !invite ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Invalid invite</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{error}</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>You've been invited to</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{invite?.organisations?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Set a password to create your account for <strong>{invite?.email}</strong></div>
            </div>

            <form onSubmit={handleSignUp}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Confirm password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password" required style={inputStyle} />
              </div>

              {error && <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 16 }}>{error}</div>}

              <button type="submit" disabled={submitting} style={{ width: '100%', padding: '10px', background: 'var(--brown)', color: '#F5F0E8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit' }}>
                {submitting ? 'Creating account...' : 'Create account & get started'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid rgba(44,31,14,0.25)', borderRadius: 8, fontSize: 13, background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }
