import { NextResponse } from 'next/server'
import { listFieldMappings, createFieldMapping, autoMatchFields, deleteFieldMapping } from '@/features/field-mapping/services/field-mapping-service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { mappingId } = await params
  const mappings = await listFieldMappings(mappingId)
  return NextResponse.json(mappings)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params
  const body = await request.json()

  if (body.autoMatch) {
    try {
      const result = await autoMatchFields(planId, mappingId)
      return NextResponse.json(result, { status: 201 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Auto-match failed'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  if (!body.sourceFieldName || !body.destinationFieldName) {
    return NextResponse.json({ error: 'sourceFieldName and destinationFieldName required' }, { status: 400 })
  }

  try {
    const mapping = await createFieldMapping(
      planId,
      mappingId,
      body.sourceFieldName,
      body.destinationFieldName,
      body.sourceType ?? 'string',
      body.destType ?? 'string',
    )
    return NextResponse.json(mapping, { status: 201 })
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
  const fieldMappingId = url.searchParams.get('fieldMappingId')
  if (!fieldMappingId) {
    return NextResponse.json({ error: 'fieldMappingId query param required' }, { status: 400 })
  }

  try {
    await deleteFieldMapping(planId, fieldMappingId)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
