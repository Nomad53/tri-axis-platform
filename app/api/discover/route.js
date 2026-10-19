// TRI AXIS v0.1.6
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/api/discover/route.js

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TAVILY_URL = 'https://api.tavily.com/search'

const INDUSTRIES = [
  'Automotive','Cement','Chemicals','Electrical & Cables','Engineering & Fabrication',
  'Food & Beverage','HVAC','Oil & Gas','Packaging','Pharmaceuticals','Plastics',
  'Power & Energy','Steel & Metals','Textile'
]

const PROVINCE_CITIES = {
  'All Pakistan':['Karachi','Lahore','Faisalabad','Gujranwala','Sialkot','Rawalpindi','Islamabad','Multan','Hyderabad','Hub','Sheikhupura','Kasur'],
  Sindh:['Karachi','Hyderabad'],
  Punjab:['Lahore','Faisalabad','Gujranwala','Sialkot','Rawalpindi','Multan','Sheikhupura','Kasur'],
  'Khyber Pakhtunkhwa':['Peshawar','Nowshera','Hattar'],
  Balochistan:['Hub','Quetta'],
  'Islamabad Capital Territory':['Islamabad']
}

const ACTIVITY_TERMS = {
  'All Activities':[],
  Manufacturing:['manufacturer','manufacturing','factory','production plant'],
  Fabrication:['fabrication','fabricator','structural steel'],
  'Machining / CNC':['machining','CNC','machine shop'],
  Processing:['processing','production line'],
  Assembly:['assembly','assembly plant'],
  'Plant Maintenance':['plant maintenance','maintenance department'],
  Utilities:['industrial utilities','boiler','compressor','utility plant'],
  'Workshop Operations':['workshop','maintenance workshop']
}

const PRODUCT_FIT_TERMS = {
  'All Product Fits':[],
  'Cutting & Machining Tools':['machining','CNC','metal cutting','tool room'],
  'Power Tools':['fabrication','workshop','maintenance'],
  'Hand Tools':['maintenance','workshop','assembly'],
  'Pneumatic Tools':['pneumatic','air tools','assembly','automotive'],
  Abrasives:['grinding','metal fabrication','steel','surface finishing'],
  'Valves & Pipe Tools':['piping','valves','utilities','process plant','HVAC'],
  'General MRO':['maintenance','MRO','plant','workshop','utilities']
}

const BUSINESS_TYPE_TERMS = {
  'All Business Types':[],
  Manufacturer:['manufacturer','manufacturing'],
  Fabricator:['fabricator','fabrication'],
  Processor:['processor','processing'],
  'Factory / Plant':['factory','plant'],
  'Machine Shop':['machine shop','machining','CNC'],
  'Industrial Contractor':['industrial contractor'],
  'EPC Contractor':['EPC contractor','engineering procurement construction'],
  'Industrial Services':['industrial services','maintenance services']
}

const BLOCKED_DOMAINS = [
  'linkedin.com','facebook.com','instagram.com','x.com','twitter.com','youtube.com',
  'indeed.com','glassdoor.com','rozee.pk','mustakbil.com','jobz.pk','bayt.com',
  'wikipedia.org','scribd.com','slideshare.net','researchgate.net','lookup.pk',
  'businesslist.pk','zameen.com','revenuebase.com'
]

const BLOCKED_TITLE_WORDS = [
  'top companies','top manufacturing','top industrial','list of','directory','jobs',
  'careers','vacancy','salary','market trends','competitors','startup list','database',
  'ranking','factories for sale','industrial property','lead intelligence','phone and email finder'
]

const INDUSTRIAL_WORDS = [
  'manufacturing','manufacturer','factory','plant','production','fabrication',
  'fabricator','machining','cnc','workshop','engineering','industrial','assembly',
  'processing','mill','foundry','forging','casting','steel','metalworking','maintenance','utilities'
]

function clean(v){ return String(v||'').replace(/\s+/g,' ').trim() }
function lower(v){ return clean(v).toLowerCase() }
function host(url){ try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''} }
function rootUrl(url){ try{const p=new URL(url); return `${p.protocol}//${p.hostname}/`}catch{return url} }
function blockedDomain(url){ const h=host(url); return BLOCKED_DOMAINS.some(d=>h===d||h.endsWith(`.${d}`)) }
function blockedTitle(title){ const v=lower(title); return BLOCKED_TITLE_WORDS.some(w=>v.includes(w)) }

