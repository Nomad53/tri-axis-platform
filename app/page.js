'use client'

// TRI AXIS v0.1.4
// FILE DESTINATION: app/page.js
//
// IMPORTANT:
// app/layout.js already provides the global sidebar and page shell.
// This dashboard file must NOT create another sidebar, brand block, or navigation.
//
// Dashboard figures are calculated only from records returned by /api/prospects.
//
// Rules:
// - Companies Discovered = every saved prospect row.
// - High Relevance = industrial_relevance exactly "High" (case-insensitive).
// - Reviewed = status exactly "Reviewed" (case-insensitive).
// - Cities Covered = unique non-empty city names.
// - Missing values are allowed and never guessed.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export default function DashboardPage() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProspects()
  }, [])

  async function loadProspects() {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/prospects', {
        cache: 'no-store'
      })

      const text = await response.text()

      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(
          `Server returned a non-JSON response (${response.status}).`
        )
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Could not load prospects.')
      }

      setProspects(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not load prospects.')
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    const discovered = prospects.length

    const highRelevance = prospects.filter(
      prospect =>
        normalize(prospect.industrial_relevance) === 'high'
    ).length

    const reviewed = prospects.filter(
      prospect =>
        normalize(prospect.status) === 'reviewed'
    ).length

    const uniqueCities = new Set(
      prospects
        .map(prospect => normalizeCity(prospect.city))
        .filter(Boolean)
    )

    return {
      discovered,
      highRelevance,
      reviewed,
      citiesCovered: uniqueCities.size
    }
  }, [prospects])

  const recentProspects = useMemo(() => {
    return [...prospects]
      .sort((a, b) => {
        const aTime = dateValue(a.created_at || a.last_checked)
        const bTime = dateValue(b.created_at || b.last_checked)
        return bTime - aTime
      })
      .slice(0, 10)
  }, [prospects])

  return (
    <main className="page-shell">
      <section className="page-header">
        <p className="eyebrow">M1 · COMPANY DISCOVERY</p>

        <h1>Industrial Prospect Intelligence</h1>

        <p className="subtitle">
          Build a clean database of Pakistani companies with credible
          industrial buying potential.
        </p>

        <p className="version-label">
          Tri Axis v0.1.4 · Company Entity Discovery
        </p>
      </section>

      {error ? (
        <section className="error-box">
          {error}
        </section>
      ) : null}

      <section className="dashboard-grid">
        <MetricCard
          value={loading ? '—' : metrics.discovered}
          label="Companies Discovered"
        />

        <MetricCard
          value={loading ? '—' : metrics.highRelevance}
          label="High Relevance"
        />

        <MetricCard
          value={loading ? '—' : metrics.reviewed}
          label="Reviewed"
        />

        <MetricCard
          value={loading ? '—' : metrics.citiesCovered}
          label="Cities Covered"
        />
      </section>

      <section className="milestone-card">
        <div>
          <p className="eyebrow">CURRENT MILESTONE</p>

          <h2>Find the right companies first.</h2>

          <p className="subtitle">
            Discovery quality comes first. Contacts, outreach, RFQs and
            finance stay outside this milestone until company discovery is
            reliable.
          </p>
        </div>

        <Link
          href="/discover"
          className="primary-button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none'
          }}
        >
          Open Discover
        </Link>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">SAVED PROSPECTS</p>
            <h2>Recent prospects</h2>
          </div>

          <p className="muted">
            {loading
              ? 'Loading...'
              : `${prospects.length} total`}
          </p>
        </div>

        {!loading && recentProspects.length === 0 ? (
          <div className="empty-state">
            No prospects are saved yet. Use Discover to research and save
            the first company.
          </div>
        ) : null}

        {recentProspects.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Industry</th>
                  <th>City</th>
                  <th>Relevance</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentProspects.map(prospect => (
                  <tr key={prospect.id}>
                    <td>
                      <strong>
                        {prospect.company_name ||
                          'Unknown company'}
                      </strong>

                      <div className="muted">
                        {prospect.website
                          ? prospect.website
                          : 'Website unknown'}
                      </div>
                    </td>

                    <td>
                      {prospect.industry || 'Unknown'}
                    </td>

                    <td>
                      {prospect.city || 'Unknown'}
                    </td>

                    <td>
                      <span
                        className={`badge ${badgeClass(
                          prospect.industrial_relevance
                        )}`}
                      >
                        {prospect.industrial_relevance ||
                          'Unknown'}
                      </span>
                    </td>

                    <td>
                      {prospect.status || 'Discovered'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  )
}

function MetricCard({ value, label }) {
  return (
    <article className="metric-card">
      <p className="metric-value">{value}</p>
      <p className="metric-label">{label}</p>
    </article>
  )
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeCity(value) {
  return String(value || '').trim().toLowerCase()
}

function badgeClass(value) {
  const normalized = normalize(value)

  if (normalized === 'high') return 'high'
  if (normalized === 'medium') return 'medium'
  if (normalized === 'low') return 'low'

  return 'medium'
}

function dateValue(value) {
  if (!value) return 0

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}
