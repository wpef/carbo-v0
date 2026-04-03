// 004-source-object-selection — Toggle single object selection

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { updateSelection, ObjectSelectionNotFoundError } from '@/lib/services/object-selection'
import { PlanNotFoundError } from '@/lib/services/plan-service'

// PATCH /api/plans/[planId]/source/objects/[objectId]
// Toggle selection for a single object. Body: { isSelected: boolean }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; objectId: string }> },
) {
  const { planId, objectId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const body = await req.json()
    if (typeof body.isSelected !== 'boolean') {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'isSelected must be a boolean.' },
        { status: 400 },
      )
    }

    const result = await updateSelection(objectId, body.isSelected, planId)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectSelectionNotFoundError) {
      return NextResponse.json({ error: 'OBJECT_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[PATCH /source/objects/:objectId]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
