// 022-schema-write — POST /api/plans/[planId]/schema-write/fields
// Create a new field on a destination object (FR-002).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createField,
  SchemaWriteNotSupportedError,
  SchemaWriteValidationError,
  SchemaWriteRemoteError,
} from '@/features/schema-write/services'

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

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
      { error: 'NO_DESTINATION', message: 'No destination connection configured for this plan', code: 'SCHEMA_WRITE_NOT_SUPPORTED' },
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

  const { objectApiName, name, label, type, description, picklistValues, group } = body

  if (!objectApiName || typeof objectApiName !== 'string' || objectApiName.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR', message: 'objectApiName is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR', message: 'name is required' }, { status: 400 })
  }
  if (!label || typeof label !== 'string' || label.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR', message: 'label is required' }, { status: 400 })
  }
  if (!type || typeof type !== 'string' || type.trim() === '') {
    return NextResponse.json({ error: 'VALIDATION_ERROR', code: 'VALIDATION_ERROR', message: 'type is required' }, { status: 400 })
  }

  try {
    const result = await createField(
      plan.destinationConnection.id,
      plan.destinationConnection.adapterType,
      objectApiName.trim(),
      {
        name: name.trim(),
        label: label.trim(),
        type: type.trim(),
        description: typeof description === 'string' ? description.trim() : undefined,
        picklistValues: Array.isArray(picklistValues) ? (picklistValues as string[]) : undefined,
        group: typeof group === 'string' ? group.trim() : undefined,
      },
      planId,
    )
    return NextResponse.json(result, { status: 201 })
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
    console.error('[POST /schema-write/fields]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 })
  }
}
