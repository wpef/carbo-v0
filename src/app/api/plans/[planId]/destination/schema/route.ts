import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSchemaSnapshot, fetchAndStoreSchema } from '@/features/schema/services/schema-service'
import { computePersistedDrift } from '@/features/schema/services/drift-service'
import { checkAndUpdatePlanStatus } from '@/features/integrity/services/integrity-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { destinationConnectionId: true },
  })
  if (!plan?.destinationConnectionId) return NextResponse.json(null)

  const snapshot = await getSchemaSnapshot(plan.destinationConnectionId, 'DESTINATION')
  return NextResponse.json(snapshot)
}

export async function POST(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { destinationConnection: true },
  })
  if (!plan.destinationConnection) {
    return NextResponse.json({ error: 'No destination connection' }, { status: 400 })
  }

  try {
    const snapshot = await fetchAndStoreSchema(planId, plan.destinationConnection.id, plan.destinationConnection.adapterType, 'DESTINATION')

    // Cluster 2 — re-run integrity after a destination schema refresh (mirror of source). Non-fatal.
    await checkAndUpdatePlanStatus(planId).catch((err) => {
      console.warn('[destination/schema/POST] checkAndUpdatePlanStatus failed (non-fatal):', err)
    })

    // Cluster 11 / 003 FR-006 — diff the rotated snapshots (PREVIOUS → new CURRENT)
    // so the caller can render "what changed in this refresh". Mirror of source. Non-fatal.
    const driftReport = await computePersistedDrift(planId, 'destination').catch((err) => {
      console.warn('[destination/schema/POST] computePersistedDrift failed (non-fatal):', err)
      return null
    })

    return NextResponse.json({ snapshot, driftReport }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Schema fetch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
