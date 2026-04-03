// 022-schema-write — Capability check route

import { NextRequest, NextResponse } from 'next/server'
import { checkSchemaWriteCapability, SchemaWriteNotFoundError } from '@/lib/services/schema-write'
import { prisma } from '@/lib/db/prisma'

async function resolvePlan(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return null
  }
  return plan
}

// GET /api/plans/[planId]/schema-write/capability
export async function GET(_req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  const plan = await resolvePlan(planId)
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }

  try {
    const capability = await checkSchemaWriteCapability(planId)
    return NextResponse.json(capability)
  } catch (err) {
    if (err instanceof SchemaWriteNotFoundError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /schema-write/capability]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
