// Alias for /api/plans/[planId]/[side]/records/[objectApiName] — source side only.
// Used by MigrationPreviewPanel to fetch source records for the preview.
import { NextResponse } from 'next/server'
import { fetchRecordPage } from '@/features/schema/services/record-preview-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string; objectApiName: string }> },
) {
  const { planId, objectApiName } = await params
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '25', 10)

  try {
    const records = await fetchRecordPage(planId, 'SOURCE', objectApiName, page, pageSize)
    return NextResponse.json(records)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Record fetch failed'
    return NextResponse.json({ error: msg, records: [] }, { status: 502 })
  }
}
