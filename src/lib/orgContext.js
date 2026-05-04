import { supabase } from './supabase'

let cached = null

export async function getOrgContext() {
  if (cached) return cached
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('organisation_context')
      .select('*')
      .eq('user_id', user.id)
      .single()
    cached = data || null
    return cached
  } catch {
    return null
  }
}

export function clearOrgContextCache() {
  cached = null
}

export function buildOrgContextString(ctx) {
  if (!ctx) return 'No organisation context provided — assess using general best practice standards.'
  return `ORGANISATION CONTEXT — all assessments must be framed against this:
- Company: ${ctx.company_name || 'Not specified'}
- Industry: ${ctx.industry || 'Not specified'}
- Size: ${ctx.employee_count || 'Not specified'} employees
- Countries of operation: ${ctx.countries?.join(', ') || 'Not specified'}
- Regulatory frameworks: ${ctx.regulatory_frameworks?.join(', ') || 'Not specified'}
- Data held: ${ctx.data_types?.join(', ') || 'Not specified'}
- Data subjects: ${ctx.data_subject_count || 'Not specified'}
- Special category data: ${ctx.special_category_data ? 'YES — elevated obligations apply' : 'No'}
- Technical environment: ${ctx.tech_environment || 'Not specified'}
- Own certifications held: ${ctx.existing_certifications?.join(', ') || 'None'}
- Risk appetite: ${ctx.risk_appetite || 'Not specified'}
- Additional compliance context: ${ctx.compliance_notes || 'None'}`
}
