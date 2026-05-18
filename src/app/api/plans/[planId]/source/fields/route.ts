import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { retrieveFieldsForObjects, getFieldsByObject } from '@/features/schema/services/field-retrieval-service'
import { getSelectedObjectNames } from '@/features/schema/services/object-selection-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })
  if (!plan?.sourceConnectionId) return NextResponse.json({})

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
  })
  if (!snapshot) return NextResponse.json({})

  const fields = await getFieldsByObject(snapshot.id)
  return NextResponse.json(fields)
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

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnection.id, side: 'SOURCE', status: 'CURRENT' } },
  })
  if (!snapshot) {
    return NextResponse.json({ error: 'No schema snapshot' }, { status: 400 })
  }

  const selectedObjects = await getSelectedObjectNames(plan.sourceConnection.id, snapshot.id)
  if (selectedObjects.length === 0) {
    return NextResponse.json({ error: 'No objects selected' }, { status: 400 })
  }

  try {
    const results = await retrieveFieldsForObjects(
      planId,
      plan.sourceConnection.id,
      plan.sourceConnection.adapterType,
      snapshot.id,
      selectedObjects,
    )
    return NextResponse.json({ results }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Field retrieval failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
