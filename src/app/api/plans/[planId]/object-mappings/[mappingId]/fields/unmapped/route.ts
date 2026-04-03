// 012-field-mapping — GET unmapped source fields for an object mapping

import { NextRequest, NextResponse } from 'next/server'
import { getUnmappedSourceFields, ObjectMappingNotFoundError } from '@/lib/services/field-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

type RouteParams = { params: Promise<{ planId: string; mappingId: string }> }

// GET /api/plans/[planId]/object-mappings/[mappingId]/fields/unmapped
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(mappingId)

    const fields = await getUnmappedSourceFields(mappingId)

    return NextResponse.json({ fields })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /fields/unmapped]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
