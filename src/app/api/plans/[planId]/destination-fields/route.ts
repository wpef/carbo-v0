// 008-destination-field-retrieval — POST retrieve destination fields, GET list grouped by object

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

  const connectionId = await getConnectionIdForPlan(planId, 'destination')
  if (!connectionId) return { plan, connectionId: null, snapshot: null }

  const snapshot = await prisma.schemaSnapshot.findFirst({
    where: { connectionId, role: 'destination', status: 'CURRENT' },
  })

  return { plan, connectionId, snapshot }
}

// POST /api/plans/[planId]/destination-fields
// Trigger field retrieval for all destination objects. Returns 201 with retrieval result.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const { connectionId, snapshot } = await resolvePlanAndSnapshot(planId)

    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No destination connection found for this plan.' },
        { status: 404 },
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'SNAPSHOT_NOT_FOUND', message: 'No destination schema snapshot found. Retrieve the destination schema first.' },
        { status: 404 },
      )
    }

    const result = await retrieveFields(connectionId, snapshot.id, 'destination')

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
    console.error('[POST /destination-fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// GET /api/plans/[planId]/destination-fields
// Return persisted fields grouped by object. Supports optional ?object= query param.
export async function GET(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    const { connectionId, snapshot } = await resolvePlanAndSnapshot(planId)

    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No destination connection found for this plan.' },
        { status: 404 },
      )
    }

    if (!snapshot) {
      return NextResponse.json(
        { error: 'SNAPSHOT_NOT_FOUND', message: 'No destination schema snapshot found. Retrieve the destination schema first.' },
        { status: 404 },
      )
    }

    const result = await getFieldsByObject(snapshot.id)

    // Optional filter by ?object= query param
    const objectFilter = req.nextUrl.searchParams.get('object')
    if (objectFilter) {
      const filtered = result.objects.filter((o) => o.objectApiName === objectFilter)
      const filteredTotalFields = filtered.reduce((sum, o) => sum + o.fieldCount, 0)
      return NextResponse.json({
        ...result,
        objects: filtered,
        summary: {
          objectCount: filtered.length,
          totalFields: filteredTotalFields,
          inaccessibleFields: filtered.reduce(
            (sum, o) => sum + o.fields.filter((f) => !f.isAccessible).length,
            0,
          ),
        },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof FieldRetrievalSnapshotNotFoundError) {
      return NextResponse.json({ error: 'SNAPSHOT_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /destination-fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
