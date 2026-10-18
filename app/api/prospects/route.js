import { NextResponse } from 'next/server'
import { getProspects } from '../../../lib/prospects'

export async function GET() {
  return NextResponse.json(getProspects())
}
