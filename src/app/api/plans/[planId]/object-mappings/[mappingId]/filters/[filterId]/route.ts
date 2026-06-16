// 015-migration-filters — PATCH update (+ toggle isActive) + DELETE filter by ID

import { NextResponse } from 'next/server'
import {
  updateFilter,
  deleteFilter,
  FilterNotFoundError,
  InvalidFilterOperatorError,
} from '@/features/filters/services/filter-service'
import { prisma } from '@/lib/prisma'

// PATCH /api/plans/[planId]/object-mappings/[mappingId]/filters/[filterId]
// Body: { operator?, value?, isActive? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string; filterId: string }> },
) {
  const { planId, filterId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan introuvable.' }, { status: 404 })
    }

    const body = await request.json()
    const { operator, value, isActive } = body

    const filter = await updateFilter(filterId, { operator, value, isActive })
    return NextResponse.json(filter)
  } catch (err) {
    if (err instanceof FilterNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof InvalidFilterOperatorError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[PATCH /filters/:id]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}

// DELETE /api/plans/[planId]/object-mappings/[mappingId]/filters/[filterId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string; filterId: string }> },
) {
  const { planId, filterId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan introuvable.' }, { status: 404 })
    }

    await deleteFilter(filterId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof FilterNotFoundError) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 })
    }
    console.error('[DELETE /filters/:id]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}
