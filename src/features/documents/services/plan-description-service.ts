// 018-rule-description-engine — High-level service: generates PlanDescription (v4-native)
//
// Ported from v3 src/lib/services/rule-description-engine.ts (generatePlanDescription),
// rebuilt on top of the v4 pure per-rule generators (src/features/documents/lib/rule-description.ts)
// and the v4 section-type derivation (src/features/field-mapping/lib/type-compatibility.ts).
//
// Key v4 differences vs v3:
//   - There is NO MigrationLogic.sectionType column. The section type (D1/D2/D3/D4) is COMPUTED
//     from the source/destination field types via getSectionType(srcType, dstType).
//   - ObjectMapping has `filters` (NOT `migrationFilters`) and NO `createdAt` — we order by
//     sourceObjectName for a stable, human-readable ordering.
//   - FieldMapping carries the raw connector types (sourceFieldType / destinationFieldType) and a
//     `compatibilityStatus` enum (NOT `typeCompatibility`); the latter is surfaced to the UI.
//   - VALUE_EQUIVALENCE pairs come from migrationLogic.valueEquivalences; PROMPT text from
//     migrationLogic.classificationPrompt.promptText.

import { prisma } from '@/lib/prisma'
import { getSectionType } from '@/features/field-mapping/lib/type-compatibility'
import {
  describeDirectCopy,
  describeValueEquivalence,
  describeInformational,
  describeError,
  describePromptFallback,
} from '@/features/documents/lib/rule-description'
import type {
  PlanDescription,
  ObjectMappingDescription,
  RuleDescription,
} from '@/features/documents/types/plan-description'

// --- Filter description templates (v4 FilterOperator set, see prisma schema) ---

function describeFilter(fieldApiName: string, operator: string, value: string | null): string {
  const v = value ?? ''
  switch (operator) {
    case 'EQUALS':
      return `Seuls les enregistrements où ${fieldApiName} est égal à « ${v} » sont inclus.`
    case 'NOT_EQUALS':
      return `Seuls les enregistrements où ${fieldApiName} est différent de « ${v} » sont inclus.`
    case 'CONTAINS':
      return `Seuls les enregistrements où ${fieldApiName} contient « ${v} » sont inclus.`
    case 'NOT_CONTAINS':
      return `Seuls les enregistrements où ${fieldApiName} ne contient pas « ${v} » sont inclus.`
    case 'STARTS_WITH':
      return `Seuls les enregistrements où ${fieldApiName} commence par « ${v} » sont inclus.`
    case 'ENDS_WITH':
      return `Seuls les enregistrements où ${fieldApiName} se termine par « ${v} » sont inclus.`
    case 'GREATER_THAN':
      return `Seuls les enregistrements où ${fieldApiName} est supérieur à « ${v} » sont inclus.`
    case 'LESS_THAN':
      return `Seuls les enregistrements où ${fieldApiName} est inférieur à « ${v} » sont inclus.`
    case 'IS_NULL':
      return `Seuls les enregistrements où ${fieldApiName} est vide sont inclus.`
    case 'DATE_AFTER':
      return `Seuls les enregistrements où ${fieldApiName} est après le « ${v} » sont inclus.`
    case 'DATE_BEFORE':
      return `Seuls les enregistrements où ${fieldApiName} est avant le « ${v} » sont inclus.`
    default:
      return `Seuls les enregistrements correspondant à un filtre sur ${fieldApiName} sont inclus.`
  }
}

function buildFilterSummary(filterDescriptions: string[]): string {
  if (filterDescriptions.length === 0) return 'Aucun filtre appliqué — tous les enregistrements sont inclus.'
  if (filterDescriptions.length === 1) return filterDescriptions[0]
  return `${filterDescriptions.length} filtres sont appliqués à cet objet.`
}

// --- Per-field migration description (v4-native dispatch via getSectionType) ---

interface FieldMappingWithLogic {
  id: string
  sourceFieldName: string
  destinationFieldName: string
  sourceFieldType: string
  destinationFieldType: string
  compatibilityStatus: string
  migrationLogic:
    | {
        valueEquivalences: { sourceValue: string; destinationValue: string }[]
        classificationPrompt: { promptText: string } | null
      }
    | null
}

