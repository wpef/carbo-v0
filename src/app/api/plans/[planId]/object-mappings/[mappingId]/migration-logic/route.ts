// Legacy route: /api/plans/[planId]/object-mappings/[mappingId]/migration-logic?fieldMappingId=xxx
// Kept for backward compatibility with any existing callers.
// New route: /api/plans/.../field-mappings/[fieldMappingId]/migration-logic
//
// Delegates to the canonical migration-logic service.

import { NextResponse } from 'next/server'
import { getMigrationLogic, saveMigrationLogic } from '@/features/migration-logic/services/migration-logic-service'
import { getSectionType } from '@/features/field-mapping/lib/type-compatibility'
import { prisma } from '@/lib/prisma'
import type { LogicStatus } from '@prisma/client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  await params
  const url = new URL(request.url)
  const fieldMappingId = url.searchParams.get('fieldMappingId')
  if (!fieldMappingId) {
    return NextResponse.json({ error: 'fieldMappingId required' }, { status: 400 })
  }

  const logic = await getMigrationLogic(fieldMappingId)
  return NextResponse.json(logic ?? { fieldMappingId, migrationLogic: null })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId } = await params
  const body = await request.json() as {
    fieldMappingId?: string
    action?: string
    valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
    classificationPrompt?: string
  }

  if (!body.fieldMappingId) {
    return NextResponse.json({ error: 'fieldMappingId required' }, { status: 400 })
  }

  const fieldMapping = await prisma.fieldMapping.findUnique({ where: { id: body.fieldMappingId } })
  if (!fieldMapping) {
    return NextResponse.json({ error: 'Field mapping introuvable.' }, { status: 404 })
  }

  const sectionType = getSectionType(fieldMapping.sourceFieldType, fieldMapping.destinationFieldType)
  const targetStatus: LogicStatus = body.action === 'VALIDATE' ? 'VALIDATED' : 'DEFINED'

  try {
    const logic = await saveMigrationLogic(planId, body.fieldMappingId, {
      sectionType,
      status: targetStatus,
      valueEquivalences: sectionType === 'VALUE_EQUIVALENCE' ? (body.valueEquivalences ?? []) : undefined,
      promptText: sectionType === 'PROMPT' ? (body.classificationPrompt ?? '') : undefined,
    })
    return NextResponse.json(logic)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
