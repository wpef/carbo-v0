// 004-source-object-selection — GET /source/objects (list + summary) and PUT (bulk save)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getObjectsWithSelection, saveSelections } from '@/features/schema/services/object-selection-service'
import { getAdapterMetadata } from '@/lib/adapters/metadata'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: { sourceConnection: true },
  })
  if (!plan?.sourceConnectionId || !plan.sourceConnection) {
    return NextResponse.json({ error: 'NO_SOURCE_CONNECTION' }, { status: 404 })
  }

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
  })
  if (!snapshot) {
    return NextResponse.json({ error: 'NO_CURRENT_SNAPSHOT' }, { status: 404 })
  }

  const meta = getAdapterMetadata(plan.sourceConnection.adapterType)
  const result = await getObjectsWithSelection(
    plan.sourceConnectionId,
    snapshot.id,
    meta.commonBusinessObjects,
    meta.systemObjectPrefixes,
    planId,
  )

  return NextResponse.json({
    ...result,
    summary: {
      selectedCount: result.summary.selected,
      totalCount: result.summary.total,
      orphanedCount: 0,
    },
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const body = await request.json()

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })
  if (!plan?.sourceConnectionId) {
    return NextResponse.json({ error: 'NO_SOURCE_CONNECTION' }, { status: 404 })
  }

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
  })
  if (!snapshot) {
    return NextResponse.json({ error: 'NO_CURRENT_SNAPSHOT' }, { status: 404 })
  }

  const selections = body.selections as { objectApiName: string; isSelected: boolean }[] | undefined
  if (!Array.isArray(selections) || selections.length === 0) {
    return NextResponse.json({ error: 'INVALID_PAYLOAD', details: 'selections must be a non-empty array' }, { status: 400 })
  }

  const summary = await saveSelections(planId, plan.sourceConnectionId, snapshot.id, selections)

  return NextResponse.json({
    updated: selections.length,
    summary: {
      selectedCount: summary.selected,
      totalCount: summary.total,
      orphanedCount: 0,
    },
  })
}
