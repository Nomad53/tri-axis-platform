// TRI AXIS v0.1.5
// FILE DESTINATION: app/api/discover/route.js
//
// GOAL:
// Return actual industrial company records, not generic web pages.
//
// THIS VERSION CHANGES THE SEARCH MODEL:
//
// 1. If City is blank, search across Pakistan using multiple industrial-city queries.
// 2. Search multiple query patterns, not one.
// 3. Pull a larger raw result pool.
// 4. Reject obvious junk pages before deeper inspection.
// 5. Prefer root/homepage URLs.
// 6. Derive company identity primarily from the domain/root site, not generic page titles.
// 7. Keep every returned record aligned to the Supabase companies table.
// 8. Return up to 30 company candidates per search batch.
// 9. Unknown values are allowed. Nothing is invented.
// 10. Search candidates are never saved automatically.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAVILY_URL = 'https://api.tavily.com/search'

const PAKISTAN_INDUSTRIAL_LOCATIONS = [
  'Karachi',
  'Lahore',
  'Faisalabad',
  'Gujranwala',
  'Sialkot',
  'Rawalpindi',
  'Islamabad',
  'Multan',
  'Hyderabad',
  'Hub',
  'Sheikhupura',
  'Kasur'
]

const BLOCKED_DOMAINS = [
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'indeed.com',
  'glassdoor.com',
  'rozee.pk',
  'mustakbil.com',
  'jobz.pk',
  'bayt.com',
  'wikipedia.org',
  'scribd.com',
  'slideshare.net',
  'researchgate.net',
  'lookup.pk',
  'businesslist.pk',
  'urdupoint.com',
  'dawn.com',
  'tribune.com.pk'
]

const BLOCKED_PATH_WORDS = [
  '/jobs',
  '/job/',
  '/careers',
  '/career/',
  '/news/',
  '/blog/',
  '/blogs/',
  '/article/',
  '/articles/',
  '/category/',
  '/tag/',
  '/wp-content/',
  '/directory/',
  '.pdf'
]

const BLOCKED_TITLE_WORDS = [
  'top companies',
  'top manufacturing',
  'top 10',
  'top 20',
  'top 25',
  'list of',
  'directory',
  'companies in pakistan',
  'companies in karachi',
  'jobs',
  'careers',
  'vacancy',
  'vacancies',
  'salary',
  'market trends',
  'competitors',
  'startup list',
  'startups',
  'database',
  'ranking',
  'best companies',
  'yellow pages'
]

const GENERIC_PAGE_TITLES = new Set([
  'home',
  'about',
  'about us',
  'contact',
  'contact us',
  'fabrication',
  'engineering',
  'manufacturing',
  'services',
  'products',
  'careers',
  'welcome'
])

const INDUSTRIAL_WORDS = [
  'manufacturing',
  'manufacturer',
  'factory',
  'plant',
  'production',
  'fabrication',
  'fabricator',
  'machining',
  'machine shop',
  'cnc',
  'workshop',
  'engineering',
  'industrial',
  'assembly',
  'processing',
  'mill',
  'foundry',
  'forging',
  'casting',
  'steel',
  'metalworking',
  'maintenance',
  'utilities',
  'production line',
  'production facility'
]

function lower(value) {
  return String(value || '').toLowerCase()
}

