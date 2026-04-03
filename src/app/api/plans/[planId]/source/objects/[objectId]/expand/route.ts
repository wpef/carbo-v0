// 004-source-object-selection — Expand object with fields + sample records

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { expandObject } from '@/lib/services/object-selection'
import { getConnectionIdForPlan } from '@/lib/services/schema-retrieval'
import { PlanNotFoundError } from '@/lib/services/plan-service'

// GET /api/plans/[planId]/source/objects/[objectId]/expand
// Returns record count, fields, and sample records for a given object
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; objectId: string }> },
) {
  const { planId, objectId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const connectionId = await getConnectionIdForPlan(planId, 'source')
    if (!connectionId) {
      return NextResponse.json(
        { error: 'CONNECTION_NOT_FOUND', message: 'No source connection found for this plan.' },
        { status: 404 },
      )
    }

    // Resolve objectId -> apiName from DB
    const obj = await prisma.schemaObject.findUnique({ where: { id: objectId } })
    if (!obj) {
      return NextResponse.json(
        { error: 'OBJECT_NOT_FOUND', message: `Object not found: ${objectId}` },
        { status: 404 },
      )
    }

    const result = await expandObject(connectionId, obj.apiName)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /source/objects/:objectId/expand]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
