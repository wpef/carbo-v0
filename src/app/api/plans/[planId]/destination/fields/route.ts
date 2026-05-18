import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { retrieveFieldsForObjects, getFieldsByObject } from '@/features/schema/services/field-retrieval-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { destinationConnectionId: true },
  })
  if (!plan?.destinationConnectionId) return NextResponse.json({})

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
  })
  if (!snapshot) return NextResponse.json({})

  const fields = await getFieldsByObject(snapshot.id)
  return NextResponse.json(fields)
}

export async function POST(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { destinationConnection: true },
  })
  if (!plan.destinationConnection) {
    return NextResponse.json({ error: 'No destination connection' }, { status: 400 })
  }

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.destinationConnection.id, side: 'DESTINATION', status: 'CURRENT' } },
  })
  if (!snapshot) {
    return NextResponse.json({ error: 'No schema snapshot' }, { status: 400 })
  }

  const objects = await prisma.schemaObject.findMany({
    where: { snapshotId: snapshot.id },
    select: { apiName: true },
  })

  try {
    const results = await retrieveFieldsForObjects(
      planId,
      plan.destinationConnection.id,
      plan.destinationConnection.adapterType,
      snapshot.id,
      objects.map((o) => o.apiName),
    )
    return NextResponse.json({ results }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Field retrieval failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
