// TRI AXIS v0.1.7
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/api/discover/route.js
//
// PURPOSE
// Stop treating directories, portals, news sites, government pages,
// associations, marketplaces, stock exchanges, job sites and list pages
// as if they were industrial companies.
//
// IMPORTANT DESIGN RULE
// A search result is NOT a company.
// It must pass all of these stages:
//
// 1. Search result sanity check
// 2. Domain/category rejection
// 3. Root website inspection
// 4. Site-type classification
// 5. Company identity extraction
// 6. Company-name/domain consistency check
// 7. Industrial evidence check
// 8. Relevance assignment
// 9. Deduplication
//
// If a result cannot pass these checks, it is rejected.
// Returning fewer real companies is better than filling the table with junk.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAVILY_URL = 'https://api.tavily.com/search'

const INDUSTRIES = [
  'Automotive',
  'Cement',
  'Chemicals',
  'Electrical & Cables',
  'Engineering & Fabrication',
  'Food & Beverage',
  'HVAC',
  'Oil & Gas',
  'Packaging',
  'Pharmaceuticals',
  'Plastics',
  'Power & Energy',
  'Steel & Metals',
  'Textile'
]

const PROVINCE_CITIES = {
  'All Pakistan': [
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
  ],
  Sindh: ['Karachi', 'Hyderabad'],
  Punjab: [
    'Lahore',
    'Faisalabad',
    'Gujranwala',
    'Sialkot',
    'Rawalpindi',
    'Multan',
    'Sheikhupura',
    'Kasur'
  ],
  'Khyber Pakhtunkhwa': ['Peshawar', 'Nowshera', 'Hattar'],
  Balochistan: ['Hub', 'Quetta'],
  'Islamabad Capital Territory': ['Islamabad']
}

const ACTIVITY_TERMS = {
  'All Activities': [],
  Manufacturing: ['manufacturer', 'manufacturing', 'factory', 'production plant'],
  Fabrication: ['fabrication', 'fabricator', 'structural steel'],
  'Machining / CNC': ['machining', 'cnc', 'machine shop'],
  Processing: ['processing', 'production line'],
  Assembly: ['assembly', 'assembly plant'],
  'Plant Maintenance': ['plant maintenance', 'maintenance department'],
  Utilities: ['industrial utilities', 'boiler', 'compressor', 'utility plant'],
  'Workshop Operations': ['workshop', 'maintenance workshop']
}

const PRODUCT_FIT_TERMS = {
  'All Product Fits': [],
  'Cutting & Machining Tools': ['machining', 'cnc', 'metal cutting', 'tool room'],
  'Power Tools': ['fabrication', 'workshop', 'maintenance'],
  'Hand Tools': ['maintenance', 'workshop', 'assembly'],
  'Pneumatic Tools': ['pneumatic', 'air tools', 'assembly', 'automotive'],
  Abrasives: ['grinding', 'metal fabrication', 'steel', 'surface finishing'],
  'Valves & Pipe Tools': ['piping', 'valves', 'utilities', 'process plant', 'hvac'],
  'General MRO': ['maintenance', 'mro', 'plant', 'workshop', 'utilities']
}

const BUSINESS_TYPE_TERMS = {
  'All Business Types': [],
  Manufacturer: ['manufacturer', 'manufacturing'],
  Fabricator: ['fabricator', 'fabrication'],
  Processor: ['processor', 'processing'],
  'Factory / Plant': ['factory', 'plant'],
  'Machine Shop': ['machine shop', 'machining', 'cnc'],
  'Industrial Contractor': ['industrial contractor'],
  'EPC Contractor': ['epc contractor', 'engineering procurement construction'],
  'Industrial Services': ['industrial services', 'maintenance services']
}

// Known non-company domains.
// These are hard exclusions because they are not target-company websites.
const BLOCKED_DOMAINS = [
  'pakbusinessworld.com',
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
  'zameen.com',
  'revenuebase.com',
  'dawn.com',
  'tribune.com.pk',
  'thenews.com.pk',
  'brecorder.com',
  'arabnews.com',
  'psx.com.pk',
  'secp.gov.pk',
  'moip.gov.pk',
  'fbr.gov.pk'
]

