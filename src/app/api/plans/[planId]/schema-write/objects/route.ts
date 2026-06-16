// 022-schema-write — POST /api/plans/[planId]/schema-write/objects
// Create a new custom object on the destination system (FR-007).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createObject,
  SchemaWriteNotSupportedError,
  SchemaWriteValidationError,
  SchemaWriteRemoteError,
} from '@/features/schema-write/services'

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { name, label, description, primaryProperty } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'name is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!label || typeof label !== 'string' || label.trim() === '') {
    return NextResponse.json({ error: 'label is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!primaryProperty || typeof primaryProperty !== 'object') {
    return NextResponse.json({ error: 'primaryProperty is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const pp = primaryProperty as Record<string, unknown>
  if (!pp.name || typeof pp.name !== 'string' || pp.name.trim() === '') {
    return NextResponse.json({ error: 'primaryProperty.name is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!pp.label || typeof pp.label !== 'string' || pp.label.trim() === '') {
    return NextResponse.json({ error: 'primaryProperty.label is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!pp.type || typeof pp.type !== 'string' || pp.type.trim() === '') {
    return NextResponse.json({ error: 'primaryProperty.type is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  try {
    const result = await createObject(
      plan.destinationConnection.id,
      plan.destinationConnection.adapterType,
      {
        name: (name as string).trim(),
        label: (label as string).trim(),
        description: typeof description === 'string' ? description.trim() : undefined,
        primaryProperty: {
          name: pp.name.trim(),
          label: (pp.label as string).trim(),
          type: (pp.type as string).trim(),
        },
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
    console.error('[POST /schema-write/objects]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 })
  }
}
