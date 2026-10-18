import { NextResponse } from 'next/server'

const blockedDomains = [
  'facebook.com','instagram.com','linkedin.com','youtube.com','wikipedia.org',
  'yellowpages','lookup.pk','businesslist.pk','pakbiz.com','dnb.com'
]

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

function hostFromUrl(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function titleToCompany(title = '', host = '') {
  const cleaned = cleanText(title)
    .replace(/\s+[|–—-]\s+(Home|Official|Pakistan|Karachi|Lahore|About Us).*$/i, '')
    .replace(/\s+[|–—-]\s+.*$/i, '')
    .trim()
  if (cleaned && cleaned.length <= 90) return cleaned
  const root = host.split('.')[0] || 'Unknown Company'
  return root.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function scoreCandidate(content = '', title = '') {
  const text = `${title} ${content}`.toLowerCase()
  const strong = ['manufacturer','manufacturing','factory','plant','fabrication','production','industrial','machining','engineering works','workshop']
  const medium = ['engineering','steel','textile','pharma','cement','processing','automotive','power','maintenance']
  let score = 0
  strong.forEach(term => { if (text.includes(term)) score += 2 })
  medium.forEach(term => { if (text.includes(term)) score += 1 })
  if (score >= 5) return 'High'
  if (score >= 2) return 'Medium'
  return 'Low'
}

export async function POST(request) {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'Live discovery is not configured yet.',
      code: 'MISSING_TAVILY_KEY'
    }, { status: 503 })
  }

  let body = {}
  try { body = await request.json() } catch {}

  const industry = cleanText(body.industry || 'industrial manufacturing')
  const city = cleanText(body.city || 'Pakistan')
  const limit = Math.min(Math.max(Number(body.limit) || 10, 5), 15)
  const query = `${industry} manufacturers factories industrial companies ${city} Pakistan official company website`

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: limit,
        include_answer: false,
        include_raw_content: false,
        topic: 'general'
      }),
      cache: 'no-store'
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Tavily discovery failed:', response.status, detail)
      return NextResponse.json({ error: 'The live search provider could not complete this search.' }, { status: 502 })
    }

    const data = await response.json()
    const results = Array.isArray(data.results) ? data.results : []
    const seen = new Set()
    const candidates = []

    for (const result of results) {
      const sourceUrl = result.url || ''
      const host = hostFromUrl(sourceUrl)
      if (!host || blockedDomains.some(domain => host.includes(domain))) continue
      if (seen.has(host)) continue
      seen.add(host)

      const evidence = cleanText(result.content || '')
      const name = titleToCompany(result.title, host)
      candidates.push({
        id: host,
        company_name: name,
        website: sourceUrl,
        industry,
        business_type: 'Unknown',
        city: city === 'Pakistan' ? 'Unknown' : city,
        province: 'Unknown',
        description: evidence || 'Search result found, but no descriptive snippet was returned.',
        factory_evidence: evidence || 'Industrial evidence requires manual review.',
        industrial_relevance: scoreCandidate(evidence, result.title),
        source_url: sourceUrl,
        source_type: 'Web search',
        status: 'Candidate'
      })
    }

    return NextResponse.json({ query, candidates })
  } catch (error) {
    console.error('Live discovery error:', error)
    return NextResponse.json({ error: 'Live discovery failed unexpectedly.' }, { status: 500 })
  }
}

