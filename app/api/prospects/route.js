// TRI AXIS v0.2.1
// COMPLETE REPLACEMENT FILE
// DESTINATION: app/api/prospects/route.js
//
// BUG FIX:
// The Supabase table already contains the correct fields such as:
// company_name, business_type, country, description, etc.
// Tri Axis must return those EXACT database column names to the UI.
// No legacy aliases such as name, company, type, location, etc. are used here.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TABLE = 'companies'

const COMPANY_COLUMNS = [
  'id',
  'company_name',
  'website',
  'industry',
  'business_type',
  'city',
  'province',
  'country',
  'description',
  'factory_evidence',
  'industrial_relevance',
  'source_url',
  'source_type',
  'status',
  'last_checked',
  'created_at',
  'updated_at'
]

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

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

function nullableText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  const text = String(value).trim()

  return text || null
}

function requiredText(value, fallback = '') {
  const text = String(
    value ?? fallback
  ).trim()

  return text
}

function nullableTimestamp(value) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function normalizeDatabaseRow(row) {
  // IMPORTANT:
  // This function deliberately preserves the exact Supabase
  // column names expected by app/discover/page.js.
  return {
    id: row?.id ?? null,
    company_name: row?.company_name ?? null,
    website: row?.website ?? null,
    industry: row?.industry ?? null,
    business_type: row?.business_type ?? null,
    city: row?.city ?? null,
    province: row?.province ?? null,
    country: row?.country ?? null,
    description: row?.description ?? null,
    factory_evidence: row?.factory_evidence ?? null,
    industrial_relevance:
      row?.industrial_relevance ?? null,
    source_url: row?.source_url ?? null,
    source_type: row?.source_type ?? null,
    status: row?.status ?? null,
    last_checked: row?.last_checked ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null
  }
}

function buildInsertRow(body) {
  const now = new Date().toISOString()

  return {
    id:
      requiredText(body?.id) ||
      crypto.randomUUID(),

    company_name:
      requiredText(body?.company_name),

    website:
      nullableText(body?.website),

    industry:
      nullableText(body?.industry),

    business_type:
      nullableText(body?.business_type),

    city:
      nullableText(body?.city),

    province:
      nullableText(body?.province),

    country:
      requiredText(
        body?.country,
        'Pakistan'
      ) || 'Pakistan',

    description:
      nullableText(body?.description),

    factory_evidence:
      nullableText(body?.factory_evidence),

    industrial_relevance:
      nullableText(
        body?.industrial_relevance
      ),

    source_url:
      nullableText(body?.source_url),

    source_type:
      nullableText(body?.source_type),

    status:
      requiredText(
        body?.status,
        'Discovered'
      ) || 'Discovered',

    last_checked:
      nullableTimestamp(
        body?.last_checked
      ),

    created_at:
      nullableTimestamp(
        body?.created_at
      ) || now,

    updated_at:
      nullableTimestamp(
        body?.updated_at
      ) || now
  }
}

async function parseResponse(response) {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function GET() {
  try {
    const { url, key } =
      getSupabaseConfig()

    const select =
      COMPANY_COLUMNS.join(',')

    // Supabase/PostgREST defaults can limit returned records.
    // Range 0-4999 ensures the full seed database is returned
    // without silently stopping at a small default page.
    const endpoint =
      `${url}/rest/v1/${TABLE}` +
      `?select=${encodeURIComponent(select)}` +
      `&order=company_name.asc`

    const response = await fetch(
      endpoint,
      {
        method: 'GET',
        headers: headers(
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
      await parseResponse(response)

    if (!response.ok) {
      console.error(
        'Supabase companies GET failed:',
        data
      )

      return NextResponse.json(
        {
          error:
            'Could not load companies from Supabase.',
          details: data
        },
        {
          status: response.status
        }
      )
    }

    const rows =
      Array.isArray(data)
        ? data.map(normalizeDatabaseRow)
        : []

    return NextResponse.json(
      rows,
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
            : 'Could not load prospects.'
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

    const row =
      buildInsertRow(body)

    if (!row.company_name) {
      return NextResponse.json(
        {
          error:
            'company_name is required.'
        },
        {
          status: 400
        }
      )
    }

    const endpoint =
      `${url}/rest/v1/${TABLE}`

    const response = await fetch(
      endpoint,
      {
        method: 'POST',
        headers: headers(
          key,
          {
            Prefer:
              'return=representation'
          }
        ),
        body: JSON.stringify(row),
        cache: 'no-store'
      }
    )

    const data =
      await parseResponse(response)

    if (!response.ok) {
      console.error(
        'Supabase companies POST failed:',
        data
      )

      return NextResponse.json(
        {
          error:
            'Could not save company to Supabase.',
          details: data
        },
        {
          status: response.status
        }
      )
    }

    const saved =
      Array.isArray(data)
        ? data[0]
        : data

    return NextResponse.json(
      normalizeDatabaseRow(saved || row),
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
            : 'Could not save prospect.'
      },
      {
        status: 500
      }
    )
  }
}