/**
 * Compute the plain-language migration description for one field mapping.
 *
 * The section type is derived from the field types via getSectionType, mirroring the
 * migration-logic modal. INCOMPATIBLE compatibility short-circuits to the ERROR template
 * regardless of derived section, because the field cannot be migrated automatically.
 */
function describeFieldMigration(fm: FieldMappingWithLogic): string {
  const srcType = fm.sourceFieldType || 'unknown'
  const dstType = fm.destinationFieldType || 'unknown'

  // Hard incompatibility wins — the field is excluded from automated migration.
  if (fm.compatibilityStatus === 'INCOMPATIBLE') {
    return describeError(srcType, dstType)
  }

  const sectionType = getSectionType(srcType, dstType)

  switch (sectionType) {
    case 'VALUE_EQUIVALENCE':
      return describeValueEquivalence(fm.migrationLogic?.valueEquivalences ?? [])
    case 'PROMPT':
      return describePromptFallback(fm.migrationLogic?.classificationPrompt?.promptText ?? null)
    case 'ERROR':
      return describeError(srcType, dstType)
    case 'INFORMATIONAL':
    default:
      // D4: an authored informational message overrides the generic direct-copy line.
      if (fm.migrationLogic?.classificationPrompt?.promptText) {
        return describeInformational(fm.migrationLogic.classificationPrompt.promptText)
      }
      return describeDirectCopy(srcType, dstType)
  }
}

// --- Main service function ---

/**
 * Generate a complete PlanDescription for a given plan.
 *
 * Aggregates all object mappings, field mappings, migration logic, and active filters
 * into a single structured description ready for client-facing review.
 *
 * Fully template-based (no LLM). PROMPT rules surface their raw prompt text via the
 * pure fallback; the `enhance` flag is accepted at the route layer but does not change
 * the output until the Claude wiring lands.
 */
export async function generatePlanDescription(planId: string): Promise<PlanDescription> {
  // 1. Fetch plan name
  const plan = await prisma.migrationPlan.findUniqueOrThrow({ where: { id: planId } })

  // 2. Load all object mappings with related data (v4 relation names)
  const objectMappings = await prisma.objectMapping.findMany({
    where: { planId },
    include: {
      filters: true,
      fieldMappings: {
        include: {
          migrationLogic: {
            include: {
              valueEquivalences: true,
              classificationPrompt: true,
            },
          },
        },
      },
    },
    orderBy: { sourceObjectName: 'asc' },
  })

  // 3. Assemble the description per object mapping
  const objectDescriptions: ObjectMappingDescription[] = objectMappings.map((om) => {
    const activeFilters = om.filters.filter((f) => f.isActive)
    const filterDescs = activeFilters.map((f) => describeFilter(f.fieldApiName, f.operator, f.value))

    const fieldDescriptions: RuleDescription[] = om.fieldMappings.map((fm) => ({
      fieldMappingId: fm.id,
      sourceField: fm.sourceFieldName,
      destField: fm.destinationFieldName,
      migrationDescription: describeFieldMigration(fm),
      // Per-field active filters that target this source field.
      filterDescriptions: activeFilters
        .filter((f) => f.fieldApiName === fm.sourceFieldName)
        .map((f) => describeFilter(f.fieldApiName, f.operator, f.value)),
      typeCompatibility: fm.compatibilityStatus,
    }))

    return {
      objectMappingId: om.id,
      sourceObject: om.sourceObjectName,
      destObject: om.destinationObjectName,
      fieldDescriptions,
      filterSummary: buildFilterSummary(filterDescs),
      // Schema-level unmapped counts are produced by the document generators (019/020).
      // The description view keeps these at 0 to avoid a second full schema load.
      unmappedSourceCount: 0,
      unmappedDestCount: 0,
    }
  })

  return {
    planId,
    planName: plan.name,
    objectMappings: objectDescriptions,
    generatedAt: new Date().toISOString(),
  }
}
