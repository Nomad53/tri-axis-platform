'use client'

// TRI AXIS v0.3.0
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/discover/page.js
//
// MILESTONE 2 WORKING VIEW
//
// The user-facing company database intentionally shows ONLY the five
// operational fields required for outreach:
//
// Company Name
// Company Address
// Company Website
// Company Email
// Company Contact
//
// Supabase `id` remains hidden and is used only as the stable row key.

import {
  useEffect,
  useMemo,
  useState
} from 'react'

export default function CompaniesPage() {
  const [companies, setCompanies] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [search, setSearch] =
    useState('')

  useEffect(
    () => {
      loadCompanies()
    },
    []
  )

  async function readJson(response) {
    const text =
      await response.text()

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(
        `Server returned a non-JSON response (${response.status}).`
      )
    }
  }

  async function loadCompanies() {
    try {
      setLoading(true)
      setError('')

      const response =
        await fetch(
          '/api/prospects',
          {
            cache:
              'no-store'
          }
        )

      const data =
        await readJson(response)

      if (!response.ok) {
        throw new Error(
          data?.error ||
          'Could not load companies.'
        )
      }

      setCompanies(
        Array.isArray(data)
          ? data
          : []
      )
    } catch (err) {
      setError(
        err.message ||
        'Could not load companies.'
      )
    } finally {
      setLoading(false)
    }
  }

  const filteredCompanies =
    useMemo(
      () => {
        const term =
          normalize(search)

        if (!term) {
          return companies
        }

        return companies.filter(
          company => {
            const searchable =
              [
                company?.['Company Name'],
                company?.['Company Address'],
                company?.['Company Website'],
                company?.['Company Email'],
                company?.['Company Contact']
              ]
                .map(normalize)
                .join(' ')

            return searchable.includes(
              term
            )
          }
        )
      },
      [
        companies,
        search
      ]
    )

  const completeness =
    useMemo(
      () => {
        return {
          websites:
            companies.filter(
              row =>
                hasValue(
                  row?.['Company Website']
                )
            ).length,

          emails:
            companies.filter(
              row =>
                hasValue(
                  row?.['Company Email']
                )
            ).length,

          contacts:
            companies.filter(
              row =>
                hasValue(
                  row?.['Company Contact']
                )
            ).length
        }
      },
      [companies]
    )

  return (
    <main className="page-shell">
      <section className="page-header">
        <p className="eyebrow">
          MILESTONE 2 · COMPANY INFORMATION
        </p>

        <h1>
          Company Database
        </h1>

        <p className="subtitle">
          The working prospect list for outreach. Only the five fields needed
          before email automation are shown here.
        </p>
      </section>

      {error ? (
        <section className="error-box">
          {error}
        </section>
      ) : null}

      <section className="dashboard-grid company-metrics">
        <MetricCard
          value={
            loading
              ? '—'
              : companies.length
          }
          label="Companies"
        />

        <MetricCard
          value={
            loading
              ? '—'
              : completeness.websites
          }
          label="Websites"
        />

        <MetricCard
          value={
            loading
              ? '—'
              : completeness.emails
          }
          label="Emails"
        />

        <MetricCard
          value={
            loading
              ? '—'
              : completeness.contacts
          }
          label="Contacts"
        />
      </section>

      <section className="company-search-panel">
        <div className="company-search-field">
          <label htmlFor="company-search">
            Search Companies
          </label>

          <input
            id="company-search"
            value={search}
            onChange={
              event =>
                setSearch(
                  event.target.value
                )
            }
            placeholder="Search company, address, website, email or contact..."
          />
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadCompanies}
          disabled={loading}
        >
          {loading
            ? 'Loading...'
            : 'Refresh'}
        </button>
      </section>

      <section className="saved-section company-database-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              PROSPECT DATABASE
            </p>

            <h2>
              {loading
                ? 'Loading companies...'
                : `${filteredCompanies.length} companies`}
            </h2>
          </div>

          <p className="muted">
            {search
              ? `${companies.length} total records`
              : 'Live from Supabase'}
          </p>
        </div>

        {!loading &&
        filteredCompanies.length === 0 ? (
          <div className="empty-state">
            No companies match this search.
          </div>
        ) : null}

        {filteredCompanies.length > 0 ? (
          <CompanyTable
            rows={filteredCompanies}
          />
        ) : null}
      </section>
    </main>
  )
}

