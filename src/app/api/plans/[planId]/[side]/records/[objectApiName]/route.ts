// 009-record-preview — GET /api/plans/[planId]/[side]/records/[objectApiName]
// Query params: page (1-indexed, default 1), pageSize (25|50|100, default 50)

import { NextResponse } from 'next/server'
import {
  fetchRecordPage,
  RecordPreviewPlanNotFoundError,
  RecordPreviewConnectionNotFoundError,
  RecordPreviewConnectionNotConnectedError,
} from '@/features/schema/services/record-preview-service'
import type { SnapshotSide } from '@prisma/client'

const ALLOWED_PAGE_SIZES = [25, 50, 100]

function parseSide(raw: string): SnapshotSide | null {
  const upper = raw.toUpperCase()
  if (upper === 'SOURCE' || upper === 'DESTINATION') return upper as SnapshotSide
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string; side: string; objectApiName: string }> },
) {
  const { planId, side: sideRaw, objectApiName } = await params

  const snapshotSide = parseSide(sideRaw)
  if (!snapshotSide) {
    return NextResponse.json(
      { error: "Invalid side parameter. Must be 'source' or 'destination'" },
      { status: 400 },
    )
  }

  const url = new URL(request.url)
  const rawPage = url.searchParams.get('page') ?? '1'
  const page = parseInt(rawPage, 10)
  if (isNaN(page) || page < 1) {
    return NextResponse.json({ error: 'Invalid page number. Must be >= 1' }, { status: 400 })
  }

  const rawPageSize = url.searchParams.get('pageSize') ?? '50'
  const pageSize = parseInt(rawPageSize, 10)
  if (!ALLOWED_PAGE_SIZES.includes(pageSize)) {
    return NextResponse.json(
      { error: `Invalid page size. Allowed values: ${ALLOWED_PAGE_SIZES.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const result = await fetchRecordPage(planId, snapshotSide, objectApiName, page, pageSize)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof RecordPreviewPlanNotFoundError) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    if (err instanceof RecordPreviewConnectionNotFoundError) {
      return NextResponse.json(
        { error: `No ${sideRaw.toLowerCase()} connection found for this plan` },
        { status: 404 },
      )
    }
    if (err instanceof RecordPreviewConnectionNotConnectedError) {
      return NextResponse.json({ error: 'Connection is not in CONNECTED status' }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : 'Failed to fetch records from connector'
    console.error(`[GET /[side]/records/${objectApiName}]`, err)
    return NextResponse.json({ error: 'Failed to fetch records from connector', details: msg }, { status: 502 })
  }
}
