// 012-field-mapping — GET list + POST create field mappings

import { NextRequest, NextResponse } from 'next/server'
import {
  listFieldMappings,
  createFieldMapping,
  getAvailableDestFields,
  DuplicateFieldMappingError,
  ObjectMappingNotFoundError,
} from '@/lib/services/field-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

type RouteParams = { params: Promise<{ planId: string; mappingId: string }> }

// GET /api/plans/[planId]/object-mappings/[mappingId]/fields
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(mappingId)

    const [fieldMappings, availableDestFields] = await Promise.all([
      listFieldMappings(mappingId),
      getAvailableDestFields(mappingId),
    ])

    return NextResponse.json({ fieldMappings, availableDestFields })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/object-mappings/[mappingId]/fields
// Body: { sourceFieldId, sourceFieldApiName, destFieldId, destFieldApiName }
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(mappingId)

    const body = await req.json()
    const { sourceFieldId, sourceFieldApiName, destFieldId, destFieldApiName } = body

    if (!sourceFieldId || !sourceFieldApiName || !destFieldId || !destFieldApiName) {
      return NextResponse.json(
        {
          error: 'INVALID_INPUT',
          message: 'sourceFieldId, sourceFieldApiName, destFieldId, and destFieldApiName are required.',
        },
        { status: 400 },
      )
    }

    const fieldMapping = await createFieldMapping(mappingId, {
      sourceFieldId,
      sourceFieldApiName,
      destFieldId,
      destFieldApiName,
    })

    return NextResponse.json({ fieldMapping }, { status: 201 })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof DuplicateFieldMappingError) {
      return NextResponse.json({ error: 'DUPLICATE_FIELD_MAPPING', message: err.message }, { status: 409 })
    }
    console.error('[POST /fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
