import { NextResponse } from 'next/server'
import { listFilters, createFilter, deleteFilter } from '@/features/field-mapping/services/filter-service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { mappingId } = await params
  const filters = await listFilters(mappingId)
  return NextResponse.json(filters)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params
  const body = await request.json()

  if (!body.fieldApiName || !body.operator) {
    return NextResponse.json({ error: 'fieldApiName and operator required' }, { status: 400 })
  }

  try {
    const filter = await createFilter(planId, mappingId, body.fieldApiName, body.operator, body.value)
    return NextResponse.json(filter, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Creation failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId } = await params
  const url = new URL(request.url)
  const filterId = url.searchParams.get('filterId')
  if (!filterId) {
    return NextResponse.json({ error: 'filterId query param required' }, { status: 400 })
  }

  try {
    await deleteFilter(planId, filterId)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
