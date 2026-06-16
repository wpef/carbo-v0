// 022-schema-write — PATCH /api/plans/[planId]/schema-write/fields/[fieldApiName]
// Modify properties of an existing destination field (FR-004).
// objectApiName is passed as a query parameter.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  modifyField,
  SchemaWriteNotSupportedError,
  SchemaWriteValidationError,
  SchemaWriteRemoteError,
} from '@/features/schema-write/services'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string; fieldApiName: string }> },
) {
  const { planId, fieldApiName } = await params
  const url = new URL(request.url)
  const objectApiName = url.searchParams.get('objectApiName')

  if (!objectApiName) {
    return NextResponse.json({ error: 'objectApiName query parameter is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Resolve plan + destination connection
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: { destinationConnection: true },
  })
  if (!plan) {
    return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
  }
  if (!plan.destinationConnection) {
    return NextResponse.json(
      { error: 'No destination connection configured', code: 'SCHEMA_WRITE_NOT_SUPPORTED' },
      { status: 403 },
    )
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'Request body must be valid JSON' }, { status: 400 })
  }

  const updates = body.updates as Record<string, unknown> | undefined
  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'updates object is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  try {
    const result = await modifyField(
      plan.destinationConnection.id,
      plan.destinationConnection.adapterType,
      objectApiName,
      fieldApiName,
      {
        name: typeof updates.name === 'string' ? updates.name : undefined,
        label: typeof updates.label === 'string' ? updates.label : undefined,
        type: typeof updates.type === 'string' ? updates.type : undefined,
        description: typeof updates.description === 'string' ? updates.description : undefined,
        picklistValues: Array.isArray(updates.picklistValues) ? (updates.picklistValues as string[]) : undefined,
        group: typeof updates.group === 'string' ? updates.group : undefined,
      },
      planId,
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SchemaWriteValidationError) {
      return NextResponse.json({ error: err.errors.join('; '), code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    if (err instanceof SchemaWriteNotSupportedError) {
      return NextResponse.json({ error: err.message, code: 'SCHEMA_WRITE_NOT_SUPPORTED' }, { status: 403 })
    }
    if (err instanceof SchemaWriteRemoteError) {
      return NextResponse.json({ error: err.message, code: 'REMOTE_API_ERROR' }, { status: 422 })
    }
    console.error('[PATCH /schema-write/fields/[fieldApiName]]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 })
  }
}
