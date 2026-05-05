import { supabase } from './supabase'

let cachedOrgId = null
let cachedRole = null

export async function isSuperAdmin(userId) {
  const { data } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function getOrgId() {
  if (cachedOrgId) return cachedOrgId
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('org_memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  cachedOrgId = data?.org_id || null
  return cachedOrgId
}

export async function getUserRole() {
  if (cachedRole) return cachedRole
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('user_id', user.id)
    .single()
  cachedRole = data?.role || 'member'
  return cachedRole
}

export function clearOrgIdCache() {
  cachedOrgId = null
  cachedRole = null
}
