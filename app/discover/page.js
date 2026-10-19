'use client'

// TRI AXIS v0.1.6
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/discover/page.js

import { useEffect, useMemo, useState } from 'react'

const industries = ['All Industries','Automotive','Cement','Chemicals','Electrical & Cables','Engineering & Fabrication','Food & Beverage','HVAC','Oil & Gas','Packaging','Pharmaceuticals','Plastics','Power & Energy','Steel & Metals','Textile']
const businessTypes = ['All Business Types','Manufacturer','Fabricator','Processor','Factory / Plant','Machine Shop','Industrial Contractor','EPC Contractor','Industrial Services']
const provinces = ['All Pakistan','Sindh','Punjab','Khyber Pakhtunkhwa','Balochistan','Islamabad Capital Territory']
const activities = ['All Activities','Manufacturing','Fabrication','Machining / CNC','Processing','Assembly','Plant Maintenance','Utilities','Workshop Operations']
const productFits = ['All Product Fits','Cutting & Machining Tools','Power Tools','Hand Tools','Pneumatic Tools','Abrasives','Valves & Pipe Tools','General MRO']
const evidenceLevels = ['Any Evidence','Confirmed','Likely','Unknown Allowed']
const batchSizes = [25,50,100]

export default function DiscoverPage() {
  const [saved,setSaved] = useState([])
  const [industry,setIndustry] = useState('All Industries')
  const [businessType,setBusinessType] = useState('All Business Types')
  const [province,setProvince] = useState('All Pakistan')
  const [city,setCity] = useState('')
  const [activity,setActivity] = useState('All Activities')
  const [productFit,setProductFit] = useState('All Product Fits')
  const [evidenceQuality,setEvidenceQuality] = useState('Any Evidence')
  const [relevance,setRelevance] = useState('All')
  const [resultsPerBatch,setResultsPerBatch] = useState(50)
  const [query,setQuery] = useState('')
  const [loadingSaved,setLoadingSaved] = useState(true)
  const [discovering,setDiscovering] = useState(false)
  const [error,setError] = useState('')
  const [candidates,setCandidates] = useState([])
  const [meta,setMeta] = useState(null)
  const [savingKey,setSavingKey] = useState('')

  useEffect(()=>{ loadSaved() },[])

  async function readJson(response){
    const text = await response.text()
    try { return JSON.parse(text) }
    catch { throw new Error(`Server returned a non-JSON response (${response.status}).`) }
  }

  async function loadSaved(){
    try{
      setLoadingSaved(true); setError('')
      const response = await fetch('/api/prospects',{cache:'no-store'})
      const data = await readJson(response)
      if(!response.ok) throw new Error(data?.error || 'Could not load saved prospects.')
      setSaved(Array.isArray(data) ? data : [])
    }catch(err){ setError(err.message || 'Could not load saved prospects.') }
    finally{ setLoadingSaved(false) }
  }

  function resetFilters(){
    setIndustry('All Industries')
    setBusinessType('All Business Types')
    setProvince('All Pakistan')
    setCity('')
    setActivity('All Activities')
    setProductFit('All Product Fits')
    setEvidenceQuality('Any Evidence')
    setRelevance('All')
    setResultsPerBatch(50)
    setQuery('')
    setCandidates([])
    setMeta(null)
    setError('')
  }

  async function findCompanies(){
    try{
      setDiscovering(true); setError(''); setCandidates([]); setMeta(null)
      const response = await fetch('/api/discover',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({industry,businessType,province,city,activity,productFit,evidenceQuality,resultsPerBatch,query})
      })
      const data = await readJson(response)
      if(!response.ok) throw new Error(data?.error || 'Discovery failed.')
      setCandidates(Array.isArray(data?.candidates) ? data.candidates : [])
      setMeta(data?.meta || null)
    }catch(err){ setError(err.message || 'Discovery failed.') }
    finally{ setDiscovering(false) }
  }

  async function saveProspect(candidate){
    const key = candidate.website || candidate.source_url || candidate.company_name
    try{
      setSavingKey(key); setError('')
      const response = await fetch('/api/prospects',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(candidate)
      })
      const data = await readJson(response)
      if(!response.ok) throw new Error(data?.error || 'Could not save prospect.')
      await loadSaved()
    }catch(err){ setError(err.message || 'Could not save prospect.') }
    finally{ setSavingKey('') }
  }

  const filteredSaved = useMemo(()=> saved.filter(row=>{
    if(industry !== 'All Industries' && norm(row.industry) !== norm(industry)) return false
    if(city && !norm(row.city).includes(norm(city))) return false
    if(province !== 'All Pakistan' && norm(row.province) !== norm(province)) return false
    if(relevance !== 'All' && norm(row.industrial_relevance) !== norm(relevance)) return false
    return true
  }),[saved,industry,city,province,relevance])

  return <main className="page-shell">
    <section className="page-header">
      <p className="eyebrow">DISCOVERY WORKSPACE</p>
      <h1>Discover Companies</h1>
      <p className="subtitle">Search by industry, business type, geography, activity and likely product fit. Leave City blank to search across the selected province or all Pakistan.</p>
    </section>

    <section className="filter-panel">
      <div className="filter-grid">
        <SelectField label="Industry" value={industry} setValue={setIndustry} options={industries}/>
        <SelectField label="Business Type" value={businessType} setValue={setBusinessType} options={businessTypes}/>
        <SelectField label="Province / Scope" value={province} setValue={setProvince} options={provinces}/>
        <div className="field"><label>City</label><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Blank = use scope above"/></div>
        <SelectField label="Industrial Activity" value={activity} setValue={setActivity} options={activities}/>
        <SelectField label="Likely Product Fit" value={productFit} setValue={setProductFit} options={productFits}/>
        <SelectField label="Evidence Quality" value={evidenceQuality} setValue={setEvidenceQuality} options={evidenceLevels}/>
        <SelectField label="Results Per Batch" value={resultsPerBatch} setValue={v=>setResultsPerBatch(Number(v))} options={batchSizes}/>
        <div className="field"><label>Optional Search Detail</label><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. CNC, stainless steel, shutdown maintenance..."/></div>
        <div className="field"><label>Saved Relevance Filter</label><select value={relevance} onChange={e=>setRelevance(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></div>
      </div>
      <div className="discover-actions" style={{gap:10}}>
        <button className="primary-button" type="button" onClick={resetFilters} style={{background:'#1a222b',color:'#f4f6f8',border:'1px solid #2c3946'}}>Reset Filters</button>
        <button className="primary-button" onClick={findCompanies} disabled={discovering}>{discovering ? 'Researching...' : 'Search Companies'}</button>
      </div>
    </section>

    {error ? <section className="error-box">{error}</section> : null}

    <section className="candidate-section">
      <div className="section-heading">
        <div><p className="eyebrow">LIVE COMPANY CANDIDATES</p><h2>{discovering ? 'Researching...' : `${candidates.length} companies`}</h2></div>
        <p className="muted">{meta ? `${meta.scope || 'Pakistan'} · ${meta.pages_inspected || 0} pages inspected` : 'Nothing is saved automatically.'}</p>
      </div>
      {!discovering && meta && candidates.length===0 ? <div className="empty-state">No company passed the current evidence rules in this batch.</div> : null}
      {candidates.length>0 ? <ProspectTable rows={candidates} candidateMode savingKey={savingKey} onSave={saveProspect}/> : null}
    </section>

    <section className="saved-section">
      <div className="section-heading">
        <div><p className="eyebrow">SAVED PROSPECTS</p><h2>{loadingSaved ? 'Loading...' : `${filteredSaved.length} prospects`}</h2></div>
        <p className="muted">Already stored in Supabase.</p>
      </div>
      {!loadingSaved && filteredSaved.length===0 ? <div className="empty-state">No saved prospects match the current filters.</div> : null}
      {filteredSaved.length>0 ? <ProspectTable rows={filteredSaved}/> : null}
    </section>
  </main>
}

function SelectField({label,value,setValue,options}){
  return <div className="field"><label>{label}</label><select value={value} onChange={e=>setValue(e.target.value)}>{options.map(item=><option key={item} value={item}>{item}</option>)}</select></div>
}

function ProspectTable({rows,candidateMode=false,savingKey='',onSave}){
  return <div className="table-wrap"><table className="prospect-data-table">
    <thead><tr>
      <th>Company Name</th><th>Website</th><th>Industry</th><th>Business Type</th><th>City</th><th>Province</th><th>Country</th><th>Description</th><th>Factory Evidence</th><th>Relevance</th><th>Source URL</th><th>Source Type</th><th>Status</th><th>Last Checked</th>{candidateMode ? <th>Action</th> : null}
    </tr></thead>
    <tbody>{rows.map((row,index)=>{
      const key = row.id || row.website || row.source_url || `${row.company_name}-${index}`
      const saveKey = row.website || row.source_url || row.company_name
      return <tr key={key}>
        <td className="company-cell"><strong>{val(row.company_name)}</strong></td>
        <td>{row.website ? <a href={row.website} target="_blank" rel="noreferrer">Open</a> : 'Unknown'}</td>
        <td>{val(row.industry)}</td><td>{val(row.business_type)}</td><td>{val(row.city)}</td><td>{val(row.province)}</td><td>{val(row.country)}</td>
        <td className="long-cell" title={val(row.description)}>{truncate(row.description,120)}</td>
        <td className="long-cell" title={val(row.factory_evidence)}>{truncate(row.factory_evidence,140)}</td>
        <td><span className={`badge ${badgeClass(row.industrial_relevance)}`}>{val(row.industrial_relevance)}</span></td>
        <td>{row.source_url ? <a href={row.source_url} target="_blank" rel="noreferrer">Source</a> : 'Unknown'}</td>
        <td>{val(row.source_type)}</td><td>{val(row.status)}</td><td>{formatDate(row.last_checked)}</td>
        {candidateMode ? <td><button className="table-action-button" onClick={()=>onSave(row)} disabled={savingKey===saveKey}>{savingKey===saveKey ? 'Saving...' : 'Save'}</button></td> : null}
      </tr>
    })}</tbody>
  </table></div>
}

function val(input){ const t=String(input||'').trim(); return t || 'Unknown' }
function norm(input){ return String(input||'').trim().toLowerCase() }
function truncate(input,limit){ const t=val(input); return t==='Unknown'||t.length<=limit ? t : `${t.slice(0,limit)}…` }
function badgeClass(input){ const t=norm(input); if(t==='high') return 'high'; if(t==='medium') return 'medium'; if(t==='low') return 'low'; return 'medium' }
function formatDate(input){ if(!input) return 'Unknown'; const d=new Date(input); return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString() }
