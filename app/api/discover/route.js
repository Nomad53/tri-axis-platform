// TRI AXIS v0.1.4
// FILE DESTINATION: app/api/discover/route.js
//
// PURPOSE
// This route does NOT assume that a web-search result is already a company.
// It deliberately performs several steps:
//
// 1. Build several targeted search queries from the user's industry + city.
// 2. Ask Tavily for raw web-search results.
// 3. Reject obvious non-company pages such as jobs, news, "top companies" lists,
//    directories, market reports, PDFs, social profiles, and generic articles.
// 4. Normalize each remaining result into a possible company entity.
// 5. Fetch the page itself where possible.
// 6. Look for evidence that the entity is actually an industrial business.
// 7. Determine a business type from explicit text.
// 8. Assign High / Medium / Low relevance only AFTER the company check.
// 9. Deduplicate by domain and normalized company name.
// 10. Return a short list of actual company candidates for human review.
//
// IMPORTANT
// "Unknown" is valid. The code never invents missing data.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAVILY_URL = 'https://api.tavily.com/search'

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
  'researchgate.net'
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

const COMPANY_WORDS = [
  'company',
  'private limited',
  'pvt ltd',
  'pvt. ltd',
  'limited',
  'ltd',
  'industries',
  'industry',
  'engineering',
  'works',
  'manufacturing',
  'manufacturer',
  'fabrication',
  'fabricators',
  'steel',
  'textile',
  'pharma',
  'pharmaceutical',
  'foods',
  'cement',
  'chemicals',
  'packaging',
  'motors',
  'cables',
  'power',
  'energy'
]

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

const GENERIC_WORDS = new Set([
  'home',
  'about',
  'contact',
  'official',
  'website',
  'pakistan',
  'karachi',
  'lahore',
  'islamabad',
  'faisalabad',
  'company',
  'companies',
  'manufacturer',
  'manufacturing',
  'engineering'
])

function safeLower(value) {
  return String(value || '').toLowerCase()
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function isBlockedDomain(url) {
  const hostname = getHostname(url)
  return BLOCKED_DOMAINS.some(
    domain => hostname === domain || hostname.endsWith(`.${domain}`)
  )
}

function isBlockedPath(url) {
  const lower = safeLower(url)
  return BLOCKED_PATH_WORDS.some(word => lower.includes(word))
}

function hasBlockedTitle(title) {
  const lower = safeLower(title)
  return BLOCKED_TITLE_WORDS.some(word => lower.includes(word))
}

function looksLikeGenericArticle(title, content) {
  const combined = `${safeLower(title)} ${safeLower(content)}`
  const articleSignals = [
    'top companies',
    'list of companies',
    'market report',
    'market trends',
    'job openings',
    'apply now',
    'career opportunities',
    'competitors',
    'directory of',
    'companies based in'
  ]
  return articleSignals.some(signal => combined.includes(signal))
}

function stripHtml(html) {
  return cleanText(
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

function extractHtmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? cleanText(stripHtml(match[1])) : ''
}

function extractMetaDescription(html) {
  const text = String(html || '')
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return cleanText(match[1])
  }
  return ''
}

function removeTitleSuffixes(title) {
  let value = cleanText(title)

  // Many official sites use formats like:
  // "ABC Engineering | Home"
  // "ABC Engineering - Pakistan"
  // "ABC Engineering – Official Website"
  // We keep the first meaningful segment.
  const parts = value
    .split(/\s+[|–—-]\s+/)
    .map(x => cleanText(x))
    .filter(Boolean)

  if (parts.length > 1) {
    const first = parts[0]
    if (first.length >= 3 && first.length <= 90) value = first
  }

  value = value
    .replace(/\b(home|official website|welcome)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return value
}

function companyNameFromTitleOrDomain(title, url) {
  const titleName = removeTitleSuffixes(title)

  if (
    titleName &&
    titleName.length >= 3 &&
    titleName.length <= 90 &&
    !hasBlockedTitle(titleName)
  ) {
    return titleName
  }

  const hostname = getHostname(url)
  if (!hostname) return ''

  const base = hostname.split('.')[0] || ''
  const words = base
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))

  return cleanText(words.join(' '))
}

