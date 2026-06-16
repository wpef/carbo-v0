// 012-field-mapping — GET list + POST create/auto-match + DELETE
import { NextRequest, NextResponse } from 'next/server'
import {
  listFieldMappings,
  createFieldMapping,
  autoMatchFields,
  deleteFieldMapping,
  getUnmappedSourceFields,
  getAvailableDestFields,
  DuplicateFieldMappingError,
  ObjectMappingNotFoundError,
  FieldMappingNotFoundError,
} from '@/features/field-mapping/services/field-mapping-service'

type RouteParams = { params: Promise<{ planId: string; mappingId: string }> }

// GET /api/plans/[planId]/object-mappings/[mappingId]/field-mappings
// Returns fieldMappings (with linkStatus) + availableDestFields + unmappedSourceFields.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params
  try {
    const [fieldMappings, availableDestFields, unmappedSourceFields] = await Promise.all([
      listFieldMappings(mappingId),
      getAvailableDestFields(mappingId),
      getUnmappedSourceFields(mappingId),
    ])
    return NextResponse.json({ fieldMappings, availableDestFields, unmappedSourceFields })
  } catch (err) {
    console.error('[GET /field-mappings]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/object-mappings/[mappingId]/field-mappings
// Body: { autoMatch: true }  →  trigger auto-match
// Body: { sourceFieldName, destinationFieldName, sourceFieldType?, destFieldType? }  →  create
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params
  const body = await req.json()

  if (body.autoMatch) {
    try {
      const result = await autoMatchFields(planId, mappingId)
      return NextResponse.json(result, { status: 201 })
    } catch (err) {
      if (err instanceof ObjectMappingNotFoundError) {
        return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
      }
      const msg = err instanceof Error ? err.message : 'Auto-match failed'
      return NextResponse.json({ error: 'AUTO_MATCH_FAILED', message: msg }, { status: 400 })
    }
  }

  const { sourceFieldName, destinationFieldName, sourceFieldType, destFieldType } = body
  if (!sourceFieldName || !destinationFieldName) {
    return NextResponse.json(
      { error: 'INVALID_INPUT', message: 'sourceFieldName and destinationFieldName are required.' },
      { status: 400 },
    )
  }

  try {
    const fieldMapping = await createFieldMapping(planId, mappingId, {
      sourceFieldName,
      destinationFieldName,
      sourceFieldType,
      destFieldType,
    })
    return NextResponse.json({ fieldMapping }, { status: 201 })
  } catch (err) {
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof DuplicateFieldMappingError) {
      return NextResponse.json({ error: 'DUPLICATE_FIELD_MAPPING', message: err.message }, { status: 409 })
    }
    console.error('[POST /field-mappings]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]/object-mappings/[mappingId]/field-mappings?fieldMappingId=…
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { planId } = await params
  const url = new URL(req.url)
  const fieldMappingId = url.searchParams.get('fieldMappingId')
  if (!fieldMappingId) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'fieldMappingId query param required' }, { status: 400 })
  }

  try {
    await deleteFieldMapping(planId, fieldMappingId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof FieldMappingNotFoundError) {
      return NextResponse.json({ error: 'NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[DELETE /field-mappings]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
