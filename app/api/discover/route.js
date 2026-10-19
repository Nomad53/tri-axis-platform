// TRI AXIS v0.2.0
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/api/discover/route.js
//
// ============================================================
// DISCOVERY ENGINE v0.2.0
// ============================================================
//
// This file is deliberately explicit and defensive.
// It does NOT assume that a search result is a company.
// It does NOT assume that the search engine will return a clean list.
// It does NOT assign the searched city to a company unless location evidence exists.
// It does NOT treat directories, associations, government pages, news sites,
// marketplaces or job portals as prospects.
//
// The pipeline is:
//
//  1. Expand filters into an explicit industry/city query plan.
//  2. Search several query patterns with fair industry coverage.
//  3. Classify raw search results as:
//       - possible company page
//       - directory/list source
//       - association source
//       - government/source page
//       - marketplace
//       - media/news
//       - job/social/irrelevant
//  4. NEVER return a source page as a company.
//  5. Mine usable source pages for:
//       - external company websites
//       - internal company/member profile pages
//       - company names that can be resolved to official websites
//  6. Resolve every candidate to an official/root website when possible.
//  7. Validate company identity against the domain/title/body.
//  8. Validate Pakistan/location evidence.
//  9. Validate industrial/manufacturing evidence.
// 10. Classify industry and business type from the company's own site.
// 11. Build evidence text from explicit sentences found on the site.
// 12. Score relevance only AFTER validation.
// 13. Deduplicate by domain and normalized company identity.
// 14. Balance "All Industries" results so one sector does not consume the batch.
// 15. Return only records that map cleanly to the existing Supabase companies table.
//
// A directory can be useful as a SOURCE, but can never become a PROSPECT.
// Example: pakbusinessworld.com may be mined for company entities, but
// "Pak Business World" itself must never appear in the prospect table.
//
// No external npm dependencies are required.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENGINE_VERSION = '0.2.0'
const TAVILY_URL = 'https://api.tavily.com/search'

// Keep the function below a practical serverless execution window.
// If the time budget is reached, return the validated companies collected so far.
const EXECUTION_BUDGET_MS = 45000
const WEBSITE_FETCH_TIMEOUT_MS = 5500
const SEARCH_FETCH_TIMEOUT_MS = 14000
const OFFICIAL_LOOKUP_TIMEOUT_MS = 10000

// ------------------------------------------------------------
// 1. INDUSTRY MODEL
// ------------------------------------------------------------
// "All Industries" is expanded into real sectors.
// Search terms are used for discovery.
// Evidence terms are used to classify a company's actual website.

const INDUSTRY_DEFINITIONS = [
  {
    label: 'Engineering & Fabrication',
    searchTerms: ['engineering fabrication', 'industrial fabrication', 'metal fabrication'],
    evidenceTerms: ['fabrication', 'fabricator', 'structural steel', 'engineering works', 'welding', 'metal fabrication']
  },
  {
    label: 'Steel & Metals',
    searchTerms: ['steel manufacturer', 'metal manufacturer', 'steel processing'],
    evidenceTerms: ['steel', 'metal', 'rolling mill', 'foundry', 'forging', 'casting', 'metalworking']
  },
  {
    label: 'Textile',
    searchTerms: ['textile mill', 'textile manufacturer', 'spinning weaving'],
    evidenceTerms: ['textile', 'spinning', 'weaving', 'loom', 'dyeing', 'garment manufacturing']
  },
  {
    label: 'Food & Beverage',
    searchTerms: ['food manufacturer', 'food processing', 'beverage manufacturer'],
    evidenceTerms: ['food processing', 'food manufacturer', 'beverage', 'processing plant', 'production line']
  },
  {
    label: 'Pharmaceuticals',
    searchTerms: ['pharmaceutical manufacturer', 'pharma manufacturing', 'medicine factory'],
    evidenceTerms: ['pharmaceutical', 'pharma', 'medicine manufacturing', 'gmp', 'production facility']
  },
  {
    label: 'Chemicals',
    searchTerms: ['chemical manufacturer', 'industrial chemicals', 'chemical plant'],
    evidenceTerms: ['chemical', 'chemicals', 'chemical plant', 'resin', 'solvent', 'industrial chemicals']
  },
  {
    label: 'Cement',
    searchTerms: ['cement manufacturer', 'cement plant', 'cement factory'],
    evidenceTerms: ['cement', 'clinker', 'cement plant', 'cement mill', 'kiln']
  },
  {
    label: 'Automotive',
    searchTerms: ['automotive manufacturer', 'vehicle assembler', 'auto parts manufacturer'],
    evidenceTerms: ['automotive', 'automobile', 'vehicle assembly', 'auto parts', 'automotive parts']
  },
  {
    label: 'Packaging',
    searchTerms: ['packaging manufacturer', 'industrial packaging', 'packaging factory'],
    evidenceTerms: ['packaging', 'carton', 'corrugated', 'flexible packaging', 'packaging plant']
  },
  {
    label: 'Plastics',
    searchTerms: ['plastic manufacturer', 'plastic processing', 'injection molding'],
    evidenceTerms: ['plastic', 'plastics', 'injection molding', 'blow molding', 'polymer', 'plastic processing']
  },
  {
    label: 'Electrical & Cables',
    searchTerms: ['electrical manufacturer', 'cable manufacturer', 'switchgear manufacturer'],
    evidenceTerms: ['cable', 'cables', 'switchgear', 'electrical manufacturing', 'transformer', 'wire manufacturing']
  },
  {
    label: 'Power & Energy',
    searchTerms: ['power equipment manufacturer', 'energy engineering company', 'power plant services'],
    evidenceTerms: ['power plant', 'power generation', 'energy', 'generator', 'turbine', 'electrical power']
  },
  {
    label: 'HVAC',
    searchTerms: ['hvac manufacturer', 'hvac engineering', 'air conditioning manufacturer'],
    evidenceTerms: ['hvac', 'air conditioning', 'chiller', 'ventilation', 'ducting', 'cooling system']
  },
  {
    label: 'Oil & Gas',
    searchTerms: ['oil gas engineering', 'petroleum services company', 'oil gas equipment'],
    evidenceTerms: ['oil and gas', 'oil & gas', 'petroleum', 'refinery', 'pipeline', 'upstream', 'downstream']
  },
  {
    label: 'Fertilizer',
    searchTerms: ['fertilizer manufacturer', 'fertilizer plant', 'urea manufacturer'],
    evidenceTerms: ['fertilizer', 'urea', 'ammonia', 'fertilizer plant']
  },
  {
    label: 'Paper & Board',
    searchTerms: ['paper mill', 'paper manufacturer', 'paper board manufacturer'],
    evidenceTerms: ['paper mill', 'paper manufacturing', 'paperboard', 'board mill', 'corrugating medium']
  },
  {
    label: 'Glass & Ceramics',
    searchTerms: ['glass manufacturer', 'ceramic manufacturer', 'tiles manufacturer'],
    evidenceTerms: ['glass manufacturing', 'ceramic', 'tiles', 'kiln', 'float glass']
  },
  {
    label: 'Paints & Coatings',
    searchTerms: ['paint manufacturer', 'coatings manufacturer', 'industrial coatings'],
    evidenceTerms: ['paint manufacturing', 'coatings', 'industrial coatings', 'resin', 'paint plant']
  },
  {
    label: 'Machinery & Industrial Equipment',
    searchTerms: ['industrial machinery manufacturer', 'machine manufacturer', 'industrial equipment manufacturer'],
    evidenceTerms: ['machinery', 'industrial equipment', 'machine manufacturing', 'equipment manufacturing']
  },
  {
    label: 'Pumps, Valves & Flow Control',
    searchTerms: ['pump manufacturer', 'valve manufacturer', 'flow control manufacturer'],
    evidenceTerms: ['pump', 'pumps', 'valve', 'valves', 'flow control', 'actuator']
  },
  {
    label: 'Construction Materials',
    searchTerms: ['construction material manufacturer', 'building material manufacturer', 'precast manufacturer'],
    evidenceTerms: ['construction materials', 'precast', 'building materials', 'concrete products', 'blocks']
  },
  {
    label: 'Industrial Services',
    searchTerms: ['industrial maintenance company', 'industrial services company', 'plant maintenance contractor'],
    evidenceTerms: ['industrial services', 'plant maintenance', 'shutdown maintenance', 'industrial contractor', 'maintenance services']
  }
]

