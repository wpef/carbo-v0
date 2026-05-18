import { NextResponse } from 'next/server'
import { fetchRecordPage, fetchRecordCount, fetchFieldStats } from '@/features/schema/services/record-preview-service'
import type { SnapshotSide } from '@prisma/client'

function parseSide(side: string): SnapshotSide | null {
  const upper = side.toUpperCase()
  if (upper === 'SOURCE' || upper === 'DESTINATION') return upper as SnapshotSide
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string; side: string; objectApiName: string }> },
) {
  const { planId, side, objectApiName } = await params
  const snapshotSide = parseSide(side)
  if (!snapshotSide) {
    return NextResponse.json({ error: 'Invalid side (use source or destination)' }, { status: 400 })
  }

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10)
  const includeCount = url.searchParams.get('includeCount') === 'true'
  const includeStats = url.searchParams.get('includeStats') === 'true'

  try {
    const records = await fetchRecordPage(planId, snapshotSide, objectApiName, page, pageSize)

    let totalCount: number | undefined
    if (includeCount) {
      totalCount = await fetchRecordCount(planId, snapshotSide, objectApiName)
    }

    let stats
    if (includeStats && records.records.length > 0) {
      const fieldNames = Object.keys(records.records[0])
      stats = await fetchFieldStats(planId, snapshotSide, objectApiName, fieldNames)
    }

    return NextResponse.json({ ...records, totalCount, stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Record fetch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
