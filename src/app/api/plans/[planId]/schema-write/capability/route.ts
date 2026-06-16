// 022-schema-write — GET /api/plans/[planId]/schema-write/capability
// Returns canWriteSchema + supportedFieldTypes for the plan's destination adapter (FR-001).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCapability } from '@/features/schema-write/services'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: { destinationConnection: true },
  })
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }
  if (!plan.destinationConnection) {
    return NextResponse.json(
      { error: 'NO_DESTINATION', message: 'No destination connection configured for this plan' },
      { status: 404 },
    )
  }

  try {
    const capability = await checkCapability(plan.destinationConnection.id, plan.destinationConnection.adapterType)
    return NextResponse.json(capability)
  } catch (err) {
    console.error('[GET /schema-write/capability]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 })
  }
}
