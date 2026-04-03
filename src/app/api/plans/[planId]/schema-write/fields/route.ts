// 022-schema-write — Field creation route

import { NextRequest, NextResponse } from 'next/server'
import {
  createFieldInDestination,
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

// POST /api/plans/[planId]/schema-write/fields
// Body: { objectApiName, apiName, label, dataType, isRequired }
export async function POST(req: NextRequest, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  const plan = await resolvePlan(planId)
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }

  let body: {
    objectApiName?: string
    apiName?: string
    label?: string
    dataType?: string
    isRequired?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const { objectApiName, apiName, label, dataType, isRequired } = body

  if (!objectApiName || typeof objectApiName !== 'string' || objectApiName.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'objectApiName is required.' }, { status: 400 })
  }
  if (!apiName || typeof apiName !== 'string' || apiName.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'apiName is required.' }, { status: 400 })
  }
  if (!label || typeof label !== 'string' || label.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'label is required.' }, { status: 400 })
  }
  if (!dataType || typeof dataType !== 'string' || dataType.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'dataType is required.' }, { status: 400 })
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

    const result = await createFieldInDestination(planId, {
      objectApiName: objectApiName.trim(),
      apiName: apiName.trim(),
      label: label.trim(),
      dataType: dataType.trim(),
      isRequired: isRequired === true,
    })

    if (!result.success) {
      return NextResponse.json({ error: 'CREATE_FIELD_FAILED', message: result.error ?? 'Failed to create field.' }, { status: 400 })
    }

    return NextResponse.json({ field: result.data }, { status: 201 })
  } catch (err) {
    if (err instanceof SchemaWriteNotFoundError) {
      return NextResponse.json({ error: 'CONNECTION_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof SchemaWriteNotSupportedError) {
      return NextResponse.json({ error: 'SCHEMA_WRITE_NOT_SUPPORTED', message: err.message }, { status: 403 })
    }
    console.error('[POST /schema-write/fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
