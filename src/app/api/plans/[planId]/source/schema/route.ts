import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSchemaSnapshot, fetchAndStoreSchema } from '@/features/schema/services/schema-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })
  if (!plan?.sourceConnectionId) return NextResponse.json(null)

  const snapshot = await getSchemaSnapshot(plan.sourceConnectionId, 'SOURCE')
  return NextResponse.json(snapshot)
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

  try {
    const snapshot = await fetchAndStoreSchema(planId, plan.sourceConnection.id, plan.sourceConnection.adapterType, 'SOURCE')
    return NextResponse.json(snapshot, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Schema fetch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