// These words strongly suggest the page/site is not one company.
const NON_COMPANY_TITLE_SIGNALS = [
  'top companies',
  'top manufacturers',
  'top industrial',
  'list of companies',
  'list of manufacturers',
  'business directory',
  'company directory',
  'industrial directory',
  'supplier directory',
  'manufacturers directory',
  'yellow pages',
  'business listings',
  'company listings',
  'marketplace',
  'classifieds',
  'factories for sale',
  'industrial property',
  'jobs',
  'careers',
  'vacancies',
  'news',
  'latest news',
  'market trends',
  'competitors',
  'startup list',
  'database',
  'ranking',
  'association',
  'chamber of commerce',
  'stock exchange',
  'ministry of',
  'government of pakistan',
  'institute of',
  'university',
  'research journal',
  'portal',
  'lead intelligence',
  'phone and email finder'
]

// These site/body phrases identify a directory or aggregator even if
// the page title itself looks like a company name.
const DIRECTORY_SITE_SIGNALS = [
  'find businesses',
  'find companies',
  'search companies',
  'search businesses',
  'browse companies',
  'browse businesses',
  'business directory',
  'company directory',
  'supplier directory',
  'manufacturers directory',
  'business listings',
  'company listings',
  'add your business',
  'submit your business',
  'claim your business',
  'verified businesses',
  'business categories',
  'browse categories',
  'featured companies',
  'featured businesses',
  'thousands of companies',
  'companies listed',
  'business profiles',
  'company profiles',
  'search by category',
  'search by city'
]

const MEDIA_SITE_SIGNALS = [
  'breaking news',
  'latest news',
  'newsroom',
  'news updates',
  'editorial',
  'opinion',
  'press release',
  'subscribe to newsletter'
]

const ASSOCIATION_SITE_SIGNALS = [
  'our members',
  'member directory',
  'membership',
  'association of',
  'federation of',
  'chamber of commerce',
  'trade association'
]

const GOVERNMENT_SITE_SIGNALS = [
  'government of pakistan',
  'ministry of',
  'public sector',
  'official government',
  'government department'
]

const MARKETPLACE_SIGNALS = [
  'buy now',
  'sell now',
  'add listing',
  'property for sale',
  'factories for sale',
  'marketplace',
  'classified ads'
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
  'utilities'
]

const COMPANY_LEGAL_WORDS = [
  'private limited',
  'pvt ltd',
  'pvt. ltd',
  'limited',
  'ltd',
  'industries',
  'engineering',
  'works',
  'manufacturing',
  'mills',
  'textiles',
  'chemicals',
  'pharmaceuticals',
  'foods',
  'motors',
  'cables',
  'cement',
  'steel'
]

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function lower(value) {
  return clean(value).toLowerCase()
}

function host(url) {
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
  const hostname = host(url)

  return BLOCKED_DOMAINS.some(
    domain =>
      hostname === domain ||
      hostname.endsWith(`.${domain}`)
  )
}

function containsAny(text, signals) {
  const value = lower(text)
  return signals.some(signal => value.includes(signal))
}

function blockedTitle(title) {
  return containsAny(title, NON_COMPANY_TITLE_SIGNALS)
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

function extractTitle(html) {
  const match = String(html || '').match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  )

  return match ? clean(stripHtml(match[1])) : ''
}

