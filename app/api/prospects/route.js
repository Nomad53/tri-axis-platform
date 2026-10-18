import { NextResponse } from 'next/server'
import { getProspects } from '../../../lib/prospects'

export async function GET() {
  const prospects = await getProspects()
  return NextResponse.json(prospects)
}
