// 012-field-mapping — DELETE field mapping by ID

import { NextRequest, NextResponse } from 'next/server'
import { deleteFieldMapping, FieldMappingNotFoundError, ObjectMappingNotFoundError } from '@/lib/services/field-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

type RouteParams = { params: Promise<{ planId: string; mappingId: string; fieldMappingId: string }> }

// DELETE /api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId, fieldMappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(mappingId)

    await deleteFieldMapping(fieldMappingId)

    return NextResponse.json({ deleted: true })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof FieldMappingNotFoundError) {
      return NextResponse.json({ error: 'FIELD_MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[DELETE /fields/:fieldMappingId]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