function normalizedCompanyKey(name) {
  return safeLower(name)
    .replace(/\b(private|pvt|limited|ltd|company|co|pakistan)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function containsCompanySignal(text) {
  const lower = safeLower(text)
  return COMPANY_WORDS.some(word => lower.includes(word))
}

function countIndustrialSignals(text) {
  const lower = safeLower(text)
  let count = 0
  for (const word of INDUSTRIAL_WORDS) {
    if (lower.includes(word)) count += 1
  }
  return count
}

function detectBusinessType(text, industry) {
  const lower = safeLower(text)

  const rules = [
    ['Engineering & Fabrication', ['fabrication', 'fabricator', 'metal fabrication', 'structural steel']],
    ['Manufacturer', ['manufacturing', 'manufacturer', 'factory', 'production facility', 'plant']],
    ['Machine Shop', ['machining', 'cnc', 'machine shop']],
    ['Steel / Metal Processor', ['steel', 'metalworking', 'foundry', 'forging', 'casting']],
    ['Textile Manufacturer', ['textile', 'spinning', 'weaving', 'garments factory']],
    ['Food Processor', ['food processing', 'food manufacturer', 'beverage plant']],
    ['Pharmaceutical Manufacturer', ['pharmaceutical manufacturing', 'pharma manufacturing']],
    ['Industrial Contractor', ['industrial contractor', 'engineering contractor', 'epc contractor']]
  ]

  for (const [label, words] of rules) {
    if (words.some(word => lower.includes(word))) return label
  }

  if (industry && industry !== 'All Industries') return industry
  return 'Unknown'
}

function splitSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+/)
    .map(x => cleanText(x))
    .filter(x => x.length >= 35 && x.length <= 420)
}

function buildEvidence(text) {
  const sentences = splitSentences(text)
  const matches = []

  for (const sentence of sentences) {
    const lower = safeLower(sentence)
    if (INDUSTRIAL_WORDS.some(word => lower.includes(word))) {
      matches.push(sentence)
    }
    if (matches.length >= 2) break
  }

  return cleanText(matches.join(' '))
}

function officialSiteConfidence(url, title, pageText) {
  const hostname = getHostname(url)
  if (!hostname) return 0

  let score = 0

  if (!isBlockedDomain(url) && !isBlockedPath(url)) score += 1
  if (title && !hasBlockedTitle(title)) score += 1
  if (containsCompanySignal(`${title} ${pageText.slice(0, 4000)}`)) score += 1
  if (countIndustrialSignals(pageText.slice(0, 12000)) >= 2) score += 1

  return score
}

function relevanceFromEvidence(pageText, searchSnippet, officialConfidence) {
  const combined = `${pageText} ${searchSnippet}`
  const industrialCount = countIndustrialSignals(combined)

  if (officialConfidence >= 3 && industrialCount >= 3) return 'High'
  if (officialConfidence >= 2 && industrialCount >= 2) return 'Medium'
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

async function fetchWebsite(url) {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TriAxisProspectResearch/0.1.4; +https://tri-axis-platform.vercel.app)'
        },
        cache: 'no-store'
      },
      7000
    )

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return null

    const html = await response.text()

    return {
      finalUrl: response.url || url,
      title: extractHtmlTitle(html),
      metaDescription: extractMetaDescription(html),
      text: stripHtml(html).slice(0, 30000)
    }
  } catch {
    return null
  }
}

function buildSearchQueries(industry, city, userQuery) {
  const cleanIndustry =
    industry && industry !== 'All Industries'
      ? industry
      : 'industrial manufacturing'

  const cleanCity = cleanText(city) || 'Pakistan'
  const extra = cleanText(userQuery)

  const queries = [
    `${cleanIndustry} company ${cleanCity} Pakistan official website`,
    `${cleanIndustry} manufacturer ${cleanCity} Pakistan`,
    `${cleanIndustry} factory ${cleanCity} Pakistan`,
    `${cleanIndustry} industrial company ${cleanCity} Pakistan`
  ]

  if (extra) {
    queries.unshift(`${extra} ${cleanIndustry} ${cleanCity} Pakistan company`)
  }

  return [...new Set(queries)]
}

async function tavilySearch(apiKey, query) {
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
        max_results: 10,
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
    throw new Error(`Tavily search failed (${response.status}): ${text.slice(0, 300)}`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Tavily returned a non-JSON response.')
  }

  return Array.isArray(data.results) ? data.results : []
}

