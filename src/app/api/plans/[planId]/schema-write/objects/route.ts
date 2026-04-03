// 022-schema-write — Object creation route

import { NextRequest, NextResponse } from 'next/server'
import {
  createObjectInDestination,
  checkSchemaWriteCapability,
  SchemaWriteNotFoundError,
  SchemaWriteNotSupportedError,
} from '@/lib/services/schema-write'
import { prisma } from '@/lib/db/prisma'

async function resolvePlan(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) return null
  return plan
}

// POST /api/plans/[planId]/schema-write/objects
// Body: { apiName: string, label: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  const plan = await resolvePlan(planId)
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }

  let body: { apiName?: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const { apiName, label } = body

  if (!apiName || typeof apiName !== 'string' || apiName.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'apiName is required.' }, { status: 400 })
  }
  if (!label || typeof label !== 'string' || label.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'label is required.' }, { status: 400 })
  }

  try {
    // Check capability first
    const capability = await checkSchemaWriteCapability(planId)
    if (!capability.canWriteSchema) {
      return NextResponse.json(
        { error: 'SCHEMA_WRITE_NOT_SUPPORTED', message: `Adapter '${capability.adapterType}' does not support schema write.` },
        { status: 403 },
      )
    }

    const result = await createObjectInDestination(planId, { apiName: apiName.trim(), label: label.trim() })

    if (!result.success) {
      return NextResponse.json({ error: 'CREATE_OBJECT_FAILED', message: result.error ?? 'Failed to create object.' }, { status: 400 })
    }

    return NextResponse.json({ object: result.data }, { status: 201 })
  } catch (err) {
    if (err instanceof SchemaWriteNotFoundError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof SchemaWriteNotSupportedError) {
      return NextResponse.json({ error: 'SCHEMA_WRITE_NOT_SUPPORTED', message: err.message }, { status: 403 })
    }
    console.error('[POST /schema-write/objects]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
