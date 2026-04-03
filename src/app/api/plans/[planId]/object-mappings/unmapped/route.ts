// 011-object-mapping — GET unmapped source objects for a plan

import { NextRequest, NextResponse } from 'next/server'
import { getUnmappedSourceObjects } from '@/lib/services/object-mapping'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// GET /api/plans/[planId]/object-mappings/unmapped
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objects = await getUnmappedSourceObjects(planId)
    return NextResponse.json({ objects })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /object-mappings/unmapped]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
