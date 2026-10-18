'use client'

// TRI AXIS v0.1.5
// FILE DESTINATION: app/discover/page.js
//
// DESIGN RULE FOR THIS VERSION:
// Show data as a compact table aligned to the Supabase companies table.
// Do not force the user to read large research cards.
//
// Candidate columns are the exact commercial fields the platform needs.
// Long text fields are truncated in the table and shown in full on hover/title.
//
// City is optional:
// - Fill City to search one city.
// - Leave City blank to search Pakistan-wide.

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
  const [saved, setSaved] = useState([])
  const [industry, setIndustry] = useState('Engineering & Fabrication')
  const [city, setCity] = useState('')
  const [relevance, setRelevance] = useState('All')
  const [query, setQuery] = useState('')

  const [loadingSaved, setLoadingSaved] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState([])
  const [meta, setMeta] = useState(null)
  const [savingKey, setSavingKey] = useState('')

  useEffect(() => {
    loadSaved()
  }, [])

  async function readJson(response) {
    const text = await response.text()

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(
        `Server returned a non-JSON response (${response.status}).`
      )
    }
  }

  async function loadSaved() {
    try {
      setLoadingSaved(true)

      const response = await fetch('/api/prospects', {
        cache: 'no-store'
      })

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(data?.error || 'Could not load saved prospects.')
      }

      setSaved(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not load saved prospects.')
    } finally {
      setLoadingSaved(false)
    }
  }

  async function findCompanies() {
    try {
      setDiscovering(true)
      setError('')
      setCandidates([])
      setMeta(null)

      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          industry:
            industry === 'All Industries' ? '' : industry,
          city,
          query
        })
      })

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(data?.error || 'Discovery failed.')
      }

      setCandidates(
        Array.isArray(data?.candidates)
          ? data.candidates
          : []
      )

      setMeta(data?.meta || null)
    } catch (err) {
      setError(err.message || 'Discovery failed.')
    } finally {
      setDiscovering(false)
    }
  }

  async function saveProspect(candidate) {
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

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(
          data?.error || 'Could not save prospect.'
        )
      }

      await loadSaved()
    } catch (err) {
      setError(err.message || 'Could not save prospect.')
    } finally {
      setSavingKey('')
    }
  }

  const filteredSaved = useMemo(() => {
    return saved.filter(row => {
      if (
        industry !== 'All Industries' &&
        normalize(row.industry) !== normalize(industry)
      ) {
        return false
      }

      if (
        city &&
        !normalize(row.city).includes(normalize(city))
      ) {
        return false
      }

      if (
        relevance !== 'All' &&
        normalize(row.industrial_relevance) !==
          normalize(relevance)
      ) {
        return false
      }

      return true
    })
  }, [saved, industry, city, relevance])

  return (
    <main className="page-shell">
      <section className="page-header">
        <p className="eyebrow">
          DISCOVERY WORKSPACE
        </p>

        <h1>Discover Companies</h1>

        <p className="subtitle">
          Search one city or leave City blank to search across Pakistan.
          Results are shown as company records aligned to the database.
        </p>

        <p className="version-label">
          Tri Axis v0.1.5 · Prospect Table Discovery
        </p>
      </section>

      <section className="filter-panel">
        <div className="filter-grid">
          <div className="field">
            <label>Optional requirement detail</label>
            <input
              value={query}
              onChange={event =>
                setQuery(event.target.value)
              }
              placeholder="e.g. CNC machining, pipe fabrication..."
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
              placeholder="Blank = Pakistan"
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
              ? 'Researching...'
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
                : `${candidates.length} companies`}
            </h2>
          </div>

          <p className="muted">
            {meta
              ? `${meta.scope} · ${meta.pages_inspected || 0} pages inspected`
              : 'Nothing is saved automatically.'}
          </p>
        </div>

        {!discovering &&
        meta &&
        candidates.length === 0 ? (
          <div className="empty-state">
            No company passed the evidence rules in this batch.
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <ProspectTable
            rows={candidates}
            candidateMode
            savingKey={savingKey}
            onSave={saveProspect}
          />
        ) : null}
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
            Already stored in Supabase.
          </p>
        </div>

        {!loadingSaved &&
        filteredSaved.length === 0 ? (
          <div className="empty-state">
            No saved prospects match the current filters.
          </div>
        ) : null}

        {filteredSaved.length > 0 ? (
          <ProspectTable rows={filteredSaved} />
        ) : null}
      </section>
    </main>
  )
}

function ProspectTable({
  rows,
  candidateMode = false,
  savingKey = '',
  onSave
}) {
  return (
    <div className="table-wrap prospect-table-wrap">
      <table className="prospect-data-table">
        <thead>
          <tr>
            <th>Company Name</th>
            <th>Website</th>
            <th>Industry</th>
            <th>Business Type</th>
            <th>City</th>
            <th>Province</th>
            <th>Country</th>
            <th>Description</th>
            <th>Factory Evidence</th>
            <th>Relevance</th>
            <th>Source URL</th>
            <th>Source Type</th>
            <th>Status</th>
            <th>Last Checked</th>
            {candidateMode ? <th>Action</th> : null}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const key =
              row.id ||
              row.website ||
              row.source_url ||
              `${row.company_name}-${index}`

            const saveKey =
              row.website ||
              row.source_url ||
              row.company_name

            return (
              <tr key={key}>
                <td className="company-cell">
                  <strong>
                    {value(row.company_name)}
                  </strong>
                </td>

                <td>
                  {row.website ? (
                    <a
                      href={row.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  ) : (
                    'Unknown'
                  )}
                </td>

                <td>{value(row.industry)}</td>
                <td>{value(row.business_type)}</td>
                <td>{value(row.city)}</td>
                <td>{value(row.province)}</td>
                <td>{value(row.country)}</td>

                <td
                  className="long-cell"
                  title={value(row.description)}
                >
                  {truncate(row.description, 120)}
                </td>

                <td
                  className="long-cell"
                  title={value(row.factory_evidence)}
                >
                  {truncate(row.factory_evidence, 140)}
                </td>

                <td>
                  <span
                    className={`badge ${badgeClass(
                      row.industrial_relevance
                    )}`}
                  >
                    {value(row.industrial_relevance)}
                  </span>
                </td>

                <td>
                  {row.source_url ? (
                    <a
                      href={row.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source
                    </a>
                  ) : (
                    'Unknown'
                  )}
                </td>

                <td>{value(row.source_type)}</td>
                <td>{value(row.status)}</td>

                <td>
                  {formatDate(row.last_checked)}
                </td>

                {candidateMode ? (
                  <td>
                    <button
                      className="table-action-button"
                      onClick={() => onSave(row)}
                      disabled={savingKey === saveKey}
                    >
                      {savingKey === saveKey
                        ? 'Saving...'
                        : 'Save'}
                    </button>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function value(input) {
  const text = String(input || '').trim()
  return text || 'Unknown'
}

function normalize(input) {
  return String(input || '').trim().toLowerCase()
}

function truncate(input, limit) {
  const text = value(input)

  if (text === 'Unknown') return text
  if (text.length <= limit) return text

  return `${text.slice(0, limit)}…`
}

function badgeClass(input) {
  const text = normalize(input)

  if (text === 'high') return 'high'
  if (text === 'medium') return 'medium'
  if (text === 'low') return 'low'

  return 'medium'
}

function formatDate(input) {
  if (!input) return 'Unknown'

  const date = new Date(input)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleDateString()
}