// ------------------------------------------------------------
// 2. PAKISTAN LOCATION MODEL
// ------------------------------------------------------------

const LOCATION_DEFINITIONS = [
  { city: 'Karachi', province: 'Sindh', aliases: ['karachi', 'korangi', 'landhi', 'site area', 'port qasim', 'bin qasim'] },
  { city: 'Hyderabad', province: 'Sindh', aliases: ['hyderabad', 'kotri'] },
  { city: 'Lahore', province: 'Punjab', aliases: ['lahore', 'sundar industrial estate', 'kot lakhpat', 'quaideazam industrial estate', 'quaid-e-azam industrial estate'] },
  { city: 'Faisalabad', province: 'Punjab', aliases: ['faisalabad', 'khurrianwala', 'm3 industrial city', 'allama iqbal industrial city'] },
  { city: 'Gujranwala', province: 'Punjab', aliases: ['gujranwala'] },
  { city: 'Sialkot', province: 'Punjab', aliases: ['sialkot'] },
  { city: 'Rawalpindi', province: 'Punjab', aliases: ['rawalpindi'] },
  { city: 'Multan', province: 'Punjab', aliases: ['multan'] },
  { city: 'Sheikhupura', province: 'Punjab', aliases: ['sheikhupura', 'sheikhupura road'] },
  { city: 'Kasur', province: 'Punjab', aliases: ['kasur'] },
  { city: 'Islamabad', province: 'Islamabad Capital Territory', aliases: ['islamabad'] },
  { city: 'Peshawar', province: 'Khyber Pakhtunkhwa', aliases: ['peshawar'] },
  { city: 'Nowshera', province: 'Khyber Pakhtunkhwa', aliases: ['nowshera'] },
  { city: 'Hattar', province: 'Khyber Pakhtunkhwa', aliases: ['hattar', 'hattar industrial estate'] },
  { city: 'Hub', province: 'Balochistan', aliases: ['hub', 'hub industrial', 'lasbela industrial estates'] },
  { city: 'Quetta', province: 'Balochistan', aliases: ['quetta'] }
]

const PROVINCE_LOCATIONS = {
  'All Pakistan': LOCATION_DEFINITIONS.map(item => item.city),
  Sindh: LOCATION_DEFINITIONS.filter(item => item.province === 'Sindh').map(item => item.city),
  Punjab: LOCATION_DEFINITIONS.filter(item => item.province === 'Punjab').map(item => item.city),
  'Khyber Pakhtunkhwa': LOCATION_DEFINITIONS.filter(item => item.province === 'Khyber Pakhtunkhwa').map(item => item.city),
  Balochistan: LOCATION_DEFINITIONS.filter(item => item.province === 'Balochistan').map(item => item.city),
  'Islamabad Capital Territory': ['Islamabad']
}

// ------------------------------------------------------------
// 3. FILTER TERM MODELS
// ------------------------------------------------------------

const BUSINESS_TYPE_TERMS = {
  'All Business Types': [],
  Manufacturer: ['manufacturer', 'manufacturing', 'factory', 'production'],
  Fabricator: ['fabricator', 'fabrication', 'welding'],
  Processor: ['processor', 'processing plant', 'processing'],
  'Factory / Plant': ['factory', 'plant', 'production facility'],
  'Machine Shop': ['machine shop', 'machining', 'cnc'],
  'Industrial Contractor': ['industrial contractor', 'plant contractor'],
  'EPC Contractor': ['epc contractor', 'engineering procurement construction'],
  'Industrial Services': ['industrial services', 'maintenance services']
}

const ACTIVITY_TERMS = {
  'All Activities': [],
  Manufacturing: ['manufacturer', 'manufacturing', 'factory', 'production'],
  Fabrication: ['fabrication', 'fabricator', 'structural steel', 'welding'],
  'Machining / CNC': ['machining', 'cnc', 'machine shop', 'tool room'],
  Processing: ['processing', 'processing plant', 'production line'],
  Assembly: ['assembly', 'assembly plant', 'assembly line'],
  'Plant Maintenance': ['plant maintenance', 'maintenance department', 'shutdown maintenance'],
  Utilities: ['utilities', 'boiler', 'compressor', 'utility plant'],
  'Workshop Operations': ['workshop', 'maintenance workshop', 'tool room']
}

const PRODUCT_FIT_TERMS = {
  'All Product Fits': [],
  'Cutting & Machining Tools': ['machining', 'cnc', 'metal cutting', 'tool room', 'lathe', 'milling'],
  'Power Tools': ['fabrication', 'workshop', 'maintenance', 'assembly'],
  'Hand Tools': ['maintenance', 'workshop', 'assembly', 'plant maintenance'],
  'Pneumatic Tools': ['pneumatic', 'air tools', 'assembly', 'automotive'],
  Abrasives: ['grinding', 'metal fabrication', 'steel', 'surface finishing'],
  'Valves & Pipe Tools': ['piping', 'valves', 'utilities', 'process plant', 'hvac', 'pipeline'],
  'General MRO': ['maintenance', 'mro', 'plant', 'workshop', 'utilities', 'shutdown']
}

// ------------------------------------------------------------
// 4. SITE CLASSIFICATION RULES
// ------------------------------------------------------------

// Domains that are not useful as prospect or source pages for this engine.
// Tavily is asked to exclude them up front to reduce noise and cost.
const HARD_EXCLUDE_DOMAINS = [
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
  'scribd.com',
  'slideshare.net',
  'researchgate.net',
  'zameen.com',
  'olx.com.pk',
  'dawn.com',
  'tribune.com.pk',
  'thenews.com.pk',
  'brecorder.com',
  'arabnews.com'
]

// Known domains that are useful as SOURCES but must NEVER be returned as prospects.
// These are not excluded from search because they can lead us to real companies.
const SOURCE_DOMAIN_OVERRIDES = {
  'pakbusinessworld.com': 'directory',
  'lookup.pk': 'directory',
  'businesslist.pk': 'directory',
  'pama.org.pk': 'association',
  'paapam.com': 'association',
  'fpcci.org.pk': 'association',
  'kcci.com.pk': 'association',
  'lcci.com.pk': 'association',
  'psx.com.pk': 'registry_source',
  'secp.gov.pk': 'government_source',
  'moip.gov.pk': 'government_source'
}

const DIRECTORY_SIGNALS = [
  'business directory',
  'company directory',
  'supplier directory',
  'manufacturers directory',
  'business listings',
  'company listings',
  'browse companies',
  'browse businesses',
  'find companies',
  'find businesses',
  'search companies',
  'search businesses',
  'add your business',
  'submit your business',
  'claim your business',
  'featured businesses',
  'business categories',
  'company profiles',
  'business profiles',
  'search by category',
  'search by city'
]

const ASSOCIATION_SIGNALS = [
  'association of',
  'federation of',
  'chamber of commerce',
  'member directory',
  'our members',
  'membership',
  'member companies',
  'member list'
]

const GOVERNMENT_SIGNALS = [
  'government of pakistan',
  'ministry of',
  'public sector',
  'government department',
  'official government'
]

const REGISTRY_SIGNALS = [
  'listed companies',
  'company profile',
  'issuer profile',
  'stock exchange',
  'securities and exchange commission'
]

const MARKETPLACE_SIGNALS = [
  'marketplace',
  'classifieds',
  'buy now',
  'sell now',
  'property for sale',
  'factories for sale',
  'add listing'
]

const MEDIA_SIGNALS = [
  'breaking news',
  'latest news',
  'newsroom',
  'editorial',
  'opinion',
  'subscribe to newsletter'
]

const GENERIC_NON_COMPANY_TITLES = [
  'top companies',
  'top manufacturers',
  'top industrial',
  'list of companies',
  'list of manufacturers',
  'directory',
  'companies in pakistan',
  'companies in karachi',
  'market trends',
  'competitors',
  'jobs',
  'careers',
  'vacancies',
  'news',
  'portal',
  'marketplace',
  'stock exchange',
  'ministry',
  'institute',
  'university'
]

