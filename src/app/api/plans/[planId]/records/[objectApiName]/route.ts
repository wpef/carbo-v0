// 009-record-preview — GET /api/plans/[planId]/records/[objectApiName]
// Query params: role=source|destination, page=1, pageSize=25

import { NextRequest, NextResponse } from 'next/server'
import {
  getRecordPreview,
  RecordPreviewPlanNotFoundError,
  RecordPreviewConnectionNotFoundError,
  RecordPreviewConnectionNotConnectedError,
} from '@/lib/services/record-preview.service'
import { UnknownAdapterError } from '@/lib/connectors/adapter-factory'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; objectApiName: string }> },
) {
  const { planId, objectApiName } = await params
  const { searchParams } = req.nextUrl

  // Validate role
  const role = searchParams.get('role')
  if (role !== 'source' && role !== 'destination') {
    return NextResponse.json(
      { error: 'INVALID_PARAMS', message: 'Query param "role" must be "source" or "destination".' },
      { status: 400 },
    )
  }

  // Validate page
  const rawPage = searchParams.get('page') ?? '1'
  const page = parseInt(rawPage, 10)
  if (isNaN(page) || page < 1) {
    return NextResponse.json(
      { error: 'INVALID_PARAMS', message: 'Query param "page" must be a positive integer.' },
      { status: 400 },
    )
  }

  // Validate pageSize
  const rawPageSize = searchParams.get('pageSize') ?? '25'
  const pageSize = parseInt(rawPageSize, 10)
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: 'INVALID_PARAMS', message: 'Query param "pageSize" must be between 1 and 100.' },
      { status: 400 },
    )
  }

  try {
    const result = await getRecordPreview(planId, role, objectApiName, page, pageSize)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof RecordPreviewPlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof RecordPreviewConnectionNotFoundError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof RecordPreviewConnectionNotConnectedError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_CONNECTED', message: err.message }, { status: 409 })
    }
    if (err instanceof UnknownAdapterError) {
      return NextResponse.json({ error: 'UNKNOWN_ADAPTER', message: err.message }, { status: 400 })
    }
    console.error('[GET /api/plans/:planId/records/:objectApiName]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