function extractDescription(html) {
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

function classifySiteType(title, description, bodyText) {
  const sample = clean(
    `${title}. ${description}. ${bodyText.slice(0, 12000)}`
  )

  let directoryScore = 0
  let mediaScore = 0
  let associationScore = 0
  let governmentScore = 0
  let marketplaceScore = 0

  for (const signal of DIRECTORY_SITE_SIGNALS) {
    if (lower(sample).includes(signal)) directoryScore += 1
  }

  for (const signal of MEDIA_SITE_SIGNALS) {
    if (lower(sample).includes(signal)) mediaScore += 1
  }

  for (const signal of ASSOCIATION_SITE_SIGNALS) {
    if (lower(sample).includes(signal)) associationScore += 1
  }

  for (const signal of GOVERNMENT_SITE_SIGNALS) {
    if (lower(sample).includes(signal)) governmentScore += 1
  }

  for (const signal of MARKETPLACE_SIGNALS) {
    if (lower(sample).includes(signal)) marketplaceScore += 1
  }

  if (directoryScore >= 2) return 'directory'
  if (mediaScore >= 2) return 'media'
  if (associationScore >= 2) return 'association'
  if (governmentScore >= 1) return 'government'
  if (marketplaceScore >= 2) return 'marketplace'

  return 'possible_company'
}

function titleSegments(title) {
  return clean(title)
    .split(/\s+[|–—-]\s+/)
    .map(clean)
    .filter(Boolean)
}

function titleToCompanyName(title, url) {
  const parts = titleSegments(title)

  for (const part of parts) {
    if (
      part.length >= 3 &&
      part.length <= 90 &&
      !blockedTitle(part) &&
      ![
        'home',
        'about',
        'about us',
        'contact',
        'contact us',
        'services',
        'products',
        'welcome'
      ].includes(lower(part))
    ) {
      return part
    }
  }

  const hostname = host(url)

  if (!hostname) return ''

  return hostname
    .split('.')[0]
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(' ')
}

function normalizeIdentity(value) {
  return lower(value)
    .replace(
      /\b(private|pvt|limited|ltd|company|co|corporation|corp|pakistan)\b/g,
      ''
    )
    .replace(/[^a-z0-9]/g, '')
}

function meaningfulTokens(value) {
  return lower(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3)
    .filter(
      token =>
        ![
          'private',
          'limited',
          'company',
          'pakistan',
          'industries',
          'industry',
          'engineering',
          'manufacturing'
        ].includes(token)
    )
}

function identityMatchesDomain(companyName, url) {
  const hostname = host(url)
  if (!hostname) return false

  const domainCore = hostname.split('.')[0]
  const domainNormalized = normalizeIdentity(domainCore)
  const nameNormalized = normalizeIdentity(companyName)

  if (!domainNormalized || !nameNormalized) return false

  // Direct containment is strong evidence.
  if (
    nameNormalized.includes(domainNormalized) ||
    domainNormalized.includes(nameNormalized)
  ) {
    return true
  }

  // Otherwise require at least one meaningful company-name token
  // to appear in the domain.
  const tokens = meaningfulTokens(companyName)

  return tokens.some(token =>
    domainNormalized.includes(token)
  )
}

function hasCompanyLegalSignal(text) {
  return containsAny(text, COMPANY_LEGAL_WORDS)
}

function signalCount(text) {
  const value = lower(text)

  return INDUSTRIAL_WORDS.filter(
    word => value.includes(word)
  ).length
}

function sentences(text) {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map(clean)
    .filter(
      sentence =>
        sentence.length >= 35 &&
        sentence.length <= 420
    )
}

function evidenceFrom(text) {
  const matches = []

  for (const sentence of sentences(text)) {
    if (
      INDUSTRIAL_WORDS.some(
        word => lower(sentence).includes(word)
      )
    ) {
      matches.push(sentence)
    }

    if (matches.length >= 2) break
  }

  return clean(matches.join(' '))
}

function provinceForCity(city) {
  for (
    const [province, cities]
    of Object.entries(PROVINCE_CITIES)
  ) {
    if (
      province !== 'All Pakistan' &&
      cities.map(lower).includes(lower(city))
    ) {
      return province
    }
  }

  return null
}

function detectBusinessType(text, selected) {
  if (
    selected &&
    selected !== 'All Business Types'
  ) {
    return selected
  }

  const value = lower(text)

  if (
    value.includes('cnc') ||
    value.includes('machine shop')
  ) {
    return 'Machine Shop'
  }

  if (
    value.includes('fabrication') ||
    value.includes('fabricator')
  ) {
    return 'Fabricator'
  }

  if (
    value.includes('processing') ||
    value.includes('processor')
  ) {
    return 'Processor'
  }

  if (value.includes('epc contractor')) {
    return 'EPC Contractor'
  }

  if (value.includes('industrial contractor')) {
    return 'Industrial Contractor'
  }

  if (
    value.includes('manufacturer') ||
    value.includes('manufacturing') ||
    value.includes('factory')
  ) {
    return 'Manufacturer'
  }

  return 'Unknown'
}

function relevanceFor(text, identityStrong) {
  const count = signalCount(text)

  if (identityStrong && count >= 4) {
    return 'High'
  }

  if (identityStrong && count >= 2) {
    return 'Medium'
  }

  return 'Low'
}

function evidenceAccepted(
  relevance,
  requestedQuality
) {
  if (
    requestedQuality === 'Any Evidence' ||
    requestedQuality === 'Unknown Allowed'
  ) {
    return true
  }

  if (requestedQuality === 'Confirmed') {
    return relevance === 'High'
  }

  if (requestedQuality === 'Likely') {
    return (
      relevance === 'High' ||
      relevance === 'Medium'
    )
  }

  return true
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 7000
) {
  const controller = new AbortController()

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  )

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
  try {
    const response = await fetchWithTimeout(
      rootUrl(url),
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; TriAxisProspectResearch/0.1.7; +https://tri-axis-platform.vercel.app)'
        },
        cache: 'no-store'
      },
      7000
    )

    if (!response.ok) return null

    const type =
      response.headers.get('content-type') || ''

    if (!type.includes('text/html')) {
      return null
    }

    const html = await response.text()

    return {
      url: response.url || rootUrl(url),
      title: extractTitle(html),
      description: extractDescription(html),
      text: stripHtml(html).slice(0, 30000)
    }
  } catch {
    return null
  }
}

