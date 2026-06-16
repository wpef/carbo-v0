// 013-migration-logic — Domain service for migration logic CRUD (v4)
// Adapted from v3 src/lib/services/migration-logic.ts to fit v4 Prisma schema.
//
// Key v4 differences vs v3:
// - MigrationLogic has no `sectionType` column — it is derived at runtime via getSectionType()
//   and stored in the JSON `config` field as { sectionType: string } for DTO reconstruction.
// - status uses Prisma enum LogicStatus (DRAFT | DEFINED | VALIDATED).
// - classificationPrompt relation already exists in schema (013 D2).

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getSectionType } from '@/features/field-mapping/lib/type-compatibility'
import type { SectionType } from '@/features/field-mapping/lib/type-compatibility'
import type { LogicStatus } from '@prisma/client'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type { SectionType }

export interface ValueEquivalenceItem {
  id?: string
  sourceValue: string
  destinationValue: string
}

export interface MigrationLogicDTO {
  id: string
  fieldMappingId: string
  sectionType: SectionType
  status: LogicStatus
  valueEquivalences: ValueEquivalenceItem[]
  classificationPrompt: { id: string; promptText: string } | null
  createdAt: string
  updatedAt: string
}

export interface SaveMigrationLogicInput {
  /** Which section type this logic belongs to — used to drive child writes. */
  sectionType: SectionType
  /** DEFINED (save/orange) or VALIDATED (validate/green) */
  status: LogicStatus
  /** For D1 (VALUE_EQUIVALENCE) */
  valueEquivalences?: { sourceValue: string; destinationValue: string }[]
  /** For D2 (PROMPT) */
  promptText?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const INCLUDE = {
  valueEquivalences: true,
  classificationPrompt: true,
} as const

type DbLogic = {
  id: string
  fieldMappingId: string
  status: LogicStatus
  config: string
  description: string | null
  valueEquivalences: { id: string; sourceValue: string; destinationValue: string }[]
  classificationPrompt: { id: string; promptText: string } | null
  // Prisma doesn't generate createdAt/updatedAt on MigrationLogic in v4 schema;
  // we fall back to epoch if absent.
  createdAt?: Date
  updatedAt?: Date
}

function extractSectionType(config: string): SectionType {
  try {
    const parsed = JSON.parse(config) as { sectionType?: string }
    const st = parsed.sectionType
    if (st === 'VALUE_EQUIVALENCE' || st === 'PROMPT' || st === 'ERROR' || st === 'INFORMATIONAL') {
      return st as SectionType
    }
  } catch {
    // ignore
  }
  return 'INFORMATIONAL'
}

function toDTO(logic: DbLogic): MigrationLogicDTO {
  return {
    id: logic.id,
    fieldMappingId: logic.fieldMappingId,
    sectionType: extractSectionType(logic.config),
    status: logic.status,
    valueEquivalences: logic.valueEquivalences.map((ve) => ({
      id: ve.id,
      sourceValue: ve.sourceValue,
      destinationValue: ve.destinationValue,
    })),
    classificationPrompt: logic.classificationPrompt
      ? { id: logic.classificationPrompt.id, promptText: logic.classificationPrompt.promptText }
      : null,
    createdAt: logic.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: logic.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  }
}

// ─── getInformationalMessage ───────────────────────────────────────────────────

/**
 * Returns the D4 informational message for a given source/dest type combination.
 * Pure function — spec 013 §Type Compatibility Matrix.
 */
export function getInformationalMessage(sourceType: string, destType: string): string {
  // Normalise to the same buckets used by getSectionType
  const normalizeForMsg = (t: string) => {
    const lower = t.toLowerCase().trim()
    if (['boolean', 'bool', 'checkbox'].includes(lower)) return 'boolean'
    if (['picklist', 'multipicklist', 'enum', 'enumeration', 'select', 'combobox'].includes(lower)) return 'picklist'
    return lower
  }
  const src = normalizeForMsg(sourceType)
  const dst = normalizeForMsg(destType)
  if (src === 'boolean' && dst === 'text') return 'Vrai ou Faux'
  if (src === 'boolean' && dst === 'number') return 'Vrai=>1, Faux=>0'
  return 'La valeur sera copiée.'
}

// ─── getMigrationLogic ─────────────────────────────────────────────────────────

/**
 * Fetch the MigrationLogic for a fieldMapping, or null if it doesn't exist yet.
 */
export async function getMigrationLogic(fieldMappingId: string): Promise<MigrationLogicDTO | null> {
  const logic = await prisma.migrationLogic.findUnique({
    where: { fieldMappingId },
    include: INCLUDE,
  })
  if (!logic) return null
  return toDTO(logic)
}

// ─── saveMigrationLogic ────────────────────────────────────────────────────────

/**
 * Upsert migration logic for a field mapping.
 * - Stores sectionType in the JSON `config` column (only column available in v4).
 * - For D1: replaces all ValueEquivalence rows atomically.
 * - For D2: upserts the ClassificationPrompt record.
 * - For D3/D4: no child records; just the config + status.
 */
export async function saveMigrationLogic(
  planId: string,
  fieldMappingId: string,
  input: SaveMigrationLogicInput,
): Promise<MigrationLogicDTO> {
  console.log('[migration-logic] save', { fieldMappingId, sectionType: input.sectionType, status: input.status })

  const config = JSON.stringify({ sectionType: input.sectionType })

  // Upsert base record (config carries sectionType; description is always null here)
  const logic = await prisma.migrationLogic.upsert({
    where: { fieldMappingId },
    create: { fieldMappingId, status: input.status, config },
    update: { status: input.status, config },
    include: INCLUDE,
  })

  // D1 — replace ValueEquivalence rows
  if (input.sectionType === 'VALUE_EQUIVALENCE' && input.valueEquivalences !== undefined) {
    await prisma.valueEquivalence.deleteMany({ where: { migrationLogicId: logic.id } })
    if (input.valueEquivalences.length > 0) {
      await prisma.valueEquivalence.createMany({
        data: input.valueEquivalences.map((ve) => ({
          migrationLogicId: logic.id,
          sourceValue: ve.sourceValue,
          destinationValue: ve.destinationValue,
        })),
      })
    }
  }

  // D2 — upsert ClassificationPrompt
  if (input.sectionType === 'PROMPT' && input.promptText !== undefined) {
    await prisma.classificationPrompt.upsert({
      where: { migrationLogicId: logic.id },
      create: { migrationLogicId: logic.id, promptText: input.promptText },
      update: { promptText: input.promptText },
    })
  }

  // Fetch final state
  const updated = await prisma.migrationLogic.findUniqueOrThrow({
    where: { id: logic.id },
    include: INCLUDE,
  })

  const isNew = !logic.updatedAt || (logic.createdAt && logic.createdAt.getTime() === logic.updatedAt.getTime())
  await logAuditEvent({
    planId,
    action: isNew ? 'MIGRATION_LOGIC_CREATED' : 'MIGRATION_LOGIC_UPDATED',
    entity: 'MigrationLogic',
    entityId: logic.id,
    details: {
      fieldMappingId,
      sectionType: input.sectionType,
      status: input.status,
      valueEquivalenceCount: input.valueEquivalences?.length,
    },
  })

  return toDTO(updated)
}

// ─── deleteMigrationLogic ──────────────────────────────────────────────────────

export async function deleteMigrationLogic(planId: string, fieldMappingId: string): Promise<void> {
  const logic = await prisma.migrationLogic.findUnique({ where: { fieldMappingId } })
  if (!logic) return

  await prisma.migrationLogic.delete({ where: { fieldMappingId } })

  await logAuditEvent({
    planId,
    action: 'MIGRATION_LOGIC_DELETED',
    entity: 'MigrationLogic',
    entityId: logic.id,
    details: { fieldMappingId },
  })
}

// ─── buildMigrationLogicContext ────────────────────────────────────────────────

/**
 * Resolve source/destination field metadata needed for the migration-logic modal.
 * Returns null if either field doesn't exist in the DB.
 *
 * Called by the GET route handler to hydrate picklistValues + sectionType.
 */
export async function buildMigrationLogicContext(fieldMappingId: string) {
  const fieldMapping = await prisma.fieldMapping.findUnique({
    where: { id: fieldMappingId },
    include: { objectMapping: { select: { planId: true, sourceObjectName: true, destinationObjectName: true } } },
  })
  if (!fieldMapping) return null

  const { planId, sourceObjectName, destinationObjectName } = fieldMapping.objectMapping

  // Resolve the CURRENT snapshot objects by apiName
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true, destinationConnectionId: true },
  })
  if (!plan) return null

  const [srcSnapshot, dstSnapshot] = await Promise.all([
    plan.sourceConnectionId
      ? prisma.schemaSnapshot.findUnique({
          where: {
            connectionId_side_status: {
              connectionId: plan.sourceConnectionId,
              side: 'SOURCE',
              status: 'CURRENT',
            },
          },
        })
      : null,
    plan.destinationConnectionId
      ? prisma.schemaSnapshot.findUnique({
          where: {
            connectionId_side_status: {
              connectionId: plan.destinationConnectionId,
              side: 'DESTINATION',
              status: 'CURRENT',
            },
          },
        })
      : null,
  ])

  const [srcObject, dstObject] = await Promise.all([
    srcSnapshot
      ? prisma.schemaObject.findUnique({
          where: { snapshotId_apiName: { snapshotId: srcSnapshot.id, apiName: sourceObjectName } },
        })
      : null,
    dstSnapshot
      ? prisma.schemaObject.findUnique({
          where: { snapshotId_apiName: { snapshotId: dstSnapshot.id, apiName: destinationObjectName } },
        })
      : null,
  ])

  const [sourceField, destField] = await Promise.all([
    srcObject
      ? prisma.objectField.findUnique({
          where: { objectId_apiName: { objectId: srcObject.id, apiName: fieldMapping.sourceFieldName } },
        })
      : null,
    dstObject
      ? prisma.objectField.findUnique({
          where: { objectId_apiName: { objectId: dstObject.id, apiName: fieldMapping.destinationFieldName } },
        })
      : null,
  ])

  const sourceFieldType = sourceField?.dataType ?? fieldMapping.sourceFieldType ?? 'text'
  const destFieldType = destField?.dataType ?? fieldMapping.destinationFieldType ?? 'text'

  const sectionType = getSectionType(sourceFieldType, destFieldType)

  const parsePicklist = (raw: string | null | undefined, type: string): string[] => {
    if (raw) {
      try { return JSON.parse(raw) as string[] } catch { /* ignore */ }
    }
    // Synthesise boolean values as per spec 013
    const norm = type.toLowerCase().trim()
    if (['boolean', 'bool', 'checkbox'].includes(norm)) return ['True', 'False']
    return []
  }

  const sourcePicklistValues = parsePicklist(sourceField?.picklistValues, sourceFieldType)
  const destPicklistValues = parsePicklist(destField?.picklistValues, destFieldType)

  // Sample source values for D2 — best-effort placeholder (no live connector call)
  const sampleSourceValues: string[] = sectionType === 'PROMPT'
    ? ['Valeur exemple 1', 'Valeur exemple 2', 'Valeur exemple 3', 'Valeur exemple 4']
    : []

  const informationalMessage = sectionType === 'INFORMATIONAL'
    ? getInformationalMessage(sourceFieldType, destFieldType)
    : null

  return {
    planId,
    fieldMappingId,
    sourceField: {
      name: fieldMapping.sourceFieldName,
      label: sourceField?.label ?? fieldMapping.sourceFieldName,
      type: sourceFieldType,
      picklistValues: sourcePicklistValues.length > 0 ? sourcePicklistValues : null,
    },
    destinationField: {
      name: fieldMapping.destinationFieldName,
      label: destField?.label ?? fieldMapping.destinationFieldName,
      type: destFieldType,
      picklistValues: destPicklistValues.length > 0 ? destPicklistValues : null,
    },
    sectionType,
    sourcePicklistValues,
    destPicklistValues,
    sampleSourceValues,
    informationalMessage,
  }
}