function rejectRawSearchResult(result) {
  const title = cleanText(result?.title)
  const url = cleanText(result?.url)
  const content = cleanText(result?.content)

  if (!url || !title) return true
  if (!/^https?:\/\//i.test(url)) return true
  if (isBlockedDomain(url)) return true
  if (isBlockedPath(url)) return true
  if (hasBlockedTitle(title)) return true
  if (looksLikeGenericArticle(title, content)) return true

  return false
}

async function turnSearchResultIntoCandidate(result, industry, city) {
  const searchTitle = cleanText(result.title)
  const searchSnippet = cleanText(result.content)
  const searchUrl = cleanText(result.url)

  const page = await fetchWebsite(searchUrl)

  const actualUrl = page?.finalUrl || searchUrl
  const actualTitle = page?.title || searchTitle
  const pageDescription = page?.metaDescription || ''
  const pageText = page?.text || ''

  // Re-check after redirects. A search result can redirect into a job board,
  // directory, PDF, or generic article.
  if (isBlockedDomain(actualUrl)) return null
  if (isBlockedPath(actualUrl)) return null
  if (hasBlockedTitle(actualTitle)) return null
  if (looksLikeGenericArticle(actualTitle, `${pageDescription} ${searchSnippet}`)) {
    return null
  }

  const companyName = companyNameFromTitleOrDomain(actualTitle, actualUrl)
  if (!companyName || companyName.length < 3) return null

  // Reject names that are effectively generic search-page labels.
  const nameWords = safeLower(companyName)
    .split(/\s+/)
    .filter(word => word && !GENERIC_WORDS.has(word))

  if (nameWords.length === 0) return null

  const combinedText = cleanText(
    `${actualTitle}. ${pageDescription}. ${pageText}. ${searchSnippet}`
  )

  const industrialSignals = countIndustrialSignals(combinedText)
  const companySignal = containsCompanySignal(combinedText)
  const siteConfidence = officialSiteConfidence(actualUrl, actualTitle, combinedText)

  // Hard gate:
  // We do not return a candidate merely because the search engine found a page.
  // It needs both an identifiable company signal and industrial evidence.
  if (!companySignal) return null
  if (industrialSignals < 2) return null
  if (siteConfidence < 2) return null

  const evidence =
    buildEvidence(`${pageDescription}. ${pageText}`) ||
    buildEvidence(searchSnippet) ||
    'Industrial activity detected, but a concise evidence sentence could not be extracted automatically.'

  const description =
    pageDescription ||
    splitSentences(pageText).find(sentence => sentence.length <= 280) ||
    searchSnippet.slice(0, 280) ||
    'No concise company description was available.'

  return {
    company_name: companyName,
    website: actualUrl,
    industry:
      industry && industry !== 'All Industries'
        ? industry
        : 'Industrial',
    business_type: detectBusinessType(combinedText, industry),
    city: cleanText(city) || 'Unknown',
    province: null,
    country: 'Pakistan',
    description: cleanText(description).slice(0, 500),
    factory_evidence: cleanText(evidence).slice(0, 800),
    industrial_relevance: relevanceFromEvidence(
      pageText,
      searchSnippet,
      siteConfidence
    ),
    source_url: actualUrl,
    source_type:
      siteConfidence >= 3 ? 'Likely official company website' : 'Company web page',
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

    const industry = cleanText(body?.industry || '')
    const city = cleanText(body?.city || '')
    const userQuery = cleanText(body?.query || '')

    const queries = buildSearchQueries(industry, city, userQuery)

    // Search one query at a time so a single provider error is easier to identify.
    const rawResults = []

    for (const query of queries) {
      const results = await tavilySearch(apiKey, query)

      for (const result of results) {
        if (!rejectRawSearchResult(result)) {
          rawResults.push(result)
        }
      }
    }

    // First deduplication pass: URL/domain level.
    const uniqueRaw = []
    const seenUrls = new Set()

    for (const result of rawResults) {
      const hostname = getHostname(result.url)
      const key = hostname || safeLower(result.url)

      if (!key || seenUrls.has(key)) continue
      seenUrls.add(key)
      uniqueRaw.push(result)
    }

    // We intentionally inspect only a bounded number of pages.
    // This keeps the request fast and prevents uncontrolled external crawling.
    const inspected = uniqueRaw.slice(0, 18)

    const candidates = []

    for (const result of inspected) {
      const candidate = await turnSearchResultIntoCandidate(
        result,
        industry,
        city
      )

      if (candidate) candidates.push(candidate)

      // Human review is easier with a short list of strong candidates.
      if (candidates.length >= 10) break
    }

    // Second deduplication pass: company identity level.
    const finalCandidates = []
    const seenCompanyKeys = new Set()
    const seenDomains = new Set()

    for (const candidate of candidates) {
      const nameKey = normalizedCompanyKey(candidate.company_name)
      const domainKey = getHostname(candidate.website)

      if (nameKey && seenCompanyKeys.has(nameKey)) continue
      if (domainKey && seenDomains.has(domainKey)) continue

      if (nameKey) seenCompanyKeys.add(nameKey)
      if (domainKey) seenDomains.add(domainKey)

      finalCandidates.push(candidate)
    }

    return NextResponse.json({
      candidates: finalCandidates,
      meta: {
        version: '0.1.4',
        queries_used: queries,
        raw_results_after_basic_filter: uniqueRaw.length,
        pages_inspected: inspected.length,
        candidates_returned: finalCandidates.length
      }
    })
  } catch (error) {
    console.error('Tri Axis discovery error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown discovery error'
      },
      { status: 500 }
    )
  }
}
