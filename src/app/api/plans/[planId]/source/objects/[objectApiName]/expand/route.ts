// 004-source-object-selection — GET /source/objects/[objectApiName]/expand
// Returns record count, fields, and 3–5 sample records on-demand (FR-005).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { expandObject } from '@/features/schema/services/record-preview-service'

const EXPAND_TIMEOUT_MS = 30_000

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; objectApiName: string }> },
) {
  const { planId, objectApiName } = await params

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })
  if (!plan?.sourceConnectionId) {
    return NextResponse.json({ error: 'NO_SOURCE_CONNECTION' }, { status: 404 })
  }

  // Verify object exists in CURRENT snapshot
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
    select: { id: true },
  })
  if (!snapshot) {
    return NextResponse.json({ error: 'NO_CURRENT_SNAPSHOT' }, { status: 404 })
  }
  const obj = await prisma.schemaObject.findUnique({
    where: { snapshotId_apiName: { snapshotId: snapshot.id, apiName: objectApiName } },
    select: { id: true },
  })
  if (!obj) {
    return NextResponse.json({ error: 'OBJECT_NOT_FOUND', objectApiName }, { status: 404 })
  }

  const startMs = Date.now()
  console.log(`[expand] start ${objectApiName}`)

  try {
    const result = await Promise.race([
      expandObject(planId, 'SOURCE', objectApiName),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('EXPAND_TIMEOUT')), EXPAND_TIMEOUT_MS),
      ),
    ])

    console.log(`[expand] done ${objectApiName} in ${Date.now() - startMs}ms`)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    if (msg === 'EXPAND_TIMEOUT') {
      return NextResponse.json({ error: 'EXPAND_TIMEOUT', objectApiName }, { status: 504 })
    }
    console.error(`[expand] error ${objectApiName}:`, err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: msg }, { status: 500 })
  }
}
