// 003-source-schema-retrieval — Live drift API route (FR-012, Cluster 11)
// GET /api/plans/[planId]/source/schema/diff
//
// Returns a DriftReport comparing the stored CURRENT snapshot to the live
// schema fetched from the adapter right now.
// status 200  → DriftReport (status ok | drift | unavailable)
// status 404  → plan not found
// status 500  → unexpected server error

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { detectLiveDrift } from '@/features/schema/services/drift-service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { id: true },
  })
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan ${planId} not found` }, { status: 404 })
  }

  try {
    const report = await detectLiveDrift(planId, 'source')
    // Always 200 — callers inspect report.status ('ok' | 'drift' | 'unavailable')
    return NextResponse.json(report)
  } catch (err) {
    console.error('[GET /source/schema/diff]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