function CompanyTable({
  rows
}) {
  return (
    <div className="table-wrap company-table-wrap">
      <table className="company-database-table">
        <thead>
          <tr>
            <th>
              Company Name
            </th>

            <th>
              Company Address
            </th>

            <th>
              Company Website
            </th>

            <th>
              Company Email
            </th>

            <th>
              Company Contact
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              index
            ) => {
              const key =
                row?.id ||
                `${row?.['Company Name'] || 'company'}-${index}`

              return (
                <tr key={key}>
                  <td className="company-name-cell">
                    <strong>
                      {display(
                        row?.['Company Name']
                      )}
                    </strong>
                  </td>

                  <td>
                    {display(
                      row?.['Company Address']
                    )}
                  </td>

                  <td>
                    <WebsiteCell
                      value={
                        row?.['Company Website']
                      }
                    />
                  </td>

                  <td>
                    <EmailCell
                      value={
                        row?.['Company Email']
                      }
                    />
                  </td>

                  <td>
                    <ContactCell
                      value={
                        row?.['Company Contact']
                      }
                    />
                  </td>
                </tr>
              )
            }
          )}
        </tbody>
      </table>
    </div>
  )
}

function WebsiteCell({
  value
}) {
  const text =
    safeText(value)

  if (!text) {
    return (
      <span className="missing-value">
        —
      </span>
    )
  }

  const href =
    makeWebsiteUrl(text)

  if (!href) {
    return text
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="table-link"
    >
      {compactWebsite(text)}
    </a>
  )
}

function EmailCell({
  value
}) {
  const text =
    safeText(value)

  if (!text) {
    return (
      <span className="missing-value">
        —
      </span>
    )
  }

  if (!looksLikeEmail(text)) {
    return text
  }

  return (
    <a
      href={`mailto:${text}`}
      className="table-link"
    >
      {text}
    </a>
  )
}

function ContactCell({
  value
}) {
  const text =
    safeText(value)

  if (!text) {
    return (
      <span className="missing-value">
        —
      </span>
    )
  }

  const phone =
    text.replace(
      /[^\d+]/g,
      ''
    )

  if (phone.length < 7) {
    return text
  }

  return (
    <a
      href={`tel:${phone}`}
      className="table-link"
    >
      {text}
    </a>
  )
}

function MetricCard({
  value,
  label
}) {
  return (
    <article className="metric-card">
      <p className="metric-value">
        {value}
      </p>

      <p className="metric-label">
        {label}
      </p>
    </article>
  )
}

function safeText(value) {
  return String(
    value || ''
  ).trim()
}

function display(value) {
  const text =
    safeText(value)

  return text || '—'
}

function hasValue(value) {
  return Boolean(
    safeText(value)
  )
}

function normalize(value) {
  return safeText(value)
    .toLowerCase()
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

function makeWebsiteUrl(value) {
  const text =
    safeText(value)

  if (!text) return null

  if (
    looksLikeEmail(text)
  ) {
    return null
  }

  try {
    const withProtocol =
      /^https?:\/\//i.test(text)
        ? text
        : `https://${text}`

    const url =
      new URL(withProtocol)

    if (
      ![
        'http:',
        'https:'
      ].includes(url.protocol)
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

function compactWebsite(value) {
  return safeText(value)
    .replace(
      /^https?:\/\//i,
      ''
    )
    .replace(
      /^www\./i,
      ''
    )
    .replace(
      /\/$/,
      ''
    )
}