const GENERIC_COMPANY_NAME_WORDS = new Set([
  'home',
  'about',
  'about us',
  'contact',
  'contact us',
  'services',
  'products',
  'portfolio',
  'careers',
  'welcome',
  'automobiles',
  'fabrication',
  'engineering',
  'manufacturing',
  'industries',
  'industry'
])

const PROFILE_PATH_SIGNALS = [
  '/company/',
  '/companies/',
  '/business/',
  '/businesses/',
  '/member/',
  '/members/',
  '/manufacturer/',
  '/manufacturers/',
  '/supplier/',
  '/suppliers/',
  '/vendor/',
  '/vendors/',
  '/profile/',
  '/listing/'
]

// ------------------------------------------------------------
// 5. INDUSTRIAL EVIDENCE MODEL
// ------------------------------------------------------------

const STRONG_FACILITY_TERMS = [
  'factory',
  'manufacturing facility',
  'production facility',
  'manufacturing plant',
  'production plant',
  'plant located',
  'factory located',
  'manufacturing unit',
  'production unit',
  'assembly plant',
  'processing plant',
  'rolling mill',
  'textile mill',
  'paper mill',
  'cement plant',
  'foundry',
  'machine shop',
  'tool room'
]

const INDUSTRIAL_OPERATION_TERMS = [
  'manufacturing',
  'manufacturer',
  'production',
  'fabrication',
  'fabricator',
  'machining',
  'cnc',
  'workshop',
  'engineering',
  'industrial',
  'assembly',
  'processing',
  'foundry',
  'forging',
  'casting',
  'metalworking',
  'welding',
  'maintenance',
  'utilities',
  'production line',
  'assembly line'
]

const COMPANY_IDENTITY_TERMS = [
  'private limited',
  'pvt ltd',
  'pvt. ltd',
  'limited',
  'ltd',
  'company',
  'our company',
  'we are',
  'established in',
  'founded in',
  'manufacturer',
  'manufacturing company'
]

// ------------------------------------------------------------
// 6. BASIC STRING / URL UTILITIES
// ------------------------------------------------------------

function clean(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function lower(value) {
  return clean(value).toLowerCase()
}

function decodeHtmlEntities(value) {
  return clean(
    String(value || '')
      .replace(/&amp;/gi, '&')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&ndash;/gi, '-')
      .replace(/&mdash;/gi, '-')
      .replace(/&#8211;/gi, '-')
      .replace(/&#8212;/gi, '-')
      .replace(/&#038;/gi, '&')
      .replace(/&#x27;/gi, "'")
      .replace(/&#x2F;/gi, '/')
      .replace(/&#(\d+);/g, (_, code) => {
        const number = Number(code)
        if (!Number.isFinite(number)) return ''
        try {
          return String.fromCodePoint(number)
        } catch {
          return ''
        }
      })
  )
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
    return ''
  }
}

function normalizedUrl(url) {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return ''
  }
}

function sameDomain(a, b) {
  const aHost = hostnameOf(a)
  const bHost = hostnameOf(b)
  return Boolean(aHost && bHost && aHost === bHost)
}

function hardExcludedDomain(url) {
  const host = hostnameOf(url)

  return HARD_EXCLUDE_DOMAINS.some(
    domain => host === domain || host.endsWith(`.${domain}`)
  )
}

function sourceOverride(url) {
  const host = hostnameOf(url)
  if (!host) return null

  for (const [domain, type] of Object.entries(SOURCE_DOMAIN_OVERRIDES)) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return type
    }
  }

  return null
}

function containsAny(text, values) {
  const haystack = lower(text)
  return values.some(value => haystack.includes(lower(value)))
}

function countUniqueSignals(text, values) {
  const haystack = lower(text)
  const found = new Set()

  for (const value of values) {
    if (haystack.includes(lower(value))) {
      found.add(lower(value))
    }
  }

  return found.size
}

function normalizeIdentity(value) {
  return lower(value)
    .replace(/\b(private|pvt|limited|ltd|company|co|corporation|corp|pakistan|pk)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function identityTokens(value) {
  return lower(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length >= 3)
    .filter(token => ![
      'private',
      'limited',
      'company',
      'corporation',
      'pakistan',
      'industries',
      'industry',
      'engineering',
      'manufacturing',
      'manufacturer'
    ].includes(token))
}

function tokenOverlapScore(a, b) {
  const aTokens = new Set(identityTokens(a))
  const bTokens = new Set(identityTokens(b))

  if (aTokens.size === 0 || bTokens.size === 0) return 0

  let overlap = 0

  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1
  }

  return overlap / Math.max(aTokens.size, bTokens.size)
}

function latinReadableRatio(value) {
  const text = String(value || '')
  if (!text) return 0

  const meaningful = text.replace(/\s/g, '')
  if (!meaningful) return 0

  const latin = (meaningful.match(/[A-Za-z0-9&.,()'\-]/g) || []).length
  return latin / meaningful.length
}

function looksLikeGenericTitle(value) {
  const title = lower(value)

  if (!title) return true

  if (GENERIC_NON_COMPANY_TITLES.some(term => title.includes(term))) {
    return true
  }

  if (GENERIC_COMPANY_NAME_WORDS.has(title)) {
    return true
  }

  return false
}

// ------------------------------------------------------------
// 7. HTML PARSING HELPERS
// ------------------------------------------------------------

function stripHtml(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
}

function extractHtmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? stripHtml(match[1]) : ''
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
    if (match) return decodeHtmlEntities(match[1])
  }

  return ''
}

function extractAnchors(html, baseUrl) {
  const anchors = []
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = pattern.exec(String(html || ''))) !== null) {
    const rawHref = decodeHtmlEntities(match[1])
    const anchorText = stripHtml(match[2])

    if (!rawHref) continue

    if (
      rawHref.startsWith('#') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:') ||
      rawHref.startsWith('javascript:')
    ) {
      continue
    }

    try {
      const resolved = new URL(rawHref, baseUrl).toString()
      anchors.push({
        url: normalizedUrl(resolved),
        text: clean(anchorText)
      })
    } catch {
      // Ignore malformed links.
    }
  }

  return anchors
}

function splitSentences(text) {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map(clean)
    .filter(sentence => sentence.length >= 35 && sentence.length <= 500)
}

// ------------------------------------------------------------
// 8. NETWORK HELPERS
// ------------------------------------------------------------

async function fetchWithTimeout(url, options = {}, timeoutMs = WEBSITE_FETCH_TIMEOUT_MS) {
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

async function fetchHtmlPage(url, timeoutMs = WEBSITE_FETCH_TIMEOUT_MS) {
  const safeUrl = normalizedUrl(url)
  if (!safeUrl) return null

  try {
    const response = await fetchWithTimeout(
      safeUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TriAxisIndustrialResearch/0.2.0; +https://tri-axis-platform.vercel.app)',
          Accept: 'text/html,application/xhtml+xml'
        },
        cache: 'no-store'
      },
      timeoutMs
    )

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return null

    const html = await response.text()
    const finalUrl = response.url || safeUrl

    return {
      url: finalUrl,
      html,
      title: extractHtmlTitle(html),
      description: extractMetaDescription(html),
      text: stripHtml(html).slice(0, 60000)
    }
  } catch {
    return null
  }
}

async function tavilySearch(apiKey, query, options = {}) {
  const payload = {
    api_key: apiKey,
    query,
    topic: 'general',
    search_depth: options.searchDepth || 'advanced',
    max_results: options.maxResults || 8,
    chunks_per_source: options.chunksPerSource || 3,
    include_answer: false,
    include_raw_content: options.includeRawContent ?? 'text',
    include_images: false,
    exclude_domains: HARD_EXCLUDE_DOMAINS,
    country: 'Pakistan'
  }

  const response = await fetchWithTimeout(
    TAVILY_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    },
    options.timeoutMs || SEARCH_FETCH_TIMEOUT_MS
  )

  const text = await response.text()

  if (!response.ok) {
    throw new Error(
      `Tavily search failed (${response.status}): ${text.slice(0, 300)}`
    )
  }

  let data

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Tavily returned a non-JSON response.')
  }

  return Array.isArray(data.results) ? data.results : []
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (true) {
      const current = nextIndex
      nextIndex += 1

      if (current >= items.length) return

      try {
        results[current] = await worker(items[current], current)
      } catch (error) {
        results[current] = { __error: error }
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker()
  )

  await Promise.all(workers)
  return results
}

