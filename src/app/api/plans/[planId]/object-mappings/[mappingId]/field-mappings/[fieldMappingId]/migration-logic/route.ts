// 013-migration-logic — GET + PUT for a specific field mapping's migration logic
// Route: /api/plans/[planId]/object-mappings/[mappingId]/field-mappings/[fieldMappingId]/migration-logic
//
// GET: returns field metadata + sectionType + existing logic (or 404 with metadata if none)
// PUT: upserts migration logic; body: { action: 'SAVE'|'VALIDATE', valueEquivalences?, classificationPrompt? }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getMigrationLogic,
  saveMigrationLogic,
  buildMigrationLogicContext,
  getInformationalMessage,
} from '@/features/migration-logic/services/migration-logic-service'
import { getSectionType } from '@/features/field-mapping/lib/type-compatibility'
import type { SectionType } from '@/features/field-mapping/lib/type-compatibility'
import type { LogicStatus } from '@prisma/client'

type RouteParams = {
  params: Promise<{ planId: string; mappingId: string; fieldMappingId: string }>
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId, fieldMappingId } = await params

  try {
    // Validate plan + object mapping + field mapping ownership
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) return NextResponse.json({ error: 'Plan introuvable.' }, { status: 404 })

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) {
      return NextResponse.json({ error: 'Object mapping introuvable.' }, { status: 404 })
    }

    const fieldMapping = await prisma.fieldMapping.findUnique({ where: { id: fieldMappingId } })
    if (!fieldMapping || fieldMapping.objectMappingId !== mappingId) {
      return NextResponse.json({ error: 'Field mapping introuvable.' }, { status: 404 })
    }

    // Build enriched context (field metadata + sectionType + picklist values)
    const ctx = await buildMigrationLogicContext(fieldMappingId)
    if (!ctx) {
      return NextResponse.json({ error: 'Impossible de résoudre les métadonnées des champs.' }, { status: 500 })
    }

    const existingLogic = await getMigrationLogic(fieldMappingId)

    if (!existingLogic) {
      // 404 shape still includes field metadata + sectionType (spec 013 contracts/api.md §GET 404)
      return NextResponse.json(
        {
          fieldMappingId,
          sectionType: ctx.sectionType,
          sourceField: ctx.sourceField,
          destinationField: ctx.destinationField,
          informationalMessage: ctx.informationalMessage,
          valueEquivalences: [],
          classificationPrompt: null,
          sampleSourceValues: ctx.sampleSourceValues,
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ...existingLogic,
      sectionType: ctx.sectionType, // always recompute from current field types
      sourceField: ctx.sourceField,
      destinationField: ctx.destinationField,
      informationalMessage:
        ctx.sectionType === 'INFORMATIONAL'
          ? getInformationalMessage(ctx.sourceField.type, ctx.destinationField.type)
          : null,
      sampleSourceValues: ctx.sampleSourceValues,
    })
  } catch (err) {
    console.error('[GET /migration-logic]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId, fieldMappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) return NextResponse.json({ error: 'Plan introuvable.' }, { status: 404 })

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) {
      return NextResponse.json({ error: 'Object mapping introuvable.' }, { status: 404 })
    }

    const fieldMapping = await prisma.fieldMapping.findUnique({ where: { id: fieldMappingId } })
    if (!fieldMapping || fieldMapping.objectMappingId !== mappingId) {
      return NextResponse.json({ error: 'Field mapping introuvable.' }, { status: 404 })
    }

    const body = await req.json() as {
      action?: string
      valueEquivalences?: Array<{ sourceValue: string; destinationValue: string }>
      classificationPrompt?: string
      promptText?: string
    }

    const { action, valueEquivalences } = body
    // The client (MigrationLogicModal/use-migration-logic) sends the D2 prompt under `promptText`;
    // accept both keys so the body contract can't silently drift again (this mismatch made SAVE
    // return 400 and VALIDATE persist an empty prompt — a real recette regression).
    const classificationPrompt = body.classificationPrompt ?? body.promptText

    if (action !== 'SAVE' && action !== 'VALIDATE') {
      return NextResponse.json(
        { error: 'action doit être SAVE ou VALIDATE.' },
        { status: 400 },
      )
    }

    // Derive sectionType from current field types
    const srcType = fieldMapping.sourceFieldType ?? 'text'
    const dstType = fieldMapping.destinationFieldType ?? 'text'
    const sectionType: SectionType = getSectionType(srcType, dstType)

    // D3 (ERROR) cannot be saved
    if (sectionType === 'ERROR') {
      return NextResponse.json(
        { error: 'Impossible de définir une logique de migration pour des types incompatibles.' },
        { status: 409 },
      )
    }

    // Validate D1 input
    if (sectionType === 'VALUE_EQUIVALENCE' && valueEquivalences !== undefined) {
      if (!Array.isArray(valueEquivalences)) {
        return NextResponse.json({ error: 'valueEquivalences doit être un tableau.' }, { status: 400 })
      }
      // Check no duplicate sourceValue (spec FR-006)
      const srcValues = valueEquivalences.map((ve) => ve.sourceValue)
      const unique = new Set(srcValues)
      if (unique.size !== srcValues.length) {
        return NextResponse.json(
          { error: 'Une valeur source ne peut être mappée qu\'une seule fois.' },
          { status: 400 },
        )
      }
    }

    // Validate D2 input
    if (sectionType === 'PROMPT' && action === 'SAVE' && (!classificationPrompt || typeof classificationPrompt !== 'string')) {
      return NextResponse.json(
        { error: 'classificationPrompt est requis pour une section PROMPT.' },
        { status: 400 },
      )
    }

    const targetStatus: LogicStatus = action === 'VALIDATE' ? 'VALIDATED' : 'DEFINED'

    const result = await saveMigrationLogic(planId, fieldMappingId, {
      sectionType,
      status: targetStatus,
      valueEquivalences:
        sectionType === 'VALUE_EQUIVALENCE' ? (valueEquivalences ?? []) : undefined,
      promptText:
        sectionType === 'PROMPT' ? (classificationPrompt ?? '') : undefined,
    })

    return NextResponse.json({
      id: result.id,
      fieldMappingId: result.fieldMappingId,
      status: result.status,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    })
  } catch (err) {
    console.error('[PUT /migration-logic]', err)
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 })
  }
}
