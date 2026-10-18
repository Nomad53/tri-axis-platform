'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const industries = ['All Industries','Automotive','Cement','Engineering & Fabrication','Food & Beverage','Pharmaceuticals','Power & Energy','Steel & Metals','Textile']

export default function DiscoverPage() {
  const [rows, setRows] = useState([])
  const [industry, setIndustry] = useState('All Industries')
  const [city, setCity] = useState('')
  const [relevance, setRelevance] = useState('All')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/prospects').then(r => r.json()).then(setRows)
  }, [])

  const filtered = useMemo(() => rows.filter(p => {
    if (industry !== 'All Industries' && p.industry !== industry) return false
    if (city && !p.city.toLowerCase().includes(city.toLowerCase())) return false
    if (relevance !== 'All' && p.relevance !== relevance) return false
    if (query && !`${p.name} ${p.industry} ${p.city} ${p.summary}`.toLowerCase().includes(query.toLowerCase())) return false
    return true
  }), [rows, industry, city, relevance, query])

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">TRI AXIS</div><div className="brandSub">Supply Company</div>
        <nav><Link className="navItem" href="/">Dashboard</Link><Link className="navItem active" href="/discover">Discover</Link></nav>
        <div className="version">v0.1 · Industrial Prospect Intelligence</div>
      </aside>

      <section className="content">
        <div className="eyebrow">DISCOVERY WORKSPACE</div>
        <h1>Discover Companies</h1>
        <p className="lead">Review, filter and validate industrial prospects before any contact intelligence is added.</p>

        <div className="filters">
          <label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Company, sector, activity..." /></label>
          <label>Industry<select value={industry} onChange={e=>setIndustry(e.target.value)}>{industries.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>City<input value={city} onChange={e=>setCity(e.target.value)} placeholder="Karachi" /></label>
          <label>Relevance<select value={relevance} onChange={e=>setRelevance(e.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></label>
        </div>

        <div className="sectionHeader"><h2>{filtered.length} prospects</h2><span>Evidence-first · Unknown is allowed</span></div>

        <div className="cards">
          {filtered.map(p => <article className="prospectCard" key={p.id}>
            <div className="cardTop"><div><h3>{p.name}</h3><div className="muted">{p.industry} · {p.city}, {p.province}</div></div><span className={`pill ${p.relevance.toLowerCase()}`}>{p.relevance}</span></div>
            <p>{p.summary}</p>
            <div className="evidence"><strong>Industrial evidence</strong><span>{p.evidence}</span></div>
            <div className="metaGrid">
              <div><small>Business type</small><b>{p.businessType}</b></div>
              <div><small>Website</small><b>{p.website || 'Unknown'}</b></div>
              <div><small>Status</small><b>{p.status}</b></div>
              <div><small>Last checked</small><b>{p.lastChecked}</b></div>
            </div>
          </article>)}
        </div>
      </section>
    </main>
  )
}
