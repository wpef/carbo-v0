// 011-object-mapping — DELETE object mapping by ID

import { NextRequest, NextResponse } from 'next/server'
import { deleteObjectMapping, ObjectMappingNotFoundError } from '@/lib/services/object-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// DELETE /api/plans/[planId]/object-mappings/[mappingId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    await deleteObjectMapping(planId, mappingId)

    return NextResponse.json({ deleted: true })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[DELETE /object-mappings/:id]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
