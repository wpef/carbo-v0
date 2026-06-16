// 016-unmapped-fields-detection — GET plan-level unmapped fields report
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUnmappedFieldsForPlan } from '@/features/unmapped/services/unmapped-service'

type RouteParams = { params: Promise<{ planId: string }> }

// GET /api/plans/[planId]/unmapped-fields
// Returns plan-level aggregate: unmapped source + required dest fields per object mapping.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
    }

    const report = await getUnmappedFieldsForPlan(planId)
    return NextResponse.json(report)
  } catch (err) {
    console.error('[GET /unmapped-fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