function stripHtml(html){
  return clean(String(html||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ')
    .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'"))
}

function extractTitle(html){
  const m=String(html||'').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? clean(stripHtml(m[1])) : ''
}

function extractDescription(html){
  const text=String(html||'')
  const patterns=[
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i
  ]
  for(const p of patterns){ const m=text.match(p); if(m) return clean(m[1]) }
  return ''
}

function titleToCompanyName(title,url){
  const parts=clean(title).split(/\s+[|–—-]\s+/).map(clean).filter(Boolean)
  for(const part of parts){
    if(part.length>=3 && part.length<=90 && !blockedTitle(part) && !['home','about us','contact us','services','products'].includes(lower(part))) return part
  }
  const h=host(url); if(!h) return ''
  return h.split('.')[0].replace(/[-_]+/g,' ').split(' ').filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
}

function signalCount(text){ const v=lower(text); return INDUSTRIAL_WORDS.filter(w=>v.includes(w)).length }
function sentences(text){ return clean(text).split(/(?<=[.!?])\s+/).map(clean).filter(s=>s.length>=35&&s.length<=420) }

function evidenceFrom(text){
  const matches=[]
  for(const s of sentences(text)){
    if(INDUSTRIAL_WORDS.some(w=>lower(s).includes(w))) matches.push(s)
    if(matches.length>=2) break
  }
  return clean(matches.join(' '))
}

function provinceForCity(city){
  for(const [province,cities] of Object.entries(PROVINCE_CITIES)){
    if(province!=='All Pakistan' && cities.map(lower).includes(lower(city))) return province
  }
  return null
}

function detectBusinessType(text,selected){
  if(selected && selected!=='All Business Types') return selected
  const v=lower(text)
  if(v.includes('cnc')||v.includes('machine shop')) return 'Machine Shop'
  if(v.includes('fabrication')||v.includes('fabricator')) return 'Fabricator'
  if(v.includes('processing')||v.includes('processor')) return 'Processor'
  if(v.includes('epc contractor')) return 'EPC Contractor'
  if(v.includes('industrial contractor')) return 'Industrial Contractor'
  if(v.includes('manufacturer')||v.includes('manufacturing')||v.includes('factory')) return 'Manufacturer'
  return 'Unknown'
}

function relevanceFor(text,official){
  const c=signalCount(text)
  if(official && c>=4) return 'High'
  if(c>=2) return 'Medium'
  return 'Low'
}

function evidenceAccepted(relevance,quality){
  if(quality==='Any Evidence'||quality==='Unknown Allowed') return true
  if(quality==='Confirmed') return relevance==='High'
  if(quality==='Likely') return relevance==='High'||relevance==='Medium'
  return true
}

async function fetchWithTimeout(url,options={},timeoutMs=7000){
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),timeoutMs)
  try{return await fetch(url,{...options,signal:controller.signal,redirect:'follow'})}
  finally{clearTimeout(timer)}
}

async function inspectWebsite(url){
  try{
    const response=await fetchWithTimeout(rootUrl(url),{
      headers:{'User-Agent':'Mozilla/5.0 (compatible; TriAxisProspectResearch/0.1.6; +https://tri-axis-platform.vercel.app)'},
      cache:'no-store'
    },7000)
    if(!response.ok) return null
    const type=response.headers.get('content-type')||''
    if(!type.includes('text/html')) return null
    const html=await response.text()
    return {url:response.url||rootUrl(url),title:extractTitle(html),description:extractDescription(html),text:stripHtml(html).slice(0,30000)}
  }catch{return null}
}

function selectedIndustries(industry){ return !industry||industry==='All Industries' ? INDUSTRIES : [industry] }
function selectedLocations(province,city){ return clean(city) ? [clean(city)] : (PROVINCE_CITIES[province] || PROVINCE_CITIES['All Pakistan']) }
function extraTerms(map,selection){ return map[selection] || [] }

function buildQueries(filters){
  const industries=selectedIndustries(filters.industry)
  const locations=selectedLocations(filters.province,filters.city)
  const extra=[...extraTerms(BUSINESS_TYPE_TERMS,filters.businessType),...extraTerms(ACTIVITY_TERMS,filters.activity),...extraTerms(PRODUCT_FIT_TERMS,filters.productFit),clean(filters.query)].filter(Boolean).slice(0,4).join(' ')
  const queries=[]
  for(const industry of industries){
    for(const location of locations){
      queries.push(`${industry} company ${location} Pakistan manufacturer factory ${extra}`.trim())
      queries.push(`${industry} industrial ${location} Pakistan official website ${extra}`.trim())
    }
  }
  return [...new Set(queries)]
}

async function tavily(apiKey,query){
  const response=await fetchWithTimeout(TAVILY_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({api_key:apiKey,query,search_depth:'advanced',max_results:20,include_answer:false,include_raw_content:false,include_images:false}),
    cache:'no-store'
  },15000)
  const text=await response.text()
  if(!response.ok) throw new Error(`Tavily search failed (${response.status}): ${text.slice(0,300)}`)
  try{ const data=JSON.parse(text); return Array.isArray(data.results)?data.results:[] }
  catch{ throw new Error('Tavily returned a non-JSON response.') }
}