function clean(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function rootUrl(url) {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}/`
  } catch {
    return url
  }
}

function blockedDomain(url) {
  const hostname = hostnameOf(url)
  return BLOCKED_DOMAINS.some(
    domain => hostname === domain || hostname.endsWith(`.${domain}`)
  )
}

function blockedPath(url) {
  const value = lower(url)
  return BLOCKED_PATH_WORDS.some(word => value.includes(word))
}

function blockedTitle(title) {
  const value = lower(title)
  return BLOCKED_TITLE_WORDS.some(word => value.includes(word))
}

function stripHtml(html) {
  return clean(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  )
}

function htmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? clean(stripHtml(match[1])) : ''
}

function metaDescription(html) {
  const text = String(html || '')
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return clean(match[1])
  }

  return ''
}

function titleSegment(title) {
  const parts = clean(title)
    .split(/\s+[|–—-]\s+/)
    .map(clean)
    .filter(Boolean)

  for (const part of parts) {
    if (
      part.length >= 3 &&
      part.length <= 90 &&
      !GENERIC_PAGE_TITLES.has(lower(part)) &&
      !blockedTitle(part)
    ) {
      return part
    }
  }

  return ''
}

function nameFromDomain(url) {
  const hostname = hostnameOf(url)
  if (!hostname) return ''

  const first = hostname.split('.')[0] || ''

  return first
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim()
}

function deriveCompanyName(pageTitle, searchTitle, url) {
  const pageCandidate = titleSegment(pageTitle)
  const searchCandidate = titleSegment(searchTitle)

  if (pageCandidate) return pageCandidate
  if (searchCandidate) return searchCandidate

  return nameFromDomain(url)
}

function normalizedKey(name) {
  return lower(name)
    .replace(/\b(private|pvt|limited|ltd|company|co|pakistan)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function industrialSignalCount(text) {
  const value = lower(text)
  let count = 0

  for (const word of INDUSTRIAL_WORDS) {
    if (value.includes(word)) count += 1
  }

  return count
}

function detectBusinessType(text, industry) {
  const value = lower(text)

  const rules = [
    ['Engineering & Fabrication', ['fabrication', 'fabricator', 'structural steel', 'metal fabrication']],
    ['Machine Shop', ['machining', 'cnc', 'machine shop']],
    ['Steel / Metal Processor', ['foundry', 'forging', 'casting', 'metalworking', 'steel processing']],
    ['Textile Manufacturer', ['textile', 'spinning', 'weaving', 'garments factory']],
    ['Food Processor', ['food processing', 'food manufacturer', 'beverage plant']],
    ['Pharmaceutical Manufacturer', ['pharmaceutical manufacturing', 'pharma manufacturing']],
    ['Manufacturer', ['manufacturing', 'manufacturer', 'factory', 'production facility', 'production plant']],
    ['Industrial Contractor', ['industrial contractor', 'engineering contractor', 'epc contractor']]
  ]

  for (const [label, words] of rules) {
    if (words.some(word => value.includes(word))) return label
  }

  return industry || 'Unknown'
}

function detectProvince(city) {
  const value = lower(city)

  const map = {
    karachi: 'Sindh',
    hyderabad: 'Sindh',
    lahore: 'Punjab',
    faisalabad: 'Punjab',
    gujranwala: 'Punjab',
    sialkot: 'Punjab',
    rawalpindi: 'Punjab',
    multan: 'Punjab',
    sheikhupura: 'Punjab',
    kasur: 'Punjab',
    islamabad: 'Islamabad Capital Territory',
    hub: 'Balochistan'
  }

  return map[value] || null
}

function sentences(text) {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map(clean)
    .filter(sentence => sentence.length >= 35 && sentence.length <= 420)
}

function evidenceFrom(text) {
  const found = []

  for (const sentence of sentences(text)) {
    if (
      INDUSTRIAL_WORDS.some(word => lower(sentence).includes(word))
    ) {
      found.push(sentence)
    }

    if (found.length >= 2) break
  }

  return clean(found.join(' '))
}

function relevanceFor(text, officialSiteResolved) {
  const signals = industrialSignalCount(text)

  if (officialSiteResolved && signals >= 4) return 'High'
  if (signals >= 2) return 'Medium'
  return 'Low'
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow'
    })
  } finally {
    clearTimeout(timer)
  }
}

async function inspectWebsite(url) {
  // Inspect the root homepage first.
  const root = rootUrl(url)

  try {
    const response = await fetchWithTimeout(
      root,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TriAxisProspectResearch/0.1.5; +https://tri-axis-platform.vercel.app)'
        },
        cache: 'no-store'
      },
      7000
    )

    if (!response.ok) return null

    const type = response.headers.get('content-type') || ''
    if (!type.includes('text/html')) return null

    const html = await response.text()

    return {
      rootUrl: response.url || root,
      title: htmlTitle(html),
      description: metaDescription(html),
      text: stripHtml(html).slice(0, 30000)
    }
  } catch {
    return null
  }
}

function searchQueries(industry, city, userQuery) {
  const selectedIndustry =
    clean(industry) || 'industrial manufacturing'

  const locations = clean(city)
    ? [clean(city)]
    : PAKISTAN_INDUSTRIAL_LOCATIONS

  const queryDetail = clean(userQuery)

  const queries = []

  for (const location of locations) {
    queries.push(
      `${selectedIndustry} manufacturer ${location} Pakistan official website`
    )
    queries.push(
      `${selectedIndustry} company ${location} Pakistan factory`
    )

    if (queryDetail) {
      queries.push(
        `${queryDetail} ${selectedIndustry} ${location} Pakistan company`
      )
    }
  }

  return [...new Set(queries)]
}

async function tavily(apiKey, query) {
  const response = await fetchWithTimeout(
    TAVILY_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: 20,
        include_answer: false,
        include_raw_content: false,
        include_images: false
      }),
      cache: 'no-store'
    },
    15000
  )

  const text = await response.text()

  if (!response.ok) {
    throw new Error(
      `Tavily search failed (${response.status}): ${text.slice(0, 300)}`
    )
  }

  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed.results) ? parsed.results : []
  } catch {
    throw new Error('Tavily returned a non-JSON response.')
  }
}

function rawResultAllowed(result) {
  const title = clean(result?.title)
  const url = clean(result?.url)

  if (!title || !url) return false
  if (!/^https?:\/\//i.test(url)) return false
  if (blockedDomain(url)) return false
  if (blockedPath(url)) return false
  if (blockedTitle(title)) return false

  return true
}

async function resultToCompany(result, industry, fallbackCity) {
  const inspected = await inspectWebsite(result.url)

  const website = inspected?.rootUrl || rootUrl(result.url)
  const pageTitle = inspected?.title || ''
  const searchTitle = clean(result.title)
  const searchSnippet = clean(result.content)
  const pageText = inspected?.text || ''
  const pageDescription = inspected?.description || ''

  const combined = clean(
    `${pageTitle}. ${pageDescription}. ${pageText}. ${searchSnippet}`
  )

  const companyName = deriveCompanyName(
    pageTitle,
    searchTitle,
    website
  )

  if (!companyName) return null

  // Reject generic page names even after inspection.
  if (GENERIC_PAGE_TITLES.has(lower(companyName))) return null
  if (blockedTitle(companyName)) return null

  const signalCount = industrialSignalCount(combined)

  // A candidate must have multiple explicit industrial signals.
  if (signalCount < 2) return null

  const evidence =
    evidenceFrom(`${pageDescription}. ${pageText}`) ||
    evidenceFrom(searchSnippet)

  if (!evidence) return null

  const description =
    pageDescription ||
    sentences(pageText).find(sentence => sentence.length <= 320) ||
    searchSnippet.slice(0, 320) ||
    'Unknown'

  const city = clean(fallbackCity) || 'Unknown'

  return {
    company_name: companyName,
    website: website || null,
    industry: industry || 'Industrial',
    business_type: detectBusinessType(combined, industry),
    city,
    province: city === 'Unknown' ? null : detectProvince(city),
    country: 'Pakistan',
    description: clean(description).slice(0, 500),
    factory_evidence: clean(evidence).slice(0, 900),
    industrial_relevance: relevanceFor(combined, Boolean(inspected)),
    source_url: clean(result.url) || website || null,
    source_type: inspected
      ? 'Official/primary website candidate'
      : 'Web search result',
    status: 'Discovered',
    last_checked: new Date().toISOString()
  }
}

export async function POST(request) {
  try {
    const apiKey = process.env.TAVILY_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'TAVILY_API_KEY is missing in Vercel environment variables.'
        },
        { status: 500 }
      )
    }

    const body = await request.json()

    const industry = clean(body?.industry || '')
    const city = clean(body?.city || '')
    const userQuery = clean(body?.query || '')

    const queries = searchQueries(industry, city, userQuery)

    const rawResults = []

    // Keep a practical request cap for serverless execution.
    // Pakistan-wide search uses the first 12 generated query patterns in a batch.
    const queryBatch = queries.slice(0, 12)

    for (const query of queryBatch) {
      const results = await tavily(apiKey, query)

      for (const result of results) {
        if (rawResultAllowed(result)) {
          rawResults.push({
            ...result,
            searched_location:
              city ||
              inferLocationFromQuery(query) ||
              'Unknown'
          })
        }
      }
    }

    // Domain-level dedupe before expensive page inspection.
    const uniqueByDomain = []
    const seenDomains = new Set()

    for (const result of rawResults) {
      const host = hostnameOf(result.url)

      if (!host || seenDomains.has(host)) continue

      seenDomains.add(host)
      uniqueByDomain.push(result)
    }

    const candidates = []

    // Inspect more pages than the old version.
    // Still bounded so Vercel is not asked to crawl the entire web in one request.
    for (const result of uniqueByDomain.slice(0, 45)) {
      const company = await resultToCompany(
        result,
        industry,
        result.searched_location
      )

      if (company) candidates.push(company)

      if (candidates.length >= 30) break
    }

    // Company-level dedupe after identity extraction.
    const final = []
    const names = new Set()
    const domains = new Set()

    for (const company of candidates) {
      const nameKey = normalizedKey(company.company_name)
      const domainKey = hostnameOf(company.website)

      if (nameKey && names.has(nameKey)) continue
      if (domainKey && domains.has(domainKey)) continue

      if (nameKey) names.add(nameKey)
      if (domainKey) domains.add(domainKey)

      final.push(company)
    }

    return NextResponse.json({
      candidates: final,
      meta: {
        version: '0.1.5',
        scope: city || 'Pakistan',
        query_count: queryBatch.length,
        filtered_raw_results: uniqueByDomain.length,
        pages_inspected: Math.min(uniqueByDomain.length, 45),
        candidates_returned: final.length
      }
    })
  } catch (error) {
    console.error('Tri Axis discovery error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown discovery error.'
      },
      { status: 500 }
    )
  }
}

function inferLocationFromQuery(query) {
  const value = lower(query)

  return (
    PAKISTAN_INDUSTRIAL_LOCATIONS.find(location =>
      value.includes(lower(location))
    ) || ''
  )
}
