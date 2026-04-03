// 017-mapping-integrity-check — GET (check) + POST (repair) integrity for a plan

import { NextRequest, NextResponse } from 'next/server'
import { checkMappingIntegrity, repairBrokenMappings } from '@/lib/services/mapping-integrity'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

type RouteParams = { params: Promise<{ planId: string }> }

// GET /api/plans/[planId]/integrity
// Returns an IntegrityReport showing broken object/field mappings and type changes.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const report = await checkMappingIntegrity(planId)

    return NextResponse.json(report)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /integrity]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// POST /api/plans/[planId]/integrity
// Triggers a repair: deletes broken mappings and updates plan status.
// Returns a RepairResult.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const result = await repairBrokenMappings(planId)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[POST /integrity]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
