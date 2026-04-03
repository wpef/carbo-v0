// 007-destination-schema-retrieval — Destination schema API route

import { NextRequest, NextResponse } from 'next/server'
import {
  retrieveSchema,
  getSnapshot,
  computeDiff,
  getConnectionIdForPlan,
  getConnectionStatusForPlan,
  SchemaConnectionNotFoundError,
  SchemaConnectionNotConnectedError,
} from '@/lib/services/schema-retrieval'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'

async function resolvePlan(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanNotFoundError(planId)
  return plan
}

// POST /api/plans/[planId]/destination-schema — Retrieve (refresh) destination schema
export async function POST(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    await resolvePlan(planId)

    const connectionId = await getConnectionIdForPlan(planId, 'destination')
    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No destination connection for this plan.' },
        { status: 404 },
      )
    }

    const status = await getConnectionStatusForPlan(planId, 'destination')
    if (status !== 'CONNECTED') {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_CONNECTED', message: 'Destination connection is not in CONNECTED status.' },
        { status: 400 },
      )
    }

    const snapshot = await retrieveSchema(connectionId, 'destination')
    const diff = await computeDiff(connectionId, 'destination')

    return NextResponse.json(
      {
        snapshot: {
          id: snapshot.id,
          connectionId: snapshot.connectionId,
          role: snapshot.role,
          status: snapshot.status,
          objectCount: snapshot.objectCount,
          retrievedAt: snapshot.retrievedAt,
        },
        objects: snapshot.objects,
        diff,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof SchemaConnectionNotFoundError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof SchemaConnectionNotConnectedError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_CONNECTED', message: err.message }, { status: 400 })
    }
    console.error('[POST /destination-schema]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// GET /api/plans/[planId]/destination-schema — Get current destination snapshot
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    await resolvePlan(planId)

    const connectionId = await getConnectionIdForPlan(planId, 'destination')
    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No destination connection for this plan.' },
        { status: 404 },
      )
    }

    const snapshot = await getSnapshot(connectionId, 'destination', 'CURRENT')
    if (!snapshot) {
      return NextResponse.json(
        { error: 'SNAPSHOT_NOT_FOUND', message: 'No schema snapshot found. Retrieve the schema first.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        connectionId: snapshot.connectionId,
        role: snapshot.role,
        status: snapshot.status,
        objectCount: snapshot.objectCount,
        retrievedAt: snapshot.retrievedAt,
      },
      objects: snapshot.objects,
    })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /destination-schema]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
