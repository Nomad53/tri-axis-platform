export function normalizeCompanyName(name = '') {
  return name.toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|company|co|pakistan)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function dedupeProspects(rows = []) {
  const seen = new Map()
  for (const row of rows) {
    const domain = (row.website || '').replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0]
    const key = domain || normalizeCompanyName(row.name)
    if (key && !seen.has(key)) seen.set(key, row)
  }
  return [...seen.values()]
}

function mapCompany(row) {
  return {
    id: row.id,
    name: row.company_name || 'Unnamed company',
    industry: row.industry || 'Unknown',
    businessType: row.business_type || 'Unknown',
    city: row.city || 'Unknown',
    province: row.province || 'Unknown',
    website: row.website || '',
    summary: row.description || 'No company description available yet.',
    evidence: row.factory_evidence || 'Industrial evidence not recorded yet.',
    relevance: row.industrial_relevance || 'Unknown',
    status: row.status || 'Discovered',
    sourceUrl: row.source_url || '',
    sourceType: row.source_type || '',
    lastChecked: row.last_checked ? new Date(row.last_checked).toISOString().slice(0, 10) : 'Unknown'
  }
}

export async function getProspects() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!baseUrl || !apiKey) {
    console.error('Supabase environment variables are missing.')
    return []
  }

  const url = `${baseUrl.replace(/\/$/, '')}/rest/v1/companies?select=*&order=created_at.desc`

  try {
    const response = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      console.error('Supabase read failed:', response.status, await response.text())
      return []
    }

    const rows = await response.json()
    return dedupeProspects(rows.map(mapCompany))
  } catch (error) {
    console.error('Supabase connection failed:', error)
    return []
  }
}
