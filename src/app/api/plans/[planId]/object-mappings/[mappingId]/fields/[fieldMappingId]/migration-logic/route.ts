// 013-migration-logic — GET + PUT migration logic for a field mapping

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getMigrationLogic, saveMigrationLogic } from '@/lib/services/migration-logic'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import type { SectionType, MigrationLogicStatus } from '@/lib/types/mapping'

type RouteParams = { params: Promise<{ planId: string; mappingId: string; fieldMappingId: string }> }

// --- Section-type derivation from source/dest field types ---

type NormalizedType = 'text' | 'number' | 'date' | 'picklist' | 'boolean'

function normalise(dataType: string): NormalizedType {
  const t = dataType.toLowerCase().trim()
  if (['string', 'text', 'email', 'url', 'phone', 'textarea', 'richtext', 'id'].includes(t)) return 'text'
  if (['number', 'integer', 'int', 'float', 'double', 'decimal', 'currency', 'percent'].includes(t)) return 'number'
  if (['date', 'datetime', 'time'].includes(t)) return 'date'
  if (['picklist', 'multipicklist', 'enum', 'select'].includes(t)) return 'picklist'
  if (['boolean', 'checkbox'].includes(t)) return 'boolean'
  return 'text'
}

/**
 * Derive the migration logic section type from source + destination field types.
 * Implements the Type Compatibility Matrix from spec.md.
 */
function deriveSectionType(sourceType: string, destType: string): SectionType {
  const src = normalise(sourceType)
  const dst = normalise(destType)

  // D1 — Value Equivalence: picklist/boolean → picklist/boolean combinations
  if (src === 'picklist' && (dst === 'picklist' || dst === 'boolean')) return 'VALUE_EQUIVALENCE'
  if (src === 'boolean' && dst === 'picklist') return 'VALUE_EQUIVALENCE'

  // D2 — LLM Prompt: text/number/date → picklist
  if (dst === 'picklist') return 'PROMPT'

  // D4 — Informational (direct copy): same type or compatible text-like conversions
  if (src === dst) return 'INFORMATIONAL'
  if (src === 'picklist' && dst === 'text') return 'INFORMATIONAL'
  if (src === 'boolean' && (dst === 'text' || dst === 'number' || dst === 'boolean')) return 'INFORMATIONAL'
  if (src === 'number' && dst === 'text') return 'INFORMATIONAL'
  if (src === 'date' && dst === 'text') return 'INFORMATIONAL'

  // D3 — Error: everything else
  return 'ERROR'
}

/**
 * Get the informational message for D4 sections based on type combination.
 */
export function getInformationalMessage(sourceType: string, destType: string): string {
  const src = normalise(sourceType)
  const dst = normalise(destType)

  if (src === 'boolean' && dst === 'text') return 'Vrai ou Faux'
  if (src === 'boolean' && dst === 'number') return 'Vrai=>1, Faux=>0'
  return 'La valeur sera copiée.'
}

// --- Validation helpers ---

function isValidSectionType(v: unknown): v is SectionType {
  return v === 'VALUE_EQUIVALENCE' || v === 'PROMPT' || v === 'ERROR' || v === 'INFORMATIONAL'
}

function isValidStatus(v: unknown): v is MigrationLogicStatus {
  return v === 'DRAFT' || v === 'DEFINED' || v === 'VALIDATED' || v === 'INCOMPATIBLE'
}

// --- Route handlers ---

// GET /api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]/migration-logic
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId, fieldMappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: 'Object mapping not found.' }, { status: 404 })
    }

    const fieldMapping = await prisma.fieldMapping.findUnique({
      where: { id: fieldMappingId },
      include: {
        objectMapping: true,
      },
    })
    if (!fieldMapping || fieldMapping.objectMappingId !== mappingId) {
      return NextResponse.json(
        { error: 'FIELD_MAPPING_NOT_FOUND', message: 'Field mapping not found.' },
        { status: 404 },
      )
    }

    // Fetch field types for section suggestion
    const [sourceField, destField] = await Promise.all([
      prisma.objectField.findUnique({ where: { id: fieldMapping.sourceFieldId } }),
      prisma.objectField.findUnique({ where: { id: fieldMapping.destFieldId } }),
    ])

    const sourceFieldType = sourceField?.dataType ?? 'text'
    const destFieldType = destField?.dataType ?? 'text'
    const suggestedSection = deriveSectionType(sourceFieldType, destFieldType)

    const migrationLogic = await getMigrationLogic(fieldMappingId)

    console.log('[migration-logic] GET', { fieldMappingId, suggestedSection, exists: !!migrationLogic })

    if (!migrationLogic) {
      return NextResponse.json({
        migrationLogic: null,
        suggestedSection,
        sourceFieldType,
        destinationFieldType: destFieldType,
        informationalMessage: suggestedSection === 'INFORMATIONAL'
          ? getInformationalMessage(sourceFieldType, destFieldType)
          : null,
      })
    }

    return NextResponse.json({
      migrationLogic,
      suggestedSection,
      sourceFieldType,
      destinationFieldType: destFieldType,
      informationalMessage: migrationLogic.sectionType === 'INFORMATIONAL'
        ? getInformationalMessage(sourceFieldType, destFieldType)
        : null,
    })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /migration-logic]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}

// PUT /api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]/migration-logic
// Body: { sectionType, status, valueEquivalences?, promptText? }
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId, fieldMappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: 'Object mapping not found.' }, { status: 404 })
    }

    const fieldMapping = await prisma.fieldMapping.findUnique({ where: { id: fieldMappingId } })
    if (!fieldMapping || fieldMapping.objectMappingId !== mappingId) {
      return NextResponse.json(
        { error: 'FIELD_MAPPING_NOT_FOUND', message: 'Field mapping not found.' },
        { status: 404 },
      )
    }

    const body = await req.json()
    const { sectionType, status, valueEquivalences, promptText } = body

    if (!isValidSectionType(sectionType)) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'sectionType must be VALUE_EQUIVALENCE | PROMPT | ERROR | INFORMATIONAL.' },
        { status: 400 },
      )
    }

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'status must be DRAFT | DEFINED | VALIDATED | INCOMPATIBLE.' },
        { status: 400 },
      )
    }

    const result = await saveMigrationLogic(fieldMappingId, planId, {
      sectionType,
      status,
      valueEquivalences,
      promptText,
    })

    return NextResponse.json({
      id: result.id,
      sectionType: result.sectionType,
      status: result.status,
      updatedAt: result.updatedAt,
    })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[PUT /migration-logic]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
