// TRI AXIS v0.3.0
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/api/prospects/route.js
//
// SUPABASE SOURCE OF TRUTH
//
// This API now reads the EXACT five working columns shown in Supabase:
//
// "Company Name"
// "Company Address"
// "Company Website"
// "Company Email"
// "Company Contact"
//
// `id` remains in Supabase as the internal unique identifier but is not
// shown as a user-facing table column.
//
// IMPORTANT:
// The column names below intentionally include spaces and capital letters
// because they match the Supabase table exactly.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TABLE = 'companies'

const FIELD_NAMES = {
  id: 'id',
  name: 'Company Name',
  address: 'Company Address',
  website: 'Company Website',
  email: 'Company Email',
  contact: 'Company Contact'
}

function getSupabaseConfig() {
  const url = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  ).replace(/\/+$/, '')

  const key = String(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  ).trim()

  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is missing.'
    )
  }

  if (!key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.'
    )
  }

  return { url, key }
}

function makeHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

function textOrNull(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const text = String(value).trim()

  return text || null
}

function normalizeCompany(row) {
  return {
    id:
      row?.[FIELD_NAMES.id] ?? null,

    'Company Name':
      row?.[FIELD_NAMES.name] ?? null,

    'Company Address':
      row?.[FIELD_NAMES.address] ?? null,

    'Company Website':
      row?.[FIELD_NAMES.website] ?? null,

    'Company Email':
      row?.[FIELD_NAMES.email] ?? null,

    'Company Contact':
      row?.[FIELD_NAMES.contact] ?? null
  }
}

function buildCompanyPayload(body) {
  const companyName =
    textOrNull(
      body?.[FIELD_NAMES.name]
    )

  return {
    [FIELD_NAMES.name]:
      companyName,

    [FIELD_NAMES.address]:
      textOrNull(
        body?.[FIELD_NAMES.address]
      ),

    [FIELD_NAMES.website]:
      textOrNull(
        body?.[FIELD_NAMES.website]
      ),

    [FIELD_NAMES.email]:
      textOrNull(
        body?.[FIELD_NAMES.email]
      ),

    [FIELD_NAMES.contact]:
      textOrNull(
        body?.[FIELD_NAMES.contact]
      )
  }
}

async function readResponse(response) {
  const text =
    await response.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function sortCompanies(rows) {
  return [...rows].sort(
    (a, b) => {
      const aName =
        String(
          a?.['Company Name'] || ''
        ).trim()

      const bName =
        String(
          b?.['Company Name'] || ''
        ).trim()

      return aName.localeCompare(
        bName,
        'en',
        {
          sensitivity: 'base'
        }
      )
    }
  )
}

export async function GET() {
  try {
    const { url, key } =
      getSupabaseConfig()

    // We deliberately request all database columns here rather than
    // relying on quoted PostgREST select syntax for columns that contain
    // spaces. The API response below exposes only the exact five working
    // fields plus the hidden internal id.
    const endpoint =
      `${url}/rest/v1/${TABLE}?select=*`

    const response =
      await fetch(
        endpoint,
        {
          method: 'GET',

          headers:
            makeHeaders(
              key,
              {
                Range: '0-4999',
                Prefer: 'count=exact'
              }
            ),

          cache: 'no-store'
        }
      )

    const data =
      await readResponse(response)

    if (!response.ok) {
      console.error(
        'Supabase companies GET failed:',
        data
      )

      return NextResponse.json(
        {
          error:
            'Could not load companies from Supabase.',

          details:
            data
        },
        {
          status:
            response.status
        }
      )
    }

    const rows =
      Array.isArray(data)
        ? data.map(normalizeCompany)
        : []

    return NextResponse.json(
      sortCompanies(rows),
      {
        status: 200,

        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate'
        }
      }
    )
  } catch (error) {
    console.error(
      'Prospects GET error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load companies.'
      },
      {
        status: 500
      }
    )
  }
}

export async function POST(request) {
  try {
    const { url, key } =
      getSupabaseConfig()

    const body =
      await request.json()

    const payload =
      buildCompanyPayload(body)

    if (
      !payload[FIELD_NAMES.name]
    ) {
      return NextResponse.json(
        {
          error:
            '"Company Name" is required.'
        },
        {
          status: 400
        }
      )
    }

    const endpoint =
      `${url}/rest/v1/${TABLE}`

    const response =
      await fetch(
        endpoint,
        {
          method: 'POST',

          headers:
            makeHeaders(
              key,
              {
                Prefer:
                  'return=representation'
              }
            ),

          body:
            JSON.stringify(payload),

          cache:
            'no-store'
        }
      )

    const data =
      await readResponse(response)

    if (!response.ok) {
      console.error(
        'Supabase companies POST failed:',
        data
      )

      return NextResponse.json(
        {
          error:
            'Could not save company to Supabase.',

          details:
            data
        },
        {
          status:
            response.status
        }
      )
    }

    const saved =
      Array.isArray(data)
        ? data[0]
        : data

    return NextResponse.json(
      normalizeCompany(
        saved || payload
      ),
      {
        status: 201
      }
    )
  } catch (error) {
    console.error(
      'Prospects POST error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not save company.'
      },
      {
        status: 500
      }
    )
  }
}
