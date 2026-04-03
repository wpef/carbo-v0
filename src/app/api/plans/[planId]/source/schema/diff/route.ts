// 003-source-schema-retrieval — Schema diff API route

import { NextRequest, NextResponse } from 'next/server'
import {
  computeDiff,
  getConnectionIdForPlan,
  SchemaConnectionNotFoundError,
} from '@/lib/services/schema-retrieval'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

// GET /api/plans/[planId]/source/schema/diff — Get diff between CURRENT and PREVIOUS snapshots
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const connectionId = await getConnectionIdForPlan(planId, 'source')
    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No source connection for this plan.' },
        { status: 404 },
      )
    }

    const diff = await computeDiff(connectionId, 'source')
    if (diff === null) {
      return NextResponse.json(
        { error: 'NO_PREVIOUS_SNAPSHOT', message: 'No previous snapshot to compare against.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ diff })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof SchemaConnectionNotFoundError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /source/schema/diff]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