// ------------------------------------------------------------
// 9. QUERY PLAN
// ------------------------------------------------------------

function industryDefinition(label) {
  return INDUSTRY_DEFINITIONS.find(item => item.label === label) || null
}

function selectedIndustries(filterValue) {
  if (!filterValue || filterValue === 'All Industries') {
    return INDUSTRY_DEFINITIONS
  }

  const exact = industryDefinition(filterValue)

  if (exact) return [exact]

  // The UI may have an older label. Keep search working instead of failing.
  return [
    {
      label: filterValue,
      searchTerms: [filterValue],
      evidenceTerms: [filterValue]
    }
  ]
}

function selectedCities(province, city) {
  if (clean(city)) return [clean(city)]

  return PROVINCE_LOCATIONS[province] || PROVINCE_LOCATIONS['All Pakistan']
}

function queryBudgetForBatch(batchSize) {
  if (batchSize >= 100) return 30
  if (batchSize >= 50) return 20
  return 12
}

function buildQueryPlan(filters, cursor = 0) {
  const industries = selectedIndustries(filters.industry)
  const cities = selectedCities(filters.province, filters.city)

  const businessTerms = BUSINESS_TYPE_TERMS[filters.businessType] || []
  const activityTerms = ACTIVITY_TERMS[filters.activity] || []
  const productTerms = PRODUCT_FIT_TERMS[filters.productFit] || []

  const optionalTerms = [
    ...businessTerms,
    ...activityTerms,
    ...productTerms,
    clean(filters.query)
  ]
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')

  const templates = [
    ({ term, city }) => `${term} ${city} Pakistan manufacturer factory official website ${optionalTerms}`,
    ({ term, city }) => `${term} ${city} Pakistan industrial company plant ${optionalTerms}`,
    ({ term, city }) => `${term} ${city} Pakistan "Pvt Ltd" OR "Private Limited" ${optionalTerms}`
  ]

  const fullPlan = []

  // Fair round-robin construction:
  // one sector gets one location before the same sector receives another turn.
  // This prevents All Industries from returning only Automotive or only Textile.
  for (let templateIndex = 0; templateIndex < templates.length; templateIndex += 1) {
    for (let industryIndex = 0; industryIndex < industries.length; industryIndex += 1) {
      const industry = industries[industryIndex]
      const city = cities[(industryIndex + templateIndex) % cities.length]
      const term = industry.searchTerms[templateIndex % industry.searchTerms.length]

      fullPlan.push({
        query: clean(templates[templateIndex]({ term, city })),
        industry: industry.label,
        city,
        templateIndex
      })
    }

    // Additional city rotation for narrow/single-sector searches.
    if (industries.length <= 3) {
      for (let cityIndex = 1; cityIndex < cities.length; cityIndex += 1) {
        for (const industry of industries) {
          const city = cities[cityIndex]
          const term = industry.searchTerms[templateIndex % industry.searchTerms.length]

          fullPlan.push({
            query: clean(templates[templateIndex]({ term, city })),
            industry: industry.label,
            city,
            templateIndex
          })
        }
      }
    }
  }

  const unique = []
  const seen = new Set()

  for (const item of fullPlan) {
    const key = lower(item.query)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }

  if (unique.length === 0) return []

  const offset = Math.max(0, Number(cursor) || 0) % unique.length
  const rotated = [...unique.slice(offset), ...unique.slice(0, offset)]

  return rotated
}

// ------------------------------------------------------------
// 10. RAW SEARCH RESULT CLASSIFICATION
// ------------------------------------------------------------

function classifyTextAsSiteType(title, content, rawContent, url) {
  const override = sourceOverride(url)
  if (override) return override

  const sample = clean(`${title}. ${content}. ${String(rawContent || '').slice(0, 15000)}`)
  const titleLower = lower(title)

  const directoryScore = countUniqueSignals(sample, DIRECTORY_SIGNALS)
  const associationScore = countUniqueSignals(sample, ASSOCIATION_SIGNALS)
  const governmentScore = countUniqueSignals(sample, GOVERNMENT_SIGNALS)
  const registryScore = countUniqueSignals(sample, REGISTRY_SIGNALS)
  const marketplaceScore = countUniqueSignals(sample, MARKETPLACE_SIGNALS)
  const mediaScore = countUniqueSignals(sample, MEDIA_SIGNALS)

  if (
    directoryScore >= 2 ||
    titleLower.includes('directory') ||
    titleLower.includes('business listings')
  ) {
    return 'directory'
  }

  if (
    associationScore >= 2 ||
    titleLower.includes('association of') ||
    titleLower.includes('chamber of commerce')
  ) {
    return 'association'
  }

  if (
    governmentScore >= 2 ||
    titleLower.startsWith('ministry of') ||
    titleLower.includes('government of pakistan')
  ) {
    return 'government_source'
  }

  if (
    registryScore >= 2 ||
    titleLower.includes('stock exchange') ||
    titleLower.includes('listed companies')
  ) {
    return 'registry_source'
  }

  if (marketplaceScore >= 2) return 'marketplace'
  if (mediaScore >= 2) return 'media'

  if (looksLikeGenericTitle(title)) {
    return 'generic_list_or_article'
  }

  return 'possible_company'
}

