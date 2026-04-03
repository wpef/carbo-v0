// 016-unmapped-fields-detection — GET unmapped fields report for a plan

import { NextRequest, NextResponse } from 'next/server'
import { detectUnmappedFields } from '@/lib/services/unmapped-fields'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

type RouteParams = { params: Promise<{ planId: string }> }

// GET /api/plans/[planId]/unmapped-fields
// Returns a full UnmappedFieldsReport for the plan: unmapped source and dest fields per object mapping.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const report = await detectUnmappedFields(planId)

    return NextResponse.json(report)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /unmapped-fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
