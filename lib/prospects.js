import seed from '../data/prospects.json'

export function normalizeCompanyName(name = '') {
  return name.toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|company|co|pakistan)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function dedupeProspects(rows) {
  const seen = new Map()
  for (const row of rows) {
    const domain = (row.website || '').replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0]
    const key = domain || normalizeCompanyName(row.name)
    if (!seen.has(key)) seen.set(key, row)
  }
  return [...seen.values()]
}

export function getProspects() {
  return dedupeProspects(seed)
}
