// 003-source-schema-retrieval — Source schema API route

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

// POST /api/plans/[planId]/source/schema — Retrieve (refresh) schema
export async function POST(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    await resolvePlan(planId)

    const connectionId = await getConnectionIdForPlan(planId, 'source')
    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No source connection for this plan.' },
        { status: 404 },
      )
    }

    const status = await getConnectionStatusForPlan(planId, 'source')
    if (status !== 'CONNECTED') {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_CONNECTED', message: 'Source connection is not in CONNECTED status.' },
        { status: 400 },
      )
    }

    const snapshot = await retrieveSchema(connectionId, 'source')
    const diff = await computeDiff(connectionId, 'source')

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
    console.error('[POST /source/schema]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// GET /api/plans/[planId]/source/schema — Get current snapshot
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  try {
    await resolvePlan(planId)

    const connectionId = await getConnectionIdForPlan(planId, 'source')
    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No source connection for this plan.' },
        { status: 404 },
      )
    }

    const snapshot = await getSnapshot(connectionId, 'source', 'CURRENT')
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
    console.error('[GET /source/schema]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
