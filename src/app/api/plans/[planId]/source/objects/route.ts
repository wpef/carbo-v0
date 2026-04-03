// 004-source-object-selection — List and bulk-update object selections

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import {
  initDefaultSelection,
  getObjectsWithSelection,
  bulkUpdateSelection,
  SnapshotNotFoundError,
} from '@/lib/services/object-selection'
import { getConnectionIdForPlan } from '@/lib/services/schema-retrieval'
import { PlanNotFoundError } from '@/lib/services/plan-service'

async function resolvePlanAndConnection(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanNotFoundError(planId)

  const connectionId = await getConnectionIdForPlan(planId, 'source')
  if (!connectionId) return { plan, connectionId: null, connection: null, snapshot: null }

  const connection = await prisma.sourceConnection.findUnique({ where: { id: connectionId } })
  if (!connection) return { plan, connectionId, connection: null, snapshot: null }

  const snapshot = await prisma.schemaSnapshot.findFirst({
    where: { connectionId, role: 'source', status: 'CURRENT' },
  })

  return { plan, connectionId, connection, snapshot }
}

// GET /api/plans/[planId]/source/objects
// Returns objects with selection state. Inits defaults on first call.
export async function GET(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const includeSystem = req.nextUrl.searchParams.get('includeSystem') === 'true'

  try {
    const { connection, snapshot } = await resolvePlanAndConnection(planId)

    if (!snapshot) {
      return NextResponse.json(
        { error: 'SNAPSHOT_NOT_FOUND', message: 'No schema snapshot found. Retrieve the schema first.' },
        { status: 404 },
      )
    }

    if (!connection) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No source connection found for this plan.' },
        { status: 404 },
      )
    }

    // Init defaults if none exist yet
    const existingCount = await prisma.objectSelection.count({ where: { snapshotId: snapshot.id } })
    if (existingCount === 0) {
      await initDefaultSelection(snapshot.id, connection.adapterType)
    }

    const result = await getObjectsWithSelection(snapshot.id, connection.adapterType, includeSystem)

    return NextResponse.json({
      snapshotId: snapshot.id,
      ...result,
    })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof SnapshotNotFoundError) {
      return NextResponse.json({ error: 'SNAPSHOT_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /source/objects]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// PUT /api/plans/[planId]/source/objects
// Bulk update selections. Body: { selections: [{objectId, isSelected}] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const body = await req.json()
    const selections: Array<{ objectId: string; isSelected: boolean }> = body.selections ?? []

    if (!Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'selections must be a non-empty array.' },
        { status: 400 },
      )
    }

    await bulkUpdateSelection(selections, planId)

    return NextResponse.json({ updated: selections.length })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[PUT /source/objects]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
