'use client'

// TRI AXIS v0.3.0
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/page.js
//
// Dashboard is aligned to the five-field prospect database.
// CRM and outreach metrics are intentionally NOT added yet because the
// project is still at Milestone 2: company information enrichment.

import {
  useEffect,
  useMemo,
  useState
} from 'react'

import Link from 'next/link'

export default function DashboardPage() {
  const [companies, setCompanies] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  useEffect(
    () => {
      loadCompanies()
    },
    []
  )

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

      const text =
        await response.text()

      let data

      try {
        data =
          JSON.parse(text)
      } catch {
        throw new Error(
          `Server returned a non-JSON response (${response.status}).`
        )
      }

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

  const metrics =
    useMemo(
      () => {
        const total =
          companies.length

        const websites =
          countPresent(
            companies,
            'Company Website'
          )

        const emails =
          countPresent(
            companies,
            'Company Email'
          )

        const contacts =
          countPresent(
            companies,
            'Company Contact'
          )

        const readyForEmail =
          companies.filter(
            company =>
              hasValue(
                company?.['Company Email']
              )
          ).length

        return {
          total,
          websites,
          emails,
          contacts,
          readyForEmail
        }
      },
      [companies]
    )

  const recentRows =
    useMemo(
      () =>
        companies.slice(0, 10),
      [companies]
    )

  return (
    <main className="page-shell">
      <section className="page-header">
        <p className="eyebrow">
          TRI AXIS · PROSPECTING
        </p>

        <h1>
          Prospect Database
        </h1>

        <p className="subtitle">
          Milestone 1 is complete. Milestone 2 is to make the company list
          contactable before automated outreach begins.
        </p>
      </section>

      {error ? (
        <section className="error-box">
          {error}
        </section>
      ) : null}

      <section className="dashboard-grid">
        <MetricCard
          value={
            loading
              ? '—'
              : metrics.total
          }
          label="Companies"
        />

        <MetricCard
          value={
            loading
              ? '—'
              : metrics.websites
          }
          label="Websites"
        />

        <MetricCard
          value={
            loading
              ? '—'
              : metrics.emails
          }
          label="Emails"
        />

        <MetricCard
          value={
            loading
              ? '—'
              : metrics.contacts
          }
          label="Contacts"
        />
      </section>

      <section className="milestone-card">
        <div>
          <p className="eyebrow">
            CURRENT MILESTONE
          </p>

          <h2>
            Complete company contact information.
          </h2>

          <p className="subtitle">
            Company Name, Company Address, Company Website, Company Email and
            Company Contact are the only working fields required at this stage.
          </p>

          {!loading ? (
            <p className="milestone-progress">
              {metrics.readyForEmail} of {metrics.total} companies currently
              have an email and can eventually enter automated outreach.
            </p>
          ) : null}
        </div>

        <Link
          href="/discover"
          className="primary-button"
          style={{
            display:
              'inline-flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            textDecoration:
              'none'
          }}
        >
          Open Companies
        </Link>
      </section>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              COMPANY DATABASE
            </p>

            <h2>
              Company records
            </h2>
          </div>

          <p className="muted">
            {loading
              ? 'Loading...'
              : `${companies.length} total`}
          </p>
        </div>

        {!loading &&
        recentRows.length === 0 ? (
          <div className="empty-state">
            No company records found.
          </div>
        ) : null}

        {recentRows.length > 0 ? (
          <div className="table-wrap dashboard-company-table-wrap">
            <table className="dashboard-company-table">
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
                {recentRows.map(
                  (
                    company,
                    index
                  ) => (
                    <tr
                      key={
                        company?.id ||
                        `${company?.['Company Name'] || 'company'}-${index}`
                      }
                    >
                      <td>
                        <strong>
                          {display(
                            company?.['Company Name']
                          )}
                        </strong>
                      </td>

                      <td>
                        {display(
                          company?.['Company Address']
                        )}
                      </td>

                      <td>
                        {display(
                          company?.['Company Website']
                        )}
                      </td>

                      <td>
                        {display(
                          company?.['Company Email']
                        )}
                      </td>

                      <td>
                        {display(
                          company?.['Company Contact']
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
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

function hasValue(value) {
  return Boolean(
    safeText(value)
  )
}

function countPresent(
  companies,
  field
) {
  return companies.filter(
    company =>
      hasValue(
        company?.[field]
      )
  ).length
}

function display(value) {
  return (
    safeText(value) ||
    '—'
  )
}