function rawResultAllowed(result) {
  const url = clean(result?.url)
  const title = clean(result?.title)

  if (!url || !title) return false
  if (!/^https?:\/\//i.test(url)) return false
  if (hardExcludedDomain(url)) return false
  if (latinReadableRatio(title) < 0.55) return false

  return true
}

// ------------------------------------------------------------
// 11. SOURCE PAGE MINING
// ------------------------------------------------------------

function looksLikeCompanyName(value) {
  const name = decodeHtmlEntities(value)

  if (!name) return false
  if (name.length < 3 || name.length > 110) return false
  if (looksLikeGenericTitle(name)) return false
  if (latinReadableRatio(name) < 0.7) return false

  const words = name.split(/\s+/).filter(Boolean)
  if (words.length > 12) return false

  const hasLegalOrIndustrialWord = containsAny(name, [
    'pvt',
    'private',
    'limited',
    'ltd',
    'industries',
    'engineering',
    'works',
    'manufacturing',
    'mills',
    'textiles',
    'steel',
    'chemicals',
    'pharma',
    'foods',
    'motors',
    'cables',
    'cement',
    'packaging',
    'plastics'
  ])

  if (hasLegalOrIndustrialWord) return true

  // A normal brand-style name can still be valid.
  return words.length >= 1 && words.length <= 6
}

function extractCompanyNamesFromText(text) {
  const source = decodeHtmlEntities(text)
  const names = []

  // Conservative legal-name extraction. This does not make a company valid;
  // it only creates names to resolve to official websites later.
  const patterns = [
    /\b([A-Z][A-Za-z0-9&'().,\- ]{2,80}\s(?:Private Limited|Pvt\.?\s*Ltd\.?|Limited|Ltd\.?))\b/g,
    /\b([A-Z][A-Za-z0-9&'().,\- ]{2,70}\s(?:Industries|Engineering|Works|Manufacturing|Mills|Textiles|Chemicals|Pharmaceuticals|Foods|Motors|Cables|Cement))\b/g
  ]

  for (const pattern of patterns) {
    let match

    while ((match = pattern.exec(source)) !== null) {
      const candidate = clean(match[1])
      if (looksLikeCompanyName(candidate)) names.push(candidate)
      if (names.length >= 30) break
    }

    if (names.length >= 30) break
  }

  return [...new Set(names.map(clean))]
}

function isLikelyProfilePath(url) {
  const value = lower(url)
  return PROFILE_PATH_SIGNALS.some(signal => value.includes(signal))
}

function usefulExternalAnchor(anchor, sourceUrl) {
  if (!anchor?.url) return false
  if (sameDomain(anchor.url, sourceUrl)) return false
  if (hardExcludedDomain(anchor.url)) return false
  if (!/^https?:\/\//i.test(anchor.url)) return false

  const text = clean(anchor.text)

  // "Website", "Visit website", or a company name are all useful.
  if (/^(website|visit website|official website|web site)$/i.test(text)) return true
  if (looksLikeCompanyName(text)) return true

  return false
}

async function mineSourcePage(sourceResult, context) {
  if (context.timeExpired()) return []

  const sourcePage = await fetchHtmlPage(sourceResult.url, 6500)
  if (!sourcePage) return []

  const anchors = extractAnchors(sourcePage.html, sourcePage.url)
  const seeds = []

  // A) Direct external links from the source page.
  for (const anchor of anchors) {
    if (!usefulExternalAnchor(anchor, sourcePage.url)) continue

    seeds.push({
      websiteUrl: rootUrl(anchor.url),
      expectedName: looksLikeCompanyName(anchor.text) ? anchor.text : '',
      sourceUrl: sourcePage.url,
      sourceType: `${sourceResult.siteType} source`,
      queryIndustry: sourceResult._queryIndustry,
      queryCity: sourceResult._queryCity,
      origin: 'source_external_link'
    })

    if (seeds.length >= context.maxExternalLinksPerSource) break
  }

  // B) Internal profile/member/listing links.
  const profileLinks = []
  const seenProfiles = new Set()

  for (const anchor of anchors) {
    if (!sameDomain(anchor.url, sourcePage.url)) continue
    if (!isLikelyProfilePath(anchor.url)) continue

    const key = normalizedUrl(anchor.url)
    if (!key || seenProfiles.has(key)) continue

    seenProfiles.add(key)
    profileLinks.push({
      url: key,
      anchorText: clean(anchor.text)
    })

    if (profileLinks.length >= context.maxProfilesPerSource) break
  }

  const profileResults = await mapWithConcurrency(
    profileLinks,
    4,
    async profile => {
      if (context.timeExpired()) return []

      const page = await fetchHtmlPage(profile.url, 5500)
      if (!page) return []

      const profileAnchors = extractAnchors(page.html, page.url)
      const profileSeeds = []

      // Prefer a real external official website from the profile.
      for (const anchor of profileAnchors) {
        if (!usefulExternalAnchor(anchor, page.url)) continue

        profileSeeds.push({
          websiteUrl: rootUrl(anchor.url),
          expectedName:
            looksLikeCompanyName(profile.anchorText)
              ? profile.anchorText
              : companyNameFromTitle(page.title, anchor.url),
          sourceUrl: page.url,
          sourceType: `${sourceResult.siteType} profile`,
          queryIndustry: sourceResult._queryIndustry,
          queryCity: sourceResult._queryCity,
          origin: 'source_profile_external_link'
        })

        // One official external site per profile is normally enough.
        break
      }

      // If no external website exists, keep the company name for lookup.
      if (profileSeeds.length === 0) {
        const profileName =
          looksLikeCompanyName(profile.anchorText)
            ? profile.anchorText
            : companyNameFromTitle(page.title, page.url)

        if (looksLikeCompanyName(profileName)) {
          profileSeeds.push({
            companyNameOnly: profileName,
            sourceUrl: page.url,
            sourceType: `${sourceResult.siteType} profile`,
            queryIndustry: sourceResult._queryIndustry,
            queryCity: sourceResult._queryCity,
            origin: 'source_profile_name_only'
          })
        }
      }

      return profileSeeds
    }
  )

  for (const result of profileResults) {
    if (Array.isArray(result)) seeds.push(...result)
  }

  // C) Company names visible in source page text.
  const extractedNames = extractCompanyNamesFromText(sourcePage.text)

  for (const name of extractedNames.slice(0, context.maxNamesPerSource)) {
    seeds.push({
      companyNameOnly: name,
      sourceUrl: sourcePage.url,
      sourceType: `${sourceResult.siteType} text extraction`,
      queryIndustry: sourceResult._queryIndustry,
      queryCity: sourceResult._queryCity,
      origin: 'source_text_name'
    })
  }

  return seeds
}

// ------------------------------------------------------------
// 12. COMPANY NAME / WEBSITE RESOLUTION
// ------------------------------------------------------------

function removePageTitleNoise(value) {
  let text = decodeHtmlEntities(value)

  text = text
    .replace(/^welcome\s+to\s+/i, '')
    .replace(/^about\s+/i, '')
    .replace(/^home\s*[|\-–—:]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text
}

function companyNameFromTitle(title, url) {
  const cleanedTitle = removePageTitleNoise(title)

  const parts = cleanedTitle
    .split(/\s+[|–—-]\s+/)
    .map(part => removePageTitleNoise(part))
    .filter(Boolean)

  for (const part of parts) {
    if (
      part.length >= 2 &&
      part.length <= 100 &&
      !looksLikeGenericTitle(part) &&
      latinReadableRatio(part) >= 0.65
    ) {
      return part
    }
  }

  const host = hostnameOf(url)
  if (!host) return ''

  const domainCore = host.split('.')[0] || ''

  return domainCore
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function expectedNameVsPageScore(expectedName, pageName, pageTitle, description) {
  if (!expectedName) return 0

  const expectedNormalized = normalizeIdentity(expectedName)
  const pageNormalized = normalizeIdentity(pageName)

  if (!expectedNormalized || !pageNormalized) return 0

  let score = 0

  if (expectedNormalized === pageNormalized) score += 4

  if (
    expectedNormalized.includes(pageNormalized) ||
    pageNormalized.includes(expectedNormalized)
  ) {
    score += 3
  }

  const overlap = tokenOverlapScore(expectedName, pageName)

  if (overlap >= 0.75) score += 3
  else if (overlap >= 0.5) score += 2
  else if (overlap >= 0.25) score += 1

  const pageText = lower(`${pageTitle}. ${description}`)
  if (pageText.includes(lower(expectedName))) score += 2

  return score
}

function domainIdentityScore(companyName, url) {
  const host = hostnameOf(url)
  if (!host || !companyName) return 0

  const domainCore = host.split('.')[0] || ''
  const domainNormalized = normalizeIdentity(domainCore)
  const nameNormalized = normalizeIdentity(companyName)

  if (!domainNormalized || !nameNormalized) return 0

  let score = 0

  if (domainNormalized === nameNormalized) score += 4

  if (
    domainNormalized.includes(nameNormalized) ||
    nameNormalized.includes(domainNormalized)
  ) {
    score += 3
  }

  const overlap = tokenOverlapScore(companyName, domainCore.replace(/[-_]/g, ' '))

  if (overlap >= 0.75) score += 3
  else if (overlap >= 0.5) score += 2
  else if (overlap >= 0.25) score += 1

  return score
}

async function lookupOfficialWebsiteByName(seed, apiKey, context) {
  if (!seed.companyNameOnly) return null
  if (context.timeExpired()) return null
  if (context.officialLookupsUsed >= context.maxOfficialLookups) return null

  context.officialLookupsUsed += 1

  const query = `"${seed.companyNameOnly}" Pakistan official website`

  let results

  try {
    results = await tavilySearch(apiKey, query, {
      searchDepth: 'basic',
      maxResults: 5,
      chunksPerSource: 1,
      includeRawContent: false,
      timeoutMs: OFFICIAL_LOOKUP_TIMEOUT_MS
    })
  } catch {
    return null
  }

  let best = null
  let bestScore = -1

  for (const result of results) {
    if (!rawResultAllowed(result)) continue

    const type = classifyTextAsSiteType(
      result.title,
      result.content,
      result.raw_content,
      result.url
    )

    if (type !== 'possible_company') continue

    const candidateName = companyNameFromTitle(result.title, result.url)

    const score =
      expectedNameVsPageScore(
        seed.companyNameOnly,
        candidateName,
        result.title,
        result.content
      ) +
      domainIdentityScore(seed.companyNameOnly, result.url)

    if (score > bestScore) {
      bestScore = score
      best = result
    }
  }

  if (!best || bestScore < 3) return null

  return {
    websiteUrl: rootUrl(best.url),
    expectedName: seed.companyNameOnly,
    sourceUrl: seed.sourceUrl,
    sourceType: seed.sourceType,
    queryIndustry: seed.queryIndustry,
    queryCity: seed.queryCity,
    origin: 'official_lookup'
  }
}

// ------------------------------------------------------------
// 13. LOCATION / COUNTRY VALIDATION
// ------------------------------------------------------------

function detectLocation(text) {
  const value = lower(text)

  const scored = []

  for (const location of LOCATION_DEFINITIONS) {
    let score = 0

    for (const alias of location.aliases) {
      if (value.includes(lower(alias))) score += 1
    }

    if (score > 0) {
      scored.push({
        city: location.city,
        province: location.province,
        score
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  return scored[0] || null
}

function hasPakistanEvidence(text, website) {
  const value = lower(text)
  const host = hostnameOf(website)

  if (host.endsWith('.pk')) return true
  if (value.includes('pakistan')) return true
  if (value.includes('+92')) return true

  return LOCATION_DEFINITIONS.some(location =>
    location.aliases.some(alias => value.includes(lower(alias)))
  )
}

function locationMatchesFilters(location, text, filters) {
  const value = lower(text)

  if (clean(filters.city)) {
    const requested = lower(filters.city)

    // If an explicit city was requested, the company's own page must support it.
    if (location && lower(location.city) === requested) return true
    if (value.includes(requested)) return true

    return false
  }

  if (filters.province && filters.province !== 'All Pakistan') {
    if (location && location.province === filters.province) return true
    if (value.includes(lower(filters.province))) return true

    return false
  }

  return true
}

// ------------------------------------------------------------
// 14. INDUSTRY / BUSINESS CLASSIFICATION
// ------------------------------------------------------------

function industryScores(text) {
  const scores = []

  for (const industry of INDUSTRY_DEFINITIONS) {
    const score = countUniqueSignals(text, industry.evidenceTerms)

    if (score > 0) {
      scores.push({
        label: industry.label,
        score
      })
    }
  }

  scores.sort((a, b) => b.score - a.score)
  return scores
}

function classifyIndustry(text, queryIndustry) {
  const scores = industryScores(text)

  if (scores.length === 0) {
    return {
      label: queryIndustry || 'Unknown',
      score: 0
    }
  }

  const queryMatch = scores.find(item => item.label === queryIndustry)
  const strongest = scores[0]

  // If the searched sector has real evidence, preserve it unless another sector
  // is substantially stronger.
  if (queryMatch && queryMatch.score >= 1) {
    if (strongest.score <= queryMatch.score + 1) {
      return queryMatch
    }
  }

  return strongest
}

function detectBusinessType(text) {
  const value = lower(text)

  const rules = [
    ['Machine Shop', ['machine shop', 'cnc machining', 'cnc machine', 'tool room']],
    ['Fabricator', ['fabricator', 'fabrication', 'structural steel', 'welding']],
    ['Processor', ['processing plant', 'processor', 'processing facility']],
    ['EPC Contractor', ['epc contractor', 'engineering procurement construction']],
    ['Industrial Contractor', ['industrial contractor', 'plant contractor']],
    ['Industrial Services', ['industrial services', 'maintenance services', 'shutdown maintenance']],
    ['Manufacturer', ['manufacturer', 'manufacturing', 'factory', 'production facility', 'production plant']]
  ]

  for (const [label, terms] of rules) {
    if (containsAny(value, terms)) return label
  }

  return 'Unknown'
}

function businessTypeMatchesFilter(detectedType, text, filterValue) {
  if (!filterValue || filterValue === 'All Business Types') return true

  if (detectedType === filterValue) return true

  const requiredTerms = BUSINESS_TYPE_TERMS[filterValue] || []
  return containsAny(text, requiredTerms)
}

function activityMatchesFilter(text, filterValue) {
  if (!filterValue || filterValue === 'All Activities') return true
  return containsAny(text, ACTIVITY_TERMS[filterValue] || [])
}

function productFitMatchesFilter(text, filterValue) {
  if (!filterValue || filterValue === 'All Product Fits') return true
  return containsAny(text, PRODUCT_FIT_TERMS[filterValue] || [])
}

// ------------------------------------------------------------
// 15. INDUSTRIAL EVIDENCE EXTRACTION
// ------------------------------------------------------------

function industrialEvidenceSentences(text) {
  const sentences = splitSentences(text)
  const ranked = []

  for (const sentence of sentences) {
    const strongScore = countUniqueSignals(sentence, STRONG_FACILITY_TERMS)
    const operationScore = countUniqueSignals(sentence, INDUSTRIAL_OPERATION_TERMS)

    const score = strongScore * 4 + operationScore

    if (score > 0) {
      ranked.push({ sentence, score })
    }
  }

  ranked.sort((a, b) => b.score - a.score)

  const selected = []
  const seen = new Set()

  for (const item of ranked) {
    const key = lower(item.sentence)
    if (seen.has(key)) continue

    seen.add(key)
    selected.push(item.sentence)

    if (selected.length >= 2) break
  }

  return selected
}

function buildDescription(page) {
  if (page.description && page.description.length >= 30) {
    return page.description.slice(0, 500)
  }

  const sentences = splitSentences(page.text)

  for (const sentence of sentences) {
    if (
      containsAny(sentence, [
        'we are',
        'our company',
        'manufacturer',
        'manufacturing',
        'established',
        'founded'
      ])
    ) {
      return sentence.slice(0, 500)
    }
  }

  return sentences[0]?.slice(0, 500) || 'Unknown'
}

// ------------------------------------------------------------
// 16. OFFICIAL COMPANY VALIDATION
// ------------------------------------------------------------

function classifyFetchedPage(page) {
  const override = sourceOverride(page.url)
  if (override) return override

  const sample = clean(`${page.title}. ${page.description}. ${page.text.slice(0, 18000)}`)
  const titleLower = lower(page.title)

  const directoryScore = countUniqueSignals(sample, DIRECTORY_SIGNALS)
  const associationScore = countUniqueSignals(sample, ASSOCIATION_SIGNALS)
  const governmentScore = countUniqueSignals(sample, GOVERNMENT_SIGNALS)
  const registryScore = countUniqueSignals(sample, REGISTRY_SIGNALS)
  const marketplaceScore = countUniqueSignals(sample, MARKETPLACE_SIGNALS)
  const mediaScore = countUniqueSignals(sample, MEDIA_SIGNALS)

  if (
    directoryScore >= 2 ||
    titleLower.includes('directory') ||
    titleLower.includes('business listings')
  ) {
    return 'directory'
  }

  if (
    associationScore >= 2 ||
    titleLower.includes('association of') ||
    titleLower.includes('chamber of commerce')
  ) {
    return 'association'
  }

  if (
    governmentScore >= 2 ||
    titleLower.startsWith('ministry of') ||
    titleLower.includes('government of pakistan')
  ) {
    return 'government_source'
  }

  if (
    registryScore >= 2 ||
    titleLower.includes('stock exchange') ||
    titleLower.includes('listed companies')
  ) {
    return 'registry_source'
  }

  if (marketplaceScore >= 2) return 'marketplace'
  if (mediaScore >= 2) return 'media'

  return 'possible_company'
}

function companyIdentityScore(pageName, expectedName, page) {
  let score = 0

  score += Math.min(domainIdentityScore(pageName, page.url), 4)

  if (expectedName) {
    score += Math.min(
      expectedNameVsPageScore(expectedName, pageName, page.title, page.description),
      5
    )
  }

  if (containsAny(`${page.title}. ${page.description}`, COMPANY_IDENTITY_TERMS)) {
    score += 1
  }

  if (containsAny(page.text.slice(0, 12000), ['our company', 'we are', 'established in', 'founded in'])) {
    score += 1
  }

  return score
}

function relevanceFromScores(identityScore, industrialScore, facilityScore, locationKnown) {
  if (
    identityScore >= 5 &&
    industrialScore >= 4 &&
    facilityScore >= 1 &&
    locationKnown
  ) {
    return 'High'
  }

  if (
    identityScore >= 4 &&
    industrialScore >= 2 &&
    locationKnown
  ) {
    return 'Medium'
  }

  return 'Low'
}

function evidenceQualityAccepted(relevance, quality) {
  if (!quality || quality === 'Any Evidence' || quality === 'Unknown Allowed') {
    return true
  }

  if (quality === 'Confirmed') return relevance === 'High'
  if (quality === 'Likely') return relevance === 'High' || relevance === 'Medium'

  return true
}

async function validateCompanySeed(seed, filters, context) {
  if (context.timeExpired()) return rejection('time_budget')
  if (!seed.websiteUrl) return rejection('missing_website')
  if (hardExcludedDomain(seed.websiteUrl)) return rejection('hard_excluded_domain')
  if (sourceOverride(seed.websiteUrl)) return rejection('source_domain_not_company')

  const root = rootUrl(seed.websiteUrl)
  if (!root) return rejection('invalid_website')

  const page = await fetchHtmlPage(root, 6000)
  if (!page) return rejection('website_unreachable')

  const siteType = classifyFetchedPage(page)

  if (siteType !== 'possible_company') {
    return rejection(`site_type_${siteType}`)
  }

  if (latinReadableRatio(page.title) < 0.55) {
    return rejection('non_latin_or_unreadable_title')
  }

  const pageName = companyNameFromTitle(page.title, page.url)

  if (!looksLikeCompanyName(pageName)) {
    return rejection('invalid_company_name')
  }

  const combined = clean(`${page.title}. ${page.description}. ${page.text}`)

  if (!hasPakistanEvidence(combined, page.url)) {
    return rejection('no_pakistan_evidence')
  }

  const location = detectLocation(combined)

  if (!locationMatchesFilters(location, combined, filters)) {
    return rejection('location_filter_mismatch')
  }

  const identityScore = companyIdentityScore(
    pageName,
    seed.expectedName,
    page
  )

  if (identityScore < 3) {
    return rejection('weak_company_identity')
  }

  const industry = classifyIndustry(combined, seed.queryIndustry)

  if (
    filters.industry !== 'All Industries' &&
    industry.label !== filters.industry
  ) {
    const selectedDefinition = industryDefinition(filters.industry)
    const selectedScore = selectedDefinition
      ? countUniqueSignals(combined, selectedDefinition.evidenceTerms)
      : 0

    if (selectedScore === 0) {
      return rejection('industry_filter_mismatch')
    }
  }

  const industrialScore = countUniqueSignals(combined, INDUSTRIAL_OPERATION_TERMS)
  const facilityScore = countUniqueSignals(combined, STRONG_FACILITY_TERMS)

  // At least two industrial signals are required for any prospect.
  // This prevents ordinary offices/portals/services pages from entering the list.
  if (industrialScore < 2) {
    return rejection('weak_industrial_evidence')
  }

  if (!activityMatchesFilter(combined, filters.activity)) {
    return rejection('activity_filter_mismatch')
  }

  if (!productFitMatchesFilter(combined, filters.productFit)) {
    return rejection('product_fit_filter_mismatch')
  }

  const detectedBusinessType = detectBusinessType(combined)

  if (!businessTypeMatchesFilter(detectedBusinessType, combined, filters.businessType)) {
    return rejection('business_type_filter_mismatch')
  }

  const evidenceSentences = industrialEvidenceSentences(combined)

  if (evidenceSentences.length === 0) {
    return rejection('no_evidence_sentence')
  }

  const relevance = relevanceFromScores(
    identityScore,
    industrialScore,
    facilityScore,
    Boolean(location)
  )

  if (!evidenceQualityAccepted(relevance, filters.evidenceQuality)) {
    return rejection('evidence_quality_filter')
  }

  // For this industrial prospecting use case, Low relevance is too weak to show
  // by default as a live candidate. We only keep Low if Unknown Allowed was selected.
  if (relevance === 'Low' && filters.evidenceQuality !== 'Unknown Allowed') {
    return rejection('low_relevance')
  }

  const companyName =
    seed.expectedName && expectedNameVsPageScore(seed.expectedName, pageName, page.title, page.description) >= 4
      ? clean(seed.expectedName)
      : pageName

  const finalLocation = location || null

  const score =
    identityScore * 10 +
    industrialScore * 4 +
    facilityScore * 8 +
    (relevance === 'High' ? 20 : relevance === 'Medium' ? 10 : 0) +
    (seed.origin?.startsWith('source_') ? 2 : 0)

  return {
    accepted: true,
    score,
    candidate: {
      company_name: companyName,
      website: rootUrl(page.url),
      industry: industry.label || seed.queryIndustry || 'Unknown',
      business_type: detectedBusinessType,
      city: finalLocation?.city || 'Unknown',
      province: finalLocation?.province || 'Unknown',
      country: 'Pakistan',
      description: buildDescription(page),
      factory_evidence: evidenceSentences.join(' ').slice(0, 900),
      industrial_relevance: relevance,
      source_url: seed.sourceUrl || page.url,
      source_type: sourceTypeLabel(seed),
      status: 'Discovered',
      last_checked: new Date().toISOString()
    }
  }
}

function sourceTypeLabel(seed) {
  if (seed.origin === 'direct_search_result') return 'Validated official website'
  if (seed.origin === 'source_external_link') return `${seed.sourceType} -> official website`
  if (seed.origin === 'source_profile_external_link') return `${seed.sourceType} -> official website`
  if (seed.origin === 'official_lookup') return `${seed.sourceType} -> resolved official website`
  return seed.sourceType || 'Validated official website'
}

function rejection(reason) {
  return {
    accepted: false,
    reason
  }
}

// ------------------------------------------------------------
// 17. DEDUPLICATION / RESULT BALANCING
// ------------------------------------------------------------

function candidateIdentityKey(candidate) {
  const nameKey = normalizeIdentity(candidate.company_name)
  const domainKey = hostnameOf(candidate.website)

  return {
    nameKey,
    domainKey
  }
}

function dedupeValidated(results) {
  const sorted = [...results].sort((a, b) => b.score - a.score)
  const final = []
  const seenNames = new Set()
  const seenDomains = new Set()

  for (const result of sorted) {
    const candidate = result.candidate
    const { nameKey, domainKey } = candidateIdentityKey(candidate)

    if (nameKey && seenNames.has(nameKey)) continue
    if (domainKey && seenDomains.has(domainKey)) continue

    if (nameKey) seenNames.add(nameKey)
    if (domainKey) seenDomains.add(domainKey)

    final.push(result)
  }

  return final
}

function balanceByIndustry(validated, limit, filters) {
  const sorted = [...validated].sort((a, b) => b.score - a.score)

  if (filters.industry !== 'All Industries') {
    return sorted.slice(0, limit)
  }

  const groups = new Map()

  for (const item of sorted) {
    const industry = item.candidate.industry || 'Unknown'
    if (!groups.has(industry)) groups.set(industry, [])
    groups.get(industry).push(item)
  }

  const industries = [...groups.keys()]
  const result = []
  let round = 0

  while (result.length < limit) {
    let added = false

    for (const industry of industries) {
      const group = groups.get(industry)
      const item = group?.[round]

      if (item) {
        result.push(item)
        added = true

        if (result.length >= limit) break
      }
    }

    if (!added) break
    round += 1
  }

  return result
}

// ------------------------------------------------------------
// 18. REQUEST CONTEXT / BUDGETS
// ------------------------------------------------------------

function createContext(filters, startedAt) {
  const batchSize = filters.resultsPerBatch

  return {
    startedAt,
    timeExpired() {
      return Date.now() - startedAt >= EXECUTION_BUDGET_MS
    },
    maxSourcePages: batchSize >= 100 ? 14 : batchSize >= 50 ? 10 : 6,
    maxExternalLinksPerSource: batchSize >= 100 ? 18 : 12,
    maxProfilesPerSource: batchSize >= 100 ? 10 : 7,
    maxNamesPerSource: batchSize >= 100 ? 14 : 8,
    maxOfficialLookups: batchSize >= 100 ? 30 : batchSize >= 50 ? 20 : 12,
    officialLookupsUsed: 0
  }
}

function parseFilters(body) {
  return {
    industry: clean(body?.industry) || 'All Industries',
    businessType: clean(body?.businessType) || 'All Business Types',
    province: clean(body?.province) || 'All Pakistan',
    city: clean(body?.city),
    activity: clean(body?.activity) || 'All Activities',
    productFit: clean(body?.productFit) || 'All Product Fits',
    evidenceQuality: clean(body?.evidenceQuality) || 'Any Evidence',
    resultsPerBatch: Math.min(
      Math.max(Number(body?.resultsPerBatch) || 50, 10),
      100
    ),
    query: clean(body?.query),
    cursor: Math.max(0, Number(body?.cursor) || 0)
  }
}

function incrementCounter(object, key) {
  object[key] = (object[key] || 0) + 1
}

// ------------------------------------------------------------
// 19. MAIN DISCOVERY PIPELINE
// ------------------------------------------------------------

export async function POST(request) {
  const startedAt = Date.now()

  try {
    const apiKey = process.env.TAVILY_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'TAVILY_API_KEY is missing in Vercel environment variables.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const filters = parseFilters(body)
    const context = createContext(filters, startedAt)

    const stats = {
      search_queries_planned: 0,
      search_queries_executed: 0,
      raw_search_results: 0,
      raw_unique_domains: 0,
      direct_company_seeds: 0,
      source_pages_found: 0,
      source_seeds_extracted: 0,
      official_name_lookups: 0,
      validation_attempts: 0,
      validated_companies_before_dedupe: 0,
      validated_companies_after_dedupe: 0,
      rejected_by_reason: {}
    }

    const queryPlan = buildQueryPlan(filters, filters.cursor)
    stats.search_queries_planned = queryPlan.length

    const queryBudget = Math.min(
      queryBudgetForBatch(filters.resultsPerBatch),
      queryPlan.length
    )

    const queryBatch = queryPlan.slice(0, queryBudget)

    // ------------------------------
    // A. Search the web in parallel.
    // ------------------------------

    const searchResponses = await mapWithConcurrency(
      queryBatch,
      4,
      async planItem => {
        if (context.timeExpired()) return []

        const results = await tavilySearch(apiKey, planItem.query, {
          searchDepth: 'advanced',
          maxResults: 8,
          chunksPerSource: 3,
          includeRawContent: 'text'
        })

        stats.search_queries_executed += 1

        return results.map(result => ({
          ...result,
          _queryIndustry: planItem.industry,
          _queryCity: planItem.city,
          _query: planItem.query
        }))
      }
    )

    const rawResults = []

    for (const response of searchResponses) {
      if (!Array.isArray(response)) continue

      for (const result of response) {
        stats.raw_search_results += 1

        if (!rawResultAllowed(result)) {
          incrementCounter(stats.rejected_by_reason, 'raw_result_invalid_or_excluded')
          continue
        }

        rawResults.push(result)
      }
    }

    // Deduplicate raw results by domain + URL before deeper work.
    const uniqueRaw = []
    const rawSeen = new Set()
    const domainSet = new Set()

    for (const result of rawResults) {
      const url = normalizedUrl(result.url)
      const host = hostnameOf(url)

      if (!url || !host) continue

      const key = `${host}|${url}`
      if (rawSeen.has(key)) continue

      rawSeen.add(key)
      domainSet.add(host)
      uniqueRaw.push(result)
    }

    stats.raw_unique_domains = domainSet.size

    // ---------------------------------------------
    // B. Separate direct candidates from sources.
    // ---------------------------------------------

    const directSeeds = []
    const sourceResults = []

    for (const result of uniqueRaw) {
      const siteType = classifyTextAsSiteType(
        result.title,
        result.content,
        result.raw_content,
        result.url
      )

      if (siteType === 'possible_company') {
        directSeeds.push({
          websiteUrl: rootUrl(result.url),
          expectedName: companyNameFromTitle(result.title, result.url),
          sourceUrl: result.url,
          sourceType: 'Web search',
          queryIndustry: result._queryIndustry,
          queryCity: result._queryCity,
          origin: 'direct_search_result'
        })
      } else if (
        siteType === 'directory' ||
        siteType === 'association' ||
        siteType === 'government_source' ||
        siteType === 'registry_source' ||
        siteType === 'generic_list_or_article'
      ) {
        sourceResults.push({
          ...result,
          siteType
        })
      } else {
        incrementCounter(stats.rejected_by_reason, `raw_site_type_${siteType}`)
      }
    }

    stats.direct_company_seeds = directSeeds.length
    stats.source_pages_found = sourceResults.length

    // ---------------------------------------------
    // C. Mine directories/associations/source pages.
    // ---------------------------------------------

    const sourceBatch = sourceResults.slice(0, context.maxSourcePages)

    const minedSeedGroups = await mapWithConcurrency(
      sourceBatch,
      3,
      async source => mineSourcePage(source, context)
    )

    const sourceSeeds = []

    for (const group of minedSeedGroups) {
      if (!Array.isArray(group)) continue
      sourceSeeds.push(...group)
    }

    stats.source_seeds_extracted = sourceSeeds.length

    // ---------------------------------------------
    // D. Resolve source-extracted names to websites.
    // ---------------------------------------------

    const readySourceSeeds = []
    const nameOnlySeeds = []

    for (const seed of sourceSeeds) {
      if (seed.websiteUrl) readySourceSeeds.push(seed)
      else if (seed.companyNameOnly) nameOnlySeeds.push(seed)
    }

    const lookupResults = await mapWithConcurrency(
      nameOnlySeeds.slice(0, context.maxOfficialLookups),
      3,
      async seed => lookupOfficialWebsiteByName(seed, apiKey, context)
    )

    for (const result of lookupResults) {
      if (result && !result.__error) {
        readySourceSeeds.push(result)
      }
    }

    stats.official_name_lookups = context.officialLookupsUsed

    // ---------------------------------------------
    // E. Dedupe seeds before website validation.
    // ---------------------------------------------

    const allSeeds = [...directSeeds, ...readySourceSeeds]
    const seedSeen = new Set()
    const uniqueSeeds = []

    for (const seed of allSeeds) {
      const host = hostnameOf(seed.websiteUrl)
      if (!host) continue

      const expectedKey = normalizeIdentity(seed.expectedName || '')
      const key = `${host}|${expectedKey}`

      if (seedSeen.has(key)) continue
      seedSeen.add(key)
      uniqueSeeds.push(seed)
    }

    // Do not inspect an unbounded number of websites in one request.
    const validationCap = Math.min(
      Math.max(filters.resultsPerBatch * 3, 60),
      180
    )

    const validationBatch = uniqueSeeds.slice(0, validationCap)

    // ---------------------------------------------
    // F. Validate official company websites.
    // ---------------------------------------------

    const validationResults = await mapWithConcurrency(
      validationBatch,
      8,
      async seed => {
        if (context.timeExpired()) return rejection('time_budget')
        stats.validation_attempts += 1
        return validateCompanySeed(seed, filters, context)
      }
    )

    const accepted = []

    for (const result of validationResults) {
      if (!result || result.__error) {
        incrementCounter(stats.rejected_by_reason, 'validation_exception')
        continue
      }

      if (result.accepted) {
        accepted.push(result)
      } else {
        incrementCounter(stats.rejected_by_reason, result.reason || 'unknown_rejection')
      }
    }

    stats.validated_companies_before_dedupe = accepted.length

    // ---------------------------------------------
    // G. Dedupe and balance sector coverage.
    // ---------------------------------------------

    const deduped = dedupeValidated(accepted)
    stats.validated_companies_after_dedupe = deduped.length

    const balanced = balanceByIndustry(
      deduped,
      filters.resultsPerBatch,
      filters
    )

    const candidates = balanced.map(item => item.candidate)

    const nextCursor =
      queryPlan.length > 0
        ? (filters.cursor + queryBatch.length) % queryPlan.length
        : 0

    return NextResponse.json({
      candidates,
      meta: {
        version: ENGINE_VERSION,
        scope: filters.city || filters.province || 'All Pakistan',
        requested_batch_size: filters.resultsPerBatch,
        candidates_returned: candidates.length,
        next_cursor: nextCursor,
        execution_ms: Date.now() - startedAt,
        time_budget_reached: context.timeExpired(),
        stats
      }
    })
  } catch (error) {
    console.error('Tri Axis Discovery Engine v0.2.0 error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown discovery engine error.',
        version: ENGINE_VERSION
      },
      { status: 500 }
    )
  }
}
