// 011-object-mapping — POST trigger auto-linking

import { NextRequest, NextResponse } from 'next/server'
import { autoLink, PlanConfigError } from '@/lib/services/object-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// POST /api/plans/[planId]/object-mappings/auto-link
export async function POST(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const result = await autoLink(planId)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof PlanConfigError) {
      return NextResponse.json({ error: 'PLAN_CONFIG_ERROR', message: err.message }, { status: 422 })
    }
    console.error('[POST /object-mappings/auto-link]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
