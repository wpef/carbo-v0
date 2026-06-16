// 011-object-mapping — T008: GET /api/plans/[planId]/object-mappings/[mappingId]/stats
// Returns ObjectMappingWithStats for the detail modal (A3).

import { NextResponse } from 'next/server'
import { getMappingStats } from '@/features/object-mapping/services/object-mapping-service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params
  try {
    const stats = await getMappingStats(planId, mappingId)
    return NextResponse.json({ stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stats fetch failed'
    // Distinguish not-found from other errors
    if (msg.includes('not found') || msg.includes('No ')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
