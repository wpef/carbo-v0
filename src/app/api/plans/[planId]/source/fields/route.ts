// 005-source-field-retrieval — POST retrieve fields, GET list grouped fields

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import {
  retrieveFields,
  getFieldsByObject,
  FieldRetrievalConnectionNotFoundError,
  FieldRetrievalSnapshotNotFoundError,
} from '@/lib/services/field-retrieval'
import { getConnectionIdForPlan } from '@/lib/services/schema-retrieval'
import { PlanNotFoundError } from '@/lib/services/plan-service'

// --- Shared resolver ---

async function resolvePlanAndSnapshot(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanNotFoundError(planId)

  const connectionId = await getConnectionIdForPlan(planId, 'source')
  if (!connectionId) return { plan, connectionId: null, snapshot: null }

  const snapshot = await prisma.schemaSnapshot.findFirst({
    where: { connectionId, role: 'source', status: 'CURRENT' },
  })

  return { plan, connectionId, snapshot }
}

// POST /api/plans/[planId]/source/fields
// Trigger field retrieval for all selected objects. Returns 409 if already in progress.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const { connectionId, snapshot } = await resolvePlanAndSnapshot(planId)

    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No source connection found for this plan.' },
        { status: 404 },
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'SNAPSHOT_NOT_FOUND', message: 'No schema snapshot found. Retrieve the schema first.' },
        { status: 404 },
      )
    }

    // Verify at least one object is selected
    const selectedCount = await prisma.objectSelection.count({
      where: { snapshotId: snapshot.id, isSelected: true },
    })

    if (selectedCount === 0) {
      return NextResponse.json(
        { error: 'NO_OBJECTS_SELECTED', message: 'No objects are selected. Select at least one object before retrieving fields.' },
        { status: 422 },
      )
    }

    const result = await retrieveFields(connectionId, snapshot.id, 'source')

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof FieldRetrievalConnectionNotFoundError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof FieldRetrievalSnapshotNotFoundError) {
      return NextResponse.json({ error: 'SNAPSHOT_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[POST /source/fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// GET /api/plans/[planId]/source/fields
// Return fields grouped by object for all selected objects.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const { connectionId, snapshot } = await resolvePlanAndSnapshot(planId)

    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No source connection found for this plan.' },
        { status: 404 },
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'SNAPSHOT_NOT_FOUND', message: 'No schema snapshot found. Retrieve the schema first.' },
        { status: 404 },
      )
    }

    const result = await getFieldsByObject(snapshot.id)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof FieldRetrievalSnapshotNotFoundError) {
      return NextResponse.json({ error: 'SNAPSHOT_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /source/fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
