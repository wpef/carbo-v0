// 020-contractual-document — Main service: orchestrates document generation

import { generatePlanDescription } from '@/lib/services/rule-description-engine'
import { detectUnmappedFields } from '@/lib/services/unmapped-fields'
import { logAction } from '@/lib/services/audit-service'
import { generateReferenceNumber } from './reference-generator'
import {
  buildScopeSection,
  buildObjectMappingsSection,
  buildFieldMappingsSection,
  buildTransformationRulesSection,
  buildFilterSection,
  buildExclusionsSection,
  buildSignatureBlock,
  buildFullDocument,
} from './template-builder'
import type { ContractualDocument, GenerationStats, ScopeData, SignatureBlockData } from './types'

/**
 * Generate a contractual document for the given plan.
 *
 * Orchestrates:
 *   1. Fetching plan description via rule-description-engine (018)
 *   2. Detecting unmapped fields via unmapped-fields (016)
 *   3. Generating a unique reference number
 *   4. Building all articles (HTML fragments)
 *   5. Composing the full HTML document
 *   6. Logging to audit trail (Constitution Principle VI)
 *
 * Returns the full ContractualDocument (no DB persistence — schema.prisma not modified per constraint).
 */
export async function generateContractualDocument(planId: string): Promise<ContractualDocument> {
  console.log(`[contractual-document] Generating document for plan ${planId}`)

  // 1. Load plan description (includes migration logic descriptions + filter summaries)
  const planDescription = await generatePlanDescription(planId)

  // 2. Detect unmapped fields
  const unmappedReport = await detectUnmappedFields(planId)

  // 3. Generate unique reference number
  const referenceNumber = generateReferenceNumber()
  const generatedAt = new Date().toISOString()

  // 4. Compute stats
  const fieldCount = planDescription.objectMappings.reduce(
    (sum, om) => sum + om.fieldDescriptions.length,
    0,
  )

  const ruleCount = planDescription.objectMappings.reduce(
    (sum, om) =>
      sum + om.fieldDescriptions.filter((fd) => fd.migrationDescription !== 'No migration logic defined.').length,
    0,
  )

  const unmappedCount = unmappedReport.summary.totalUnmappedSource + unmappedReport.summary.totalUnmappedDest

  // Count active filters: filter summaries that are not the "no filters" default
  const filterCount = planDescription.objectMappings.filter(
    (om) => om.filterSummary !== 'No filters applied — all records are included.',
  ).length

  const stats: GenerationStats = {
    fieldCount,
    ruleCount,
    unmappedCount,
    filterCount,
  }

  // 5. Build scope data
  // Source/destination system names are derived from object API names (no dedicated system metadata in v0)
  const sourceObjects = planDescription.objectMappings.map((om) => om.sourceObject)
  const destObjects = planDescription.objectMappings.map((om) => om.destObject)
  const sourceName = sourceObjects.length > 0 ? 'Source System' : 'Source System (not configured)'
  const destName = destObjects.length > 0 ? 'Destination System' : 'Destination System (not configured)'

  const scopeData: ScopeData = {
    sourceName,
    destName,
    objectCount: planDescription.objectMappings.length,
    fieldCount,
    filterCount,
  }

  // 6. Signature block data
  const sigData: SignatureBlockData = {
    consultantName: '',
    clientName: '',
    generationDate: generatedAt,
  }

  // 7. Build articles
  const article1 = buildScopeSection(scopeData)
  const article2 = buildObjectMappingsSection(planDescription.objectMappings)
  const article3 = buildFieldMappingsSection(planDescription.objectMappings)
  const article4 = buildTransformationRulesSection(planDescription.objectMappings)
  const article5 = buildFilterSection(planDescription.objectMappings)
  const article6 = buildExclusionsSection(unmappedReport)
  const article7 = buildSignatureBlock(sigData)

  const articles = [article1, article2, article3, article4, article5, article6, article7]

  // 8. Include TOC only for 3+ object mappings (per spec FR-003 and FR-004)
  const includeTableOfContents = planDescription.objectMappings.length >= 3

  // 9. Build the full HTML document
  const html = buildFullDocument(planDescription.planName, referenceNumber, generatedAt, articles, includeTableOfContents)

  console.log(
    `[contractual-document] Generated ref ${referenceNumber}: ${fieldCount} fields, ${ruleCount} rules, ${unmappedCount} unmapped, ${filterCount} filters`,
  )

  // 10. Audit log (Constitution Principle VI)
  await logAction(planId, 'CONTRACTUAL_DOCUMENT_GENERATED', {
    referenceNumber,
    fieldCount,
    ruleCount,
    unmappedCount,
    filterCount,
  })

  return {
    planId,
    planName: planDescription.planName,
    referenceNumber,
    generatedAt,
    articles,
    html,
    stats,
  }
}
