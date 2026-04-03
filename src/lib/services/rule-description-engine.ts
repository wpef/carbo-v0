// 018-rule-description-engine — High-level service: generates PlanDescription

import { prisma } from '@/lib/db/prisma'
import { generateDescriptions } from './rule-description'
import type { DescriptionRequest } from './rule-description'
import type { SectionType } from '@/lib/types/mapping'
import type { FilterOperator } from '@/lib/types/filter'
import type { PlanDescription, ObjectMappingDescription, RuleDescription } from '@/lib/types/rule-description'

// --- Filter description templates ---

function describeFilter(fieldApiName: string, operator: FilterOperator, value: string | null): string {
  switch (operator) {
    case 'EQUALS':
      return `Only records where ${fieldApiName} equals '${value}' are included.`
    case 'NOT_EQUALS':
      return `Only records where ${fieldApiName} does not equal '${value}' are included.`
    case 'CONTAINS':
      return `Only records where ${fieldApiName} contains '${value}' are included.`
    case 'NOT_CONTAINS':
      return `Only records where ${fieldApiName} does not contain '${value}' are included.`
    case 'GREATER_THAN':
      return `Only records where ${fieldApiName} is greater than '${value}' are included.`
    case 'LESS_THAN':
      return `Only records where ${fieldApiName} is less than '${value}' are included.`
    case 'IS_NULL':
      return `Only records where ${fieldApiName} is empty are included.`
    case 'IS_NOT_NULL':
      return `Only records where ${fieldApiName} is not empty are included.`
    case 'IN':
      return `Only records where ${fieldApiName} is one of: ${value} are included.`
    case 'NOT_IN':
      return `Only records where ${fieldApiName} is not one of: ${value} are included.`
    default:
      return `Only records matching a filter on ${fieldApiName} are included.`
  }
}

function buildFilterSummary(filterDescriptions: string[]): string {
  if (filterDescriptions.length === 0) return 'No filters applied — all records are included.'
  if (filterDescriptions.length === 1) return filterDescriptions[0]
  return `${filterDescriptions.length} filters are applied to this object.`
}

// --- Main service function ---

/**
 * Generate a complete PlanDescription for a given plan.
 *
 * Aggregates all object mappings, field mappings, migration logic, and active filters
 * into a single structured description ready for client-facing documents.
 *
 * Template-based rules are resolved locally; PROMPT rules are sent to the LLM client.
 */
export async function generatePlanDescription(planId: string): Promise<PlanDescription> {
  // 1. Fetch plan name
  const plan = await prisma.migrationPlan.findUniqueOrThrow({ where: { id: planId } })

  // 2. Load all object mappings with related data
  const objectMappings = await prisma.objectMapping.findMany({
    where: { planId },
    include: {
      migrationFilters: true,
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
    orderBy: { createdAt: 'asc' },
  })

  // 3. Collect all DescriptionRequests across all field mappings (to batch LLM calls)
  interface RequestSlot {
    objectMappingIndex: number
    fieldMappingIndex: number
    requestIndex: number
  }

  const allRequests: DescriptionRequest[] = []
  const slots: RequestSlot[] = []

  // Store intermediate structure for later assembly
  const objectMappingData: Array<{
    objectMappingId: string
    sourceObject: string
    destObject: string
    filterDescriptions: string[]
    unmappedSourceCount: number
    unmappedDestCount: number
    fieldRows: Array<{
      fieldMappingId: string
      sourceField: string
      destField: string
      typeCompatibility: string
      requestIndex: number
      filterDescriptions: string[]
    }>
  }> = []

  for (let omIdx = 0; omIdx < objectMappings.length; omIdx++) {
    const om = objectMappings[omIdx]

    // Active filter descriptions for this object mapping
    const activeFilters = om.migrationFilters.filter((f) => f.isActive)
    const filterDescs = activeFilters.map((f) =>
      describeFilter(f.fieldApiName, f.operator as FilterOperator, f.value),
    )

    // Unmapped counts: rough estimate (we don't load full schema here, keep it 0 for now)
    // Document generation features (019/020) can enrich this separately.
    const unmappedSourceCount = 0
    const unmappedDestCount = 0

    const fieldRows: (typeof objectMappingData)[number]['fieldRows'] = []

    for (let fmIdx = 0; fmIdx < om.fieldMappings.length; fmIdx++) {
      const fm = om.fieldMappings[fmIdx]
      const logic = fm.migrationLogic

      const reqIdx = allRequests.length

      if (logic) {
        const req: DescriptionRequest = {
          ruleId: logic.id,
          logicType: logic.sectionType as SectionType,
        }

        switch (logic.sectionType as SectionType) {
          case 'VALUE_EQUIVALENCE':
            req.valueEquivalences = logic.valueEquivalences.map((ve) => ({
              sourceValue: ve.sourceValue,
              destinationValue: ve.destinationValue,
            }))
            break
          case 'INFORMATIONAL':
            req.informationalMessage = logic.classificationPrompt?.promptText ?? undefined
            break
          case 'ERROR':
            req.sourceType = undefined
            req.destType = undefined
            break
          case 'PROMPT':
            req.promptText = logic.classificationPrompt?.promptText ?? undefined
            break
        }

        allRequests.push(req)
        slots.push({ objectMappingIndex: omIdx, fieldMappingIndex: fmIdx, requestIndex: reqIdx })
      }

      fieldRows.push({
        fieldMappingId: fm.id,
        sourceField: fm.sourceFieldApiName,
        destField: fm.destFieldApiName,
        typeCompatibility: fm.typeCompatibility,
        requestIndex: logic ? reqIdx : -1,
        filterDescriptions: [],
      })
    }

    objectMappingData.push({
      objectMappingId: om.id,
      sourceObject: om.sourceObjectApiName,
      destObject: om.destObjectApiName,
      filterDescriptions: filterDescs,
      unmappedSourceCount,
      unmappedDestCount,
      fieldRows,
    })
  }

  // 4. Generate all descriptions in one batch
  const batch = allRequests.length > 0 ? await generateDescriptions(allRequests) : { descriptions: [] }

  // 5. Assemble the final PlanDescription
  const objectDescriptions: ObjectMappingDescription[] = objectMappingData.map((omData) => {
    const fieldDescriptions: RuleDescription[] = omData.fieldRows.map((row) => {
      let migrationDescription = 'No migration logic defined.'
      if (row.requestIndex >= 0 && batch.descriptions[row.requestIndex]) {
        migrationDescription = batch.descriptions[row.requestIndex].description
      }

      return {
        fieldMappingId: row.fieldMappingId,
        sourceField: row.sourceField,
        destField: row.destField,
        migrationDescription,
        filterDescriptions: row.filterDescriptions,
        typeCompatibility: row.typeCompatibility,
      }
    })

    return {
      objectMappingId: omData.objectMappingId,
      sourceObject: omData.sourceObject,
      destObject: omData.destObject,
      fieldDescriptions,
      filterSummary: buildFilterSummary(omData.filterDescriptions),
      unmappedSourceCount: omData.unmappedSourceCount,
      unmappedDestCount: omData.unmappedDestCount,
    }
  })

  return {
    planId,
    planName: plan.name,
    objectMappings: objectDescriptions,
    generatedAt: new Date().toISOString(),
  }
}