function rawResultAllowed(result){
  const title=clean(result?.title), url=clean(result?.url)
  if(!title||!url) return false
  if(!/^https?:\/\//i.test(url)) return false
  if(blockedDomain(url)) return false
  if(blockedTitle(title)) return false
  return true
}

async function convertToCompany(result,filters,searchedCity){
  const inspected=await inspectWebsite(result.url)
  const website=inspected?.url || rootUrl(result.url)
  const pageTitle=inspected?.title || result.title || ''
  const snippet=clean(result.content)
  const description=inspected?.description || ''
  const pageText=inspected?.text || ''
  const combined=clean(`${pageTitle}. ${description}. ${pageText}. ${snippet}`)
  const companyName=titleToCompanyName(pageTitle,website)
  if(!companyName||blockedTitle(companyName)) return null
  const evidence=evidenceFrom(`${description}. ${pageText}. ${snippet}`)
  if(!evidence) return null
  const relevance=relevanceFor(combined,Boolean(inspected))
  if(!evidenceAccepted(relevance,filters.evidenceQuality)) return null
  const city=clean(searchedCity)||'Unknown'
  return {
    company_name:companyName,
    website:website||null,
    industry:filters.industry==='All Industries' ? (result._queryIndustry||'Industrial') : filters.industry,
    business_type:detectBusinessType(combined,filters.businessType),
    city,
    province:filters.province!=='All Pakistan' ? filters.province : provinceForCity(city),
    country:'Pakistan',
    description:description || sentences(pageText)[0] || snippet.slice(0,320) || 'Unknown',
    factory_evidence:evidence,
    industrial_relevance:relevance,
    source_url:result.url||website||null,
    source_type:inspected ? 'Official/primary website candidate' : 'Web search result',
    status:'Discovered',
    last_checked:new Date().toISOString()
  }
}

function normalizedCompanyKey(name){ return lower(name).replace(/\b(private|pvt|limited|ltd|company|co|pakistan)\b/g,'').replace(/[^a-z0-9]/g,'') }

export async function POST(request){
  try{
    const apiKey=process.env.TAVILY_API_KEY
    if(!apiKey) return NextResponse.json({error:'TAVILY_API_KEY is missing in Vercel.'},{status:500})

    const body=await request.json()
    const filters={
      industry:clean(body?.industry)||'All Industries',
      businessType:clean(body?.businessType)||'All Business Types',
      province:clean(body?.province)||'All Pakistan',
      city:clean(body?.city),
      activity:clean(body?.activity)||'All Activities',
      productFit:clean(body?.productFit)||'All Product Fits',
      evidenceQuality:clean(body?.evidenceQuality)||'Any Evidence',
      resultsPerBatch:Math.min(Math.max(Number(body?.resultsPerBatch)||50,10),100),
      query:clean(body?.query)
    }

    const queries=buildQueries(filters)
    const queryCap=filters.resultsPerBatch>=100 ? 24 : filters.resultsPerBatch>=50 ? 16 : 10
    const queryBatch=queries.slice(0,queryCap)
    const rawResults=[]

    for(const query of queryBatch){
      const queryIndustry=INDUSTRIES.find(i=>lower(query).startsWith(lower(i))) || filters.industry
      const queryCity=Object.values(PROVINCE_CITIES).flat().find(c=>lower(query).includes(lower(c))) || filters.city || 'Unknown'
      const results=await tavily(apiKey,query)
      for(const result of results){
        if(rawResultAllowed(result)) rawResults.push({...result,_queryIndustry:queryIndustry,_queryCity:queryCity})
      }
    }

    const uniqueRaw=[], seenDomains=new Set()
    for(const result of rawResults){
      const h=host(result.url)
      if(!h||seenDomains.has(h)) continue
      seenDomains.add(h); uniqueRaw.push(result)
    }

    const candidates=[]
    const inspectionCap=Math.min(Math.max(filters.resultsPerBatch*2,50),120)

    for(const result of uniqueRaw.slice(0,inspectionCap)){
      const candidate=await convertToCompany(result,filters,result._queryCity)
      if(candidate) candidates.push(candidate)
      if(candidates.length>=filters.resultsPerBatch) break
    }

    const final=[], seenNames=new Set(), seenCandidateDomains=new Set()
    for(const candidate of candidates){
      const nk=normalizedCompanyKey(candidate.company_name), dk=host(candidate.website)
      if(nk&&seenNames.has(nk)) continue
      if(dk&&seenCandidateDomains.has(dk)) continue
      if(nk) seenNames.add(nk)
      if(dk) seenCandidateDomains.add(dk)
      final.push(candidate)
    }

    return NextResponse.json({
      candidates:final,
      meta:{
        version:'0.1.6',
        scope:filters.city || filters.province || 'All Pakistan',
        query_count:queryBatch.length,
        raw_domains:uniqueRaw.length,
        pages_inspected:Math.min(uniqueRaw.length,inspectionCap),
        candidates_returned:final.length,
        requested_batch_size:filters.resultsPerBatch
      }
    })
  }catch(error){
    console.error('Tri Axis discovery error:',error)
    return NextResponse.json({error:error instanceof Error ? error.message : 'Unknown discovery error.'},{status:500})
  }
}
