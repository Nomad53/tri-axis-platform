'use client'

import { useEffect, useMemo, useState } from 'react'

const industries = [
  'All Industries',
  'Automotive',
  'Cement',
  'Engineering & Fabrication',
  'Food & Beverage',
  'Pharmaceuticals',
  'Steel & Metals',
  'Textile',
  'Power & Energy',
  'Chemicals',
  'Packaging'
]

export default function DiscoverPage() {
  const [rows, setRows] = useState([])
  const [industry, setIndustry] = useState('All Industries')
  const [city, setCity] = useState('')
  const [relevance, setRelevance] = useState('All')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState([])
  const [savingUrl, setSavingUrl] = useState('')

  async function loadProspects() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/prospects', {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error('Could not load prospects')
      }

      const data = await response.json()
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not load prospects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProspects()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      if (
        industry !== 'All Industries' &&
        (p.industry || '').toLowerCase() !== industry.toLowerCase()
      ) {
        return false
      }

      if (
        city &&
        !(p.city || '').toLowerCase().includes(city.toLowerCase())
      ) {
        return false
      }

      if (
        relevance !== 'All' &&
        (p.industrial_relevance || '').toLowerCase() !== relevance.toLowerCase()
      ) {
        return false
      }

      if (query) {
        const searchable = [
          p.company_name,
          p.industry,
          p.business_type,
          p.city,
          p.province,
          p.description,
          p.factory_evidence
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!searchable.includes(query.toLowerCase())) {
          return false
        }
      }

      return true
    })
  }, [rows, industry, city, relevance, query])

  async function findCompanies() {
    try {
      setDiscovering(true)
      setError('')
      setCandidates([])

      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          industry:
            industry === 'All Industries' ? '' : industry,
          city: city || 'Karachi',
          query
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Discovery failed')
      }

      setCandidates(Array.isArray(data?.candidates) ? data.candidates : [])
    } catch (err) {
      setError(err.message || 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  async function saveCandidate(candidate) {
    try {
      setSavingUrl(candidate.source_url || candidate.company_name)
      setError('')

      const response = await fetch('/api/prospects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(candidate)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Could not save prospect')
      }

      await loadProspects()
    } catch (err) {
      setError(err.message || 'Could not save prospect')
    } finally {
      setSavingUrl('')
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <p className="eyebrow">DISCOVERY WORKSPACE</p>

        <h1>Discover Companies</h1>

        <p className="subtitle">
          Find, review and validate industrial prospects before adding them to
          the Tri Axis database.
        </p>

        <p className="version-label">
          Tri Axis v0.1.3 · Live Discovery Foundation
        </p>
      </section>

      <section className="filter-panel">
        <div className="filter-grid">
          <div className="field">
            <label>Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Company, sector, activity..."
            />
          </div>

          <div className="field">
            <label>Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              {industries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Karachi"
            />
          </div>

          <div className="field">
            <label>Relevance</label>
            <select
              value={relevance}
              onChange={(e) => setRelevance(e.target.value)}
            >
              <option value="All">All</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div className="discover-actions">
          <button
            className="primary-button"
            onClick={findCompanies}
            disabled={discovering}
          >
            {discovering ? 'Searching...' : 'Find Companies'}
          </button>
        </div>
      </section>

      {error ? (
        <section className="error-box">
          {error}
        </section>
      ) : null}

      {candidates.length > 0 ? (
        <section className="candidate-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LIVE DISCOVERY RESULTS</p>
              <h2>{candidates.length} candidates found</h2>
            </div>
            <p className="muted">
              Review before saving. Nothing is added automatically.
            </p>
          </div>

          <div className="candidate-list">
            {candidates.map((candidate, index) => (
              <article
                className="prospect-card"
                key={`${candidate.source_url || candidate.company_name}-${index}`}
              >
                <div className="prospect-top">
                  <div>
                    <h3>{candidate.company_name || 'Unknown company'}</h3>
                    <p className="muted">
                      {candidate.industry || 'Industry unknown'}
                      {candidate.city ? ` · ${candidate.city}` : ''}
                    </p>
                  </div>

                  <span
                    className={`badge ${
                      (candidate.industrial_relevance || 'Medium').toLowerCase()
                    }`}
                  >
                    {candidate.industrial_relevance || 'Medium'}
                  </span>
                </div>

                <p className="description">
                  {candidate.description || 'No company description available.'}
                </p>

                <div className="evidence-box">
                  <span className="evidence-label">INDUSTRIAL EVIDENCE</span>
                  <p>
                    {candidate.factory_evidence ||
                      'Industrial evidence not yet confirmed.'}
                  </p>
                </div>

                <div className="meta-grid">
                  <div>
                    <span className="meta-label">Business type</span>
                    <strong>
                      {candidate.business_type || 'Unknown'}
                    </strong>
                  </div>

                  <div>
                    <span className="meta-label">Source</span>
                    {candidate.source_url ? (
                      <a
                        href={candidate.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source
                      </a>
                    ) : (
                      <strong>Unknown</strong>
                    )}
                  </div>

                  <div>
                    <span className="meta-label">Source type</span>
                    <strong>
                      {candidate.source_type || 'Web Search'}
                    </strong>
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    className="primary-button"
                    onClick={() => saveCandidate(candidate)}
                    disabled={
                      savingUrl ===
                      (candidate.source_url || candidate.company_name)
                    }
                  >
                    {savingUrl ===
                    (candidate.source_url || candidate.company_name)
                      ? 'Saving...'
                      : 'Save Prospect'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="saved-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SAVED PROSPECTS</p>
            <h2>
              {loading ? 'Loading...' : `${filtered.length} prospects`}
            </h2>
          </div>

          <p className="muted">
            Evidence-first · Unknown is allowed
          </p>
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="empty-state">
            No saved prospects match the current filters.
          </div>
        ) : null}

        <div className="candidate-list">
          {filtered.map((prospect) => (
            <article className="prospect-card" key={prospect.id}>
              <div className="prospect-top">
                <div>
                  <h3>{prospect.company_name}</h3>
                  <p className="muted">
                    {prospect.industry || 'Industry unknown'}
                    {prospect.city ? ` · ${prospect.city}` : ''}
                    {prospect.province ? `, ${prospect.province}` : ''}
                  </p>
                </div>

                <span
                  className={`badge ${
                    (prospect.industrial_relevance || 'Medium').toLowerCase()
                  }`}
                >
                  {prospect.industrial_relevance || 'Unknown'}
                </span>
              </div>

              <p className="description">
                {prospect.description || 'No company description available yet.'}
              </p>

              <div className="evidence-box">
                <span className="evidence-label">INDUSTRIAL EVIDENCE</span>
                <p>
                  {prospect.factory_evidence ||
                    'Industrial evidence not recorded yet.'}
                </p>
              </div>

              <div className="meta-grid">
                <div>
                  <span className="meta-label">Business type</span>
                  <strong>
                    {prospect.business_type || 'Unknown'}
                  </strong>
                </div>

                <div>
                  <span className="meta-label">Website</span>
                  {prospect.website ? (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {prospect.website}
                    </a>
                  ) : (
                    <strong>Unknown</strong>
                  )}
                </div>

                <div>
                  <span className="meta-label">Status</span>
                  <strong>{prospect.status || 'Discovered'}</strong>
                </div>

                <div>
                  <span className="meta-label">Last checked</span>
                  <strong>
                    {prospect.last_checked
                      ? new Date(prospect.last_checked).toLocaleDateString()
                      : 'Unknown'}
                  </strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