function selectedIndustries(industry) {
  if (
    !industry ||
    industry === 'All Industries'
  ) {
    return INDUSTRIES
  }

  return [industry]
}

function selectedLocations(province, city) {
  if (clean(city)) {
    return [clean(city)]
  }

  return (
    PROVINCE_CITIES[province] ||
    PROVINCE_CITIES['All Pakistan']
  )
}

function extraTerms(map, selection) {
  return map[selection] || []
}

function buildQueries(filters) {
  const industries =
    selectedIndustries(filters.industry)

  const locations =
    selectedLocations(
      filters.province,
      filters.city
    )

  const extra = [
    ...extraTerms(
      BUSINESS_TYPE_TERMS,
      filters.businessType
    ),
    ...extraTerms(
      ACTIVITY_TERMS,
      filters.activity
    ),
    ...extraTerms(
      PRODUCT_FIT_TERMS,
      filters.productFit
    ),
    clean(filters.query)
  ]
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')

  const negativeTerms =
    '-directory -portal -news -jobs -marketplace -association'

  const queries = []

  for (const industry of industries) {
    for (const location of locations) {
      queries.push(
        `${industry} manufacturer company ${location} Pakistan official website ${extra} ${negativeTerms}`.trim()
      )

      queries.push(
        `${industry} factory plant ${location} Pakistan official company ${extra} ${negativeTerms}`.trim()
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
    const data = JSON.parse(text)

    return Array.isArray(data.results)
      ? data.results
      : []
  } catch {
    throw new Error(
      'Tavily returned a non-JSON response.'
    )
  }
}

function rawResultAllowed(result) {
  const title = clean(result?.title)
  const url = clean(result?.url)

  if (!title || !url) return false

  if (!/^https?:\/\//i.test(url)) {
    return false
  }

  if (blockedDomain(url)) return false
  if (blockedTitle(title)) return false

  return true
}

async function convertToCompany(
  result,
  filters,
  searchedCity
) {
  const inspected =
    await inspectWebsite(result.url)

  // If we cannot inspect the root website, this version rejects the result.
  // This is intentional. We want company records, not search snippets.
  if (!inspected) return null

  const website = inspected.url
  const pageTitle = inspected.title
  const description = inspected.description
  const pageText = inspected.text

  // Reject the entire site if it behaves like a directory,
  // media outlet, association, government site or marketplace.
  const siteType = classifySiteType(
    pageTitle,
    description,
    pageText
  )

  if (siteType !== 'possible_company') {
    return null
  }

  if (blockedDomain(website)) return null
  if (blockedTitle(pageTitle)) return null

  const companyName =
    titleToCompanyName(pageTitle, website)

  if (
    !companyName ||
    blockedTitle(companyName)
  ) {
    return null
  }

  const combined = clean(
    `${pageTitle}. ${description}. ${pageText}`
  )

  // A company name should normally have some relationship with
  // its own domain OR the page needs a strong legal/company signal.
  const domainMatch =
    identityMatchesDomain(
      companyName,
      website
    )

  const legalSignal =
    hasCompanyLegalSignal(
      `${pageTitle}. ${description}`
    )

  if (!domainMatch && !legalSignal) {
    return null
  }

  const evidence = evidenceFrom(
    `${description}. ${pageText}`
  )

  if (!evidence) return null

  const industrialSignals =
    signalCount(combined)

  // Require multiple industrial signals.
  if (industrialSignals < 2) {
    return null
  }

  const identityStrong =
    domainMatch || legalSignal

  const relevance =
    relevanceFor(
      combined,
      identityStrong
    )

  if (
    !evidenceAccepted(
      relevance,
      filters.evidenceQuality
    )
  ) {
    return null
  }

  const city =
    clean(searchedCity) || 'Unknown'

  return {
    company_name: companyName,
    website: website,
    industry:
      filters.industry === 'All Industries'
        ? (
            result._queryIndustry ||
            'Industrial'
          )
        : filters.industry,
    business_type:
      detectBusinessType(
        combined,
        filters.businessType
      ),
    city,
    province:
      filters.province !== 'All Pakistan'
        ? filters.province
        : provinceForCity(city),
    country: 'Pakistan',
    description:
      description ||
      sentences(pageText)[0] ||
      'Unknown',
    factory_evidence: evidence,
    industrial_relevance: relevance,
    source_url: result.url || website,
    source_type:
      'Validated company website',
    status: 'Discovered',
    last_checked:
      new Date().toISOString()
  }
}

function normalizedCompanyKey(name) {
  return lower(name)
    .replace(
      /\b(private|pvt|limited|ltd|company|co|pakistan)\b/g,
      ''
    )
    .replace(/[^a-z0-9]/g, '')
}

export async function POST(request) {
  try {
    const apiKey =
      process.env.TAVILY_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'TAVILY_API_KEY is missing in Vercel.'
        },
        { status: 500 }
      )
    }

    const body = await request.json()

    const filters = {
      industry:
        clean(body?.industry) ||
        'All Industries',

      businessType:
        clean(body?.businessType) ||
        'All Business Types',

      province:
        clean(body?.province) ||
        'All Pakistan',

      city:
        clean(body?.city),

      activity:
        clean(body?.activity) ||
        'All Activities',

      productFit:
        clean(body?.productFit) ||
        'All Product Fits',

      evidenceQuality:
        clean(body?.evidenceQuality) ||
        'Any Evidence',

      resultsPerBatch:
        Math.min(
          Math.max(
            Number(body?.resultsPerBatch) ||
              50,
            10
          ),
          100
        ),

      query:
        clean(body?.query)
    }

    const queries =
      buildQueries(filters)

    const queryCap =
      filters.resultsPerBatch >= 100
        ? 24
        : filters.resultsPerBatch >= 50
          ? 16
          : 10

    const queryBatch =
      queries.slice(0, queryCap)

    const rawResults = []

    for (const query of queryBatch) {
      const queryIndustry =
        INDUSTRIES.find(
          industry =>
            lower(query).startsWith(
              lower(industry)
            )
        ) || filters.industry

      const queryCity =
        Object.values(PROVINCE_CITIES)
          .flat()
          .find(
            city =>
              lower(query).includes(
                lower(city)
              )
          ) ||
        filters.city ||
        'Unknown'

      const results =
        await tavily(apiKey, query)

      for (const result of results) {
        if (rawResultAllowed(result)) {
          rawResults.push({
            ...result,
            _queryIndustry:
              queryIndustry,
            _queryCity:
              queryCity
          })
        }
      }
    }

    // Dedupe by root domain before expensive inspection.
    const uniqueRaw = []
    const seenDomains = new Set()

    for (const result of rawResults) {
      const hostname =
        host(result.url)

      if (
        !hostname ||
        seenDomains.has(hostname)
      ) {
        continue
      }

      seenDomains.add(hostname)
      uniqueRaw.push(result)
    }

    const candidates = []

    const inspectionCap =
      Math.min(
        Math.max(
          filters.resultsPerBatch * 2,
          50
        ),
        120
      )

    let rejectedNonCompanySites = 0

    for (
      const result
      of uniqueRaw.slice(0, inspectionCap)
    ) {
      const beforeCount =
        candidates.length

      const candidate =
        await convertToCompany(
          result,
          filters,
          result._queryCity
        )

      if (candidate) {
        candidates.push(candidate)
      } else if (
        candidates.length === beforeCount
      ) {
        rejectedNonCompanySites += 1
      }

      if (
        candidates.length >=
        filters.resultsPerBatch
      ) {
        break
      }
    }

    // Final identity deduplication.
    const final = []
    const seenNames = new Set()
    const seenCandidateDomains = new Set()

    for (const candidate of candidates) {
      const nameKey =
        normalizedCompanyKey(
          candidate.company_name
        )

      const domainKey =
        host(candidate.website)

      if (
        nameKey &&
        seenNames.has(nameKey)
      ) {
        continue
      }

      if (
        domainKey &&
        seenCandidateDomains.has(
          domainKey
        )
      ) {
        continue
      }

      if (nameKey) {
        seenNames.add(nameKey)
      }

      if (domainKey) {
        seenCandidateDomains.add(
          domainKey
        )
      }

      final.push(candidate)
    }

    return NextResponse.json({
      candidates: final,

      meta: {
        version: '0.1.7',

        scope:
          filters.city ||
          filters.province ||
          'All Pakistan',

        query_count:
          queryBatch.length,

        raw_domains:
          uniqueRaw.length,

        pages_inspected:
          Math.min(
            uniqueRaw.length,
            inspectionCap
          ),

        rejected_non_company_sites:
          rejectedNonCompanySites,

        candidates_returned:
          final.length,

        requested_batch_size:
          filters.resultsPerBatch
      }
    })
  } catch (error) {
    console.error(
      'Tri Axis discovery error:',
      error
    )

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
