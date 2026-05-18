import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getObjectsWithSelection, saveSelections } from '@/features/schema/services/object-selection-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })
  if (!plan?.sourceConnectionId) return NextResponse.json([])

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
  })
  if (!snapshot) return NextResponse.json([])

  const objects = await getObjectsWithSelection(plan.sourceConnectionId, snapshot.id)
  return NextResponse.json(objects)
}

export async function PUT(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const body = await request.json()
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })
  if (!plan.sourceConnectionId) {
    return NextResponse.json({ error: 'No source connection' }, { status: 400 })
  }

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
  })
  if (!snapshot) {
    return NextResponse.json({ error: 'No schema snapshot' }, { status: 400 })
  }

  const objects = await saveSelections(planId, plan.sourceConnectionId, snapshot.id, body.selections)
  return NextResponse.json(objects)
}
