// 012-field-mapping — POST trigger field auto-matching for an object mapping

import { NextRequest, NextResponse } from 'next/server'
import { autoMatchFields, ObjectMappingNotFoundError } from '@/lib/services/field-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

type RouteParams = { params: Promise<{ planId: string; mappingId: string }> }

// POST /api/plans/[planId]/object-mappings/[mappingId]/fields/auto-match
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(mappingId)

    const result = await autoMatchFields(mappingId)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[POST /fields/auto-match]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
