'use client'

// TRI AXIS v0.1.4
// FILE DESTINATION: app/discover/page.js
//
// This page deliberately separates:
// A) live discovery candidates returned from /api/discover
// B) saved prospects already stored in Supabase via /api/prospects
//
// A live search result is NEVER saved automatically.
// The user must explicitly click "Save Prospect".

import { useEffect, useMemo, useState } from 'react'

const industries = [
  'All Industries',
  'Automotive',
  'Cement',
  'Chemicals',
  'Engineering & Fabrication',
  'Food & Beverage',
  'Packaging',
  'Pharmaceuticals',
  'Power & Energy',
  'Steel & Metals',
  'Textile'
]

export default function DiscoverPage() {
  const [rows, setRows] = useState([])
  const [industry, setIndustry] = useState('Engineering & Fabrication')
  const [city, setCity] = useState('Karachi')
  const [relevance, setRelevance] = useState('All')
  const [query, setQuery] = useState('')

  const [loadingSaved, setLoadingSaved] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState([])
  const [searchMeta, setSearchMeta] = useState(null)
  const [savingKey, setSavingKey] = useState('')

  async function readJsonSafely(response) {
    const text = await response.text()

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(
        `Server returned a non-JSON response (${response.status}).`
      )
    }
  }

  async function loadSavedProspects() {
    try {
      setLoadingSaved(true)
      setError('')

      const response = await fetch('/api/prospects', {
        cache: 'no-store'
      })

      const data = await readJsonSafely(response)

      if (!response.ok) {
        throw new Error(data?.error || 'Could not load saved prospects.')
      }

      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not load saved prospects.')
    } finally {
      setLoadingSaved(false)
    }
  }

  useEffect(() => {
    loadSavedProspects()
  }, [])

  const filteredSaved = useMemo(() => {
    return rows.filter(prospect => {
      if (
        industry !== 'All Industries' &&
        safeLower(prospect.industry) !== safeLower(industry)
      ) {
        return false
      }

      if (
        city &&
        !safeLower(prospect.city).includes(safeLower(city))
      ) {
        return false
      }

      if (
        relevance !== 'All' &&
        safeLower(prospect.industrial_relevance) !== safeLower(relevance)
      ) {
        return false
      }

      if (query) {
        const searchable = [
          prospect.company_name,
          prospect.industry,
          prospect.business_type,
          prospect.city,
          prospect.province,
          prospect.description,
          prospect.factory_evidence
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
      setSearchMeta(null)

      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          industry:
            industry === 'All Industries'
              ? ''
              : industry,
          city,
          query
        })
      })

      const data = await readJsonSafely(response)

      if (!response.ok) {
        throw new Error(data?.error || 'Discovery failed.')
      }

      setCandidates(
        Array.isArray(data?.candidates)
          ? data.candidates
          : []
      )

      setSearchMeta(data?.meta || null)
    } catch (err) {
      setError(err.message || 'Discovery failed.')
    } finally {
      setDiscovering(false)
    }
  }

  async function saveCandidate(candidate) {
    const key =
      candidate.website ||
      candidate.source_url ||
      candidate.company_name

    try {
      setSavingKey(key)
      setError('')

      const response = await fetch('/api/prospects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(candidate)
      })

      const data = await readJsonSafely(response)

      if (!response.ok) {
        throw new Error(
          data?.error || 'Could not save prospect.'
        )
      }

      await loadSavedProspects()
    } catch (err) {
      setError(err.message || 'Could not save prospect.')
    } finally {
      setSavingKey('')
    }
  }

  return (
    <main className="page-shell">
      <section className="page-header">
        <p className="eyebrow">
          DISCOVERY WORKSPACE
        </p>

        <h1>Discover Companies</h1>

        <p className="subtitle">
          Find actual industrial companies, review the evidence,
          then choose which prospects belong in the Tri Axis database.
        </p>

        <p className="version-label">
          Tri Axis v0.1.4 · Company Entity Discovery
        </p>
      </section>

      <section className="filter-panel">
        <div className="filter-grid">
          <div className="field">
            <label>Optional search detail</label>
            <input
              value={query}
              onChange={event =>
                setQuery(event.target.value)
              }
              placeholder="e.g. CNC machining, steel structures..."
            />
          </div>

          <div className="field">
            <label>Industry</label>
            <select
              value={industry}
              onChange={event =>
                setIndustry(event.target.value)
              }
            >
              {industries.map(item => (
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
              onChange={event =>
                setCity(event.target.value)
              }
              placeholder="Karachi"
            />
          </div>

          <div className="field">
            <label>Saved relevance filter</label>
            <select
              value={relevance}
              onChange={event =>
                setRelevance(event.target.value)
              }
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
            {discovering
              ? 'Researching companies...'
              : 'Find Companies'}
          </button>
        </div>
      </section>

      {error ? (
        <section className="error-box">
          {error}
        </section>
      ) : null}

      <section className="candidate-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              LIVE COMPANY CANDIDATES
            </p>

            <h2>
              {discovering
                ? 'Researching...'
                : `${candidates.length} companies found`}
            </h2>
          </div>

          <p className="muted">
            Search results are not saved automatically.
          </p>
        </div>

        {!discovering &&
        searchMeta &&
        candidates.length === 0 ? (
          <div className="empty-state">
            No company passed the current evidence rules.
            Try another industry, city, or a more specific search detail.
          </div>
        ) : null}

        {searchMeta ? (
          <p className="muted">
            Inspected {searchMeta.pages_inspected || 0} candidate pages
            from {searchMeta.raw_results_after_basic_filter || 0} filtered
            search results.
          </p>
        ) : null}

        <div className="candidate-list">
          {candidates.map((candidate, index) => {
            const saveKey =
              candidate.website ||
              candidate.source_url ||
              candidate.company_name

            return (
              <article
                className="prospect-card"
                key={`${saveKey}-${index}`}
              >
                <div className="prospect-top">
                  <div>
                    <h3>
                      {candidate.company_name ||
                        'Unknown company'}
                    </h3>

                    <p className="muted">
                      {candidate.industry ||
                        'Industry unknown'}
                      {candidate.city
                        ? ` · ${candidate.city}`
                        : ''}
                    </p>
                  </div>

                  <span
                    className={`badge ${safeLower(
                      candidate.industrial_relevance ||
                        'Low'
                    )}`}
                  >
                    {candidate.industrial_relevance ||
                      'Unknown'}
                  </span>
                </div>

                <p className="description">
                  {candidate.description ||
                    'No concise company description was available.'}
                </p>

                <div className="evidence-box">
                  <span className="evidence-label">
                    WHY TRI AXIS INCLUDED THIS COMPANY
                  </span>

                  <p>
                    {candidate.factory_evidence ||
                      'Industrial evidence could not be summarized.'}
                  </p>
                </div>

                <div className="meta-grid">
                  <div>
                    <span className="meta-label">
                      Business type
                    </span>
                    <strong>
                      {candidate.business_type ||
                        'Unknown'}
                    </strong>
                  </div>

                  <div>
                    <span className="meta-label">
                      Website
                    </span>

                    {candidate.website ? (
                      <a
                        href={candidate.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open website
                      </a>
                    ) : (
                      <strong>Unknown</strong>
                    )}
                  </div>

                  <div>
                    <span className="meta-label">
                      Evidence source
                    </span>
                    <strong>
                      {candidate.source_type ||
                        'Unknown'}
                    </strong>
                  </div>

                  <div>
                    <span className="meta-label">
                      Last checked
                    </span>
                    <strong>
                      {formatDate(
                        candidate.last_checked
                      )}
                    </strong>
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    className="primary-button"
                    onClick={() =>
                      saveCandidate(candidate)
                    }
                    disabled={savingKey === saveKey}
                  >
                    {savingKey === saveKey
                      ? 'Saving...'
                      : 'Save Prospect'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="saved-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              SAVED PROSPECTS
            </p>

            <h2>
              {loadingSaved
                ? 'Loading...'
                : `${filteredSaved.length} prospects`}
            </h2>
          </div>

          <p className="muted">
            These records are already stored in Supabase.
          </p>
        </div>

        {!loadingSaved &&
        filteredSaved.length === 0 ? (
          <div className="empty-state">
            No saved prospects match the current filters.
          </div>
        ) : null}

        <div className="candidate-list">
          {filteredSaved.map(prospect => (
            <article
              className="prospect-card"
              key={prospect.id}
            >
              <div className="prospect-top">
                <div>
                  <h3>
                    {prospect.company_name ||
                      'Unknown company'}
                  </h3>

                  <p className="muted">
                    {prospect.industry ||
                      'Industry unknown'}
                    {prospect.city
                      ? ` · ${prospect.city}`
                      : ''}
                    {prospect.province
                      ? `, ${prospect.province}`
                      : ''}
                  </p>
                </div>

                <span
                  className={`badge ${safeLower(
                    prospect.industrial_relevance ||
                      'Low'
                  )}`}
                >
                  {prospect.industrial_relevance ||
                    'Unknown'}
                </span>
              </div>

              <p className="description">
                {prospect.description ||
                  'No company description available yet.'}
              </p>

              <div className="evidence-box">
                <span className="evidence-label">
                  INDUSTRIAL EVIDENCE
                </span>

                <p>
                  {prospect.factory_evidence ||
                    'Industrial evidence not recorded yet.'}
                </p>
              </div>

              <div className="meta-grid">
                <div>
                  <span className="meta-label">
                    Business type
                  </span>
                  <strong>
                    {prospect.business_type ||
                      'Unknown'}
                  </strong>
                </div>

                <div>
                  <span className="meta-label">
                    Website
                  </span>

                  {prospect.website ? (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open website
                    </a>
                  ) : (
                    <strong>Unknown</strong>
                  )}
                </div>

                <div>
                  <span className="meta-label">
                    Status
                  </span>
                  <strong>
                    {prospect.status ||
                      'Discovered'}
                  </strong>
                </div>

                <div>
                  <span className="meta-label">
                    Last checked
                  </span>
                  <strong>
                    {formatDate(
                      prospect.last_checked
                    )}
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

function safeLower(value) {
  return String(value || '').toLowerCase()
}

function formatDate(value) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleDateString()
}
