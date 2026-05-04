import { supabase } from './supabase'

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function isSuperAdmin(userId) {
  const { data } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function getUserOrg(userId) {
  const { data } = await supabase
    .from('org_memberships')
    .select('org_id, role, organisations(id, name, slug)')
    .eq('user_id', userId)
    .single()
  return data || null
}

export async function getOrgId() {
  const user = await getCurrentUser()
  if (!user) return null
  const membership = await getUserOrg(user.id)
  return membership?.org_id || null
}
