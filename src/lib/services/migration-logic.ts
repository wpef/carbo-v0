// 013-migration-logic — Domain service for migration logic CRUD

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import type {
  MigrationLogicDTO,
  SaveMigrationLogicInput,
  SectionType,
  MigrationLogicStatus,
} from '@/lib/types/mapping'

// --- Errors ---

export class MigrationLogicNotFoundError extends Error {
  constructor(fieldMappingId: string) {
    super(`MigrationLogic not found for fieldMapping: ${fieldMappingId}`)
    this.name = 'MigrationLogicNotFoundError'
  }
}

// --- Helpers ---

function toDTO(
  logic: {
    id: string
    fieldMappingId: string
    sectionType: string
    status: string
    createdAt: Date
    updatedAt: Date
    valueEquivalences: Array<{ id: string; migrationLogicId: string; sourceValue: string; destinationValue: string }>
    classificationPrompt: { id: string; migrationLogicId: string; promptText: string } | null
  },
): MigrationLogicDTO {
  return {
    id: logic.id,
    fieldMappingId: logic.fieldMappingId,
    sectionType: logic.sectionType as SectionType,
    status: logic.status as MigrationLogicStatus,
    valueEquivalences: logic.valueEquivalences.map((ve) => ({
      id: ve.id,
      migrationLogicId: ve.migrationLogicId,
      sourceValue: ve.sourceValue,
      destinationValue: ve.destinationValue,
    })),
    classificationPrompt: logic.classificationPrompt
      ? {
          id: logic.classificationPrompt.id,
          migrationLogicId: logic.classificationPrompt.migrationLogicId,
          promptText: logic.classificationPrompt.promptText,
        }
      : null,
    createdAt: logic.createdAt.toISOString(),
    updatedAt: logic.updatedAt.toISOString(),
  }
}

const INCLUDE = {
  valueEquivalences: true,
  classificationPrompt: true,
} as const

// --- Service functions ---

/**
 * Get existing MigrationLogic for a fieldMapping.
 * Returns null if none exists yet.
 */
export async function getMigrationLogic(fieldMappingId: string): Promise<MigrationLogicDTO | null> {
  const logic = await prisma.migrationLogic.findUnique({
    where: { fieldMappingId },
    include: INCLUDE,
  })

  if (!logic) return null
  return toDTO(logic)
}

/**
 * Save (upsert) migration logic for a fieldMapping.
 * - Creates the record if it doesn't exist.
 * - For VALUE_EQUIVALENCE: replaces all ValueEquivalence rows.
 * - For PROMPT: upserts the ClassificationPrompt.
 * - For ERROR / INFORMATIONAL: no child data.
 * Logs to audit trail.
 */
export async function saveMigrationLogic(
  fieldMappingId: string,
  planId: string | null,
  input: SaveMigrationLogicInput,
): Promise<MigrationLogicDTO> {
  console.log('[migration-logic] save', { fieldMappingId, sectionType: input.sectionType, status: input.status })

  // Upsert the base MigrationLogic record
  const logic = await prisma.migrationLogic.upsert({
    where: { fieldMappingId },
    create: {
      fieldMappingId,
      sectionType: input.sectionType,
      status: input.status,
    },
    update: {
      sectionType: input.sectionType,
      status: input.status,
    },
    include: INCLUDE,
  })

  // Replace ValueEquivalence rows if D1
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

  // Upsert ClassificationPrompt if D2
  if (input.sectionType === 'PROMPT' && input.promptText !== undefined) {
    await prisma.classificationPrompt.upsert({
      where: { migrationLogicId: logic.id },
      create: { migrationLogicId: logic.id, promptText: input.promptText },
      update: { promptText: input.promptText },
    })
  }

  // Fetch final state with children
  const updated = await prisma.migrationLogic.findUniqueOrThrow({
    where: { id: logic.id },
    include: INCLUDE,
  })

  const isNew = logic.createdAt.getTime() === logic.updatedAt.getTime()
  await logAction(planId, isNew ? 'MIGRATION_LOGIC_CREATED' : 'MIGRATION_LOGIC_UPDATED', {
    fieldMappingId,
    sectionType: input.sectionType,
    status: input.status,
  })

  return toDTO(updated)
}

/**
 * Delete migration logic for a fieldMapping.
 * Cascades to ValueEquivalence and ClassificationPrompt.
 */
export async function deleteMigrationLogic(fieldMappingId: string, planId: string | null): Promise<void> {
  const logic = await prisma.migrationLogic.findUnique({ where: { fieldMappingId } })
  if (!logic) throw new MigrationLogicNotFoundError(fieldMappingId)

  await prisma.migrationLogic.delete({ where: { fieldMappingId } })

  console.log('[migration-logic] deleted', { fieldMappingId })
  await logAction(planId, 'MIGRATION_LOGIC_DELETED', { fieldMappingId })
}
