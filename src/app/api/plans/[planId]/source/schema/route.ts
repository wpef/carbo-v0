import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSchemaSnapshot, fetchAndStoreSchema } from '@/features/schema/services/schema-service'
import { detectLiveDrift } from '@/features/schema/services/drift-service'
import { checkAndUpdatePlanStatus } from '@/features/integrity/services/integrity-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })
  if (!plan?.sourceConnectionId) return NextResponse.json(null)

  const snapshot = await getSchemaSnapshot(plan.sourceConnectionId, 'SOURCE')
  return NextResponse.json(snapshot)
}

export async function POST(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { sourceConnection: true },
  })
  if (!plan.sourceConnection) {
    return NextResponse.json({ error: 'No source connection' }, { status: 400 })
  }

  try {
    const snapshot = await fetchAndStoreSchema(planId, plan.sourceConnection.id, plan.sourceConnection.adapterType, 'SOURCE')

    // Cluster 2 — re-run the integrity check after a schema refresh so the plan flips to/from
    // BROKEN (and IntegrityIssues are re-created or auto-resolved) when an object/field a mapping
    // depends on appears or disappears. v3 did this after every refresh (003 FR-011 / 007 FR-005);
    // v4 had dropped it. Non-fatal.
    await checkAndUpdatePlanStatus(planId).catch((err) => {
      console.warn('[schema/POST] checkAndUpdatePlanStatus failed (non-fatal):', err)
    })

    // Cluster 11 — run drift detection immediately after a schema refresh so the
    // caller gets both the fresh snapshot and the DriftReport in one round-trip.
    // The drift check is non-fatal: if it fails, the snapshot is still returned.
    const driftReport = await detectLiveDrift(planId, 'source').catch((err) => {
      console.warn('[schema/POST] detectLiveDrift failed (non-fatal):', err)
      return null
    })

    return NextResponse.json({ snapshot, driftReport }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Schema fetch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
