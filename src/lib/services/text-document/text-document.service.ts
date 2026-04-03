// 019-text-document — Service: orchestrates data loading, rule description, HTML generation

import { generatePlanDescription } from '@/lib/services/rule-description-engine'
import { detectUnmappedFields } from '@/lib/services/unmapped-fields'
import { logAction } from '@/lib/services/audit-service'
import { prisma } from '@/lib/db/prisma'
import { buildFullDocument } from './template-builder'
import type { TextDocument, TextDocumentData, ObjectSectionData, FieldRowData, GenerationStats } from './types'

/**
 * Generate a text document for the given plan.
 *
 * Steps:
 *   1. Verify plan exists.
 *   2. Call generatePlanDescription (018) to get per-field migration logic descriptions.
 *   3. Call detectUnmappedFields (016) to get per-object unmapped field lists.
 *   4. Assemble TextDocumentData.
 *   5. Build HTML via template-builder.
 *   6. Return TextDocument (not persisted — no Prisma model modification per constraint).
 */
export async function generateTextDocument(planId: string): Promise<TextDocument> {
  console.log(`[text-document] Starting generation for plan ${planId}`)

  // 1. Load plan details
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`)
  }

  // 2. Generate descriptions (calls 018 rule description engine)
  console.log(`[text-document] Calling rule description engine for plan ${planId}`)
  const planDescription = await generatePlanDescription(planId)

  // 3. Detect unmapped fields (calls 016)
  console.log(`[text-document] Detecting unmapped fields for plan ${planId}`)
  const unmappedReport = await detectUnmappedFields(planId)

  // Build index of unmapped data by objectMappingId for quick lookup
  const unmappedByObjectMappingId = new Map(
    unmappedReport.objectMappings.map((om) => [om.objectMappingId, om]),
  )

  // 4. Assemble TextDocumentData
  let totalFieldCount = 0
  let totalRuleCount = 0
  let totalUnmappedCount = unmappedReport.summary.totalUnmappedSource + unmappedReport.summary.totalUnmappedDest

  const objectSections: ObjectSectionData[] = planDescription.objectMappings.map((om) => {
    const unmapped = unmappedByObjectMappingId.get(om.objectMappingId)

    const fields: FieldRowData[] = om.fieldDescriptions.map((fd) => {
      if (fd.migrationDescription && fd.migrationDescription !== 'No migration logic defined.') {
        totalRuleCount++
      }
      return {
        sourceField: fd.sourceField,
        destField: fd.destField,
        typeCompatibility: fd.typeCompatibility,
        migrationDescription:
          fd.migrationDescription || 'No migration logic defined.',
      }
    })

    totalFieldCount += fields.length

    return {
      sourceObject: om.sourceObject,
      destObject: om.destObject,
      fields,
      filterSummary: om.filterSummary,
      unmappedSourceFields: unmapped?.unmappedSourceFields ?? [],
      unmappedDestFields: unmapped?.unmappedDestFields ?? [],
    }
  })

  const generatedAt = new Date().toISOString()

  const stats: GenerationStats = {
    fieldCount: totalFieldCount,
    ruleCount: totalRuleCount,
    unmappedCount: totalUnmappedCount,
    llmCallCount: 0, // No direct visibility into LLM call count from this layer
  }

  const documentData: TextDocumentData = {
    planId,
    planName: plan.name,
    planDescription: plan.description ?? null,
    generatedAt,
    objectSections,
    stats,
  }

  // 5. Build HTML
  console.log(`[text-document] Building HTML for plan ${planId} (${objectSections.length} objects, ${totalFieldCount} fields)`)
  const html = buildFullDocument(documentData)

  // 6. Log to audit trail
  await logAction(planId, 'TEXT_DOCUMENT_GENERATED', {
    objectCount: objectSections.length,
    fieldCount: totalFieldCount,
    ruleCount: totalRuleCount,
    unmappedCount: totalUnmappedCount,
  })

  console.log(`[text-document] Document generated successfully for plan ${planId}`)

  return {
    planId,
    planName: plan.name,
    generatedAt,
    stats,
    html,
  }
}
