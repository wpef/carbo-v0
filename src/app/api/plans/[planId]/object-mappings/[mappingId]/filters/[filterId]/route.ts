// 015-migration-filters — PATCH update + DELETE filter by ID

import { NextRequest, NextResponse } from 'next/server'
import {
  updateFilter,
  deleteFilter,
  FilterNotFoundError,
  InvalidFilterOperatorError,
} from '@/lib/services/migration-filter'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// PATCH /api/plans/[planId]/object-mappings/[mappingId]/filters/[filterId]
// Body: { operator?, value?, isActive? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; mappingId: string; filterId: string }> },
) {
  const { planId, filterId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const body = await req.json()
    const { operator, value, isActive } = body

    const filter = await updateFilter(filterId, { operator, value, isActive })
    return NextResponse.json({ filter })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof FilterNotFoundError) {
      return NextResponse.json({ error: 'FILTER_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof InvalidFilterOperatorError) {
      return NextResponse.json({ error: 'INVALID_OPERATOR', message: err.message }, { status: 400 })
    }
    console.error('[PATCH /filters/:id]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]/object-mappings/[mappingId]/filters/[filterId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; mappingId: string; filterId: string }> },
) {
  const { planId, filterId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    await deleteFilter(filterId)
    return NextResponse.json({ deleted: true })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof FilterNotFoundError) {
      return NextResponse.json({ error: 'FILTER_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[DELETE /filters/:id]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
