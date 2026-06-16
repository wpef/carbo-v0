// 019-text-document — Service de génération du document technique
//
// Câble describeRule (018) pour tous les types de règles et computeUnmappedFields (016)
// pour la section champs non-mappés. Persiste unmappedCount et llmCallCount.

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import {
  describeRule,
  type RuleDescriptionInput,
  type RuleType,
} from '@/features/documents/lib/rule-description'
import { computeUnmappedFields } from '@/features/unmapped/lib/compute-unmapped'
import type { ConnectorField } from '@/lib/types/connector'

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface FieldRow {
  sourceFieldName: string
  sourceFieldLabel: string
  destinationFieldName: string
  destinationFieldLabel: string
  sourceType: string
  destType: string
  description: string
  ruleType: string
  isFallback: boolean
}

interface ObjectSection {
  sourceObjectName: string
  destinationObjectName: string
  fieldRows: FieldRow[]
  filters: { fieldApiName: string; operator: string; value: string | null; isActive: boolean }[]
  unmappedSourceFields: { apiName: string; label: string; dataType: string }[]
  unmappedRequiredDestFields: { apiName: string; label: string; dataType: string }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toConnectorField(f: {
  apiName: string
  label: string
  dataType: string
  isRequired?: boolean
}): ConnectorField {
  return {
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: f.isRequired ?? false,
    isReadOnly: false,
    isUnique: false,
  }
}

/**
 * Résout le type de règle à partir du MigrationLogic Prisma.
 * Logique de détection basée sur les champs présents (spec 013).
 */
function resolveRuleType(logic: {
  config: string
  valueEquivalences: { sourceValue: string; destinationValue: string }[]
  classificationPrompt: { promptText: string } | null
} | null): RuleType | null {
  if (!logic) return null

  if (logic.valueEquivalences.length > 0) return 'VALUE_EQUIVALENCE'
  if (logic.classificationPrompt) {
    // Si config contient "INFORMATIONAL", c'est un INFORMATIONAL
    try {
      const cfg = JSON.parse(logic.config || '{}')
      if (cfg.type === 'INFORMATIONAL') return 'INFORMATIONAL'
      if (cfg.type === 'ERROR') return 'ERROR'
      if (cfg.type === 'PROMPT') return 'PROMPT'
    } catch {
      // malformed config — fall through
    }
    // Par défaut avec classificationPrompt → PROMPT
    return 'PROMPT'
  }
  // Lire le type depuis config
  try {
    const cfg = JSON.parse(logic.config || '{}')
    if (cfg.type === 'INFORMATIONAL') return 'INFORMATIONAL'
    if (cfg.type === 'ERROR') return 'ERROR'
    if (cfg.type === 'PROMPT') return 'PROMPT'
    if (cfg.type === 'DIRECT_COPY') return 'DIRECT_COPY'
  } catch {
    // malformed config
  }
  return 'DIRECT_COPY'
}

// ---------------------------------------------------------------------------
// generateTextDocument
// ---------------------------------------------------------------------------

export async function generateTextDocument(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      sourceConnection: true,
      destinationConnection: true,
      objectMappings: {
        include: {
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
          filters: true,
          exclusions: true,
        },
      },
    },
  })

  const sourceSnapshot = plan.sourceConnectionId
    ? await prisma.schemaSnapshot.findUnique({
        where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
        include: { objects: { include: { fields: true } } },
      })
    : null

  const destSnapshot = plan.destinationConnectionId
    ? await prisma.schemaSnapshot.findUnique({
        where: { connectionId_side_status: { connectionId: plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
        include: { objects: { include: { fields: true } } },
      })
    : null

  let totalFields = 0
  let totalRules = 0
  let totalUnmapped = 0
  let totalLlmCalls = 0

  const objectSections: ObjectSection[] = plan.objectMappings.map((om) => {
    const srcObj = sourceSnapshot?.objects.find((o) => o.apiName === om.sourceObjectName)
    const dstObj = destSnapshot?.objects.find((o) => o.apiName === om.destinationObjectName)

    const sourceFieldMap = new Map((srcObj?.fields ?? []).map((f) => [f.apiName, f]))
    const destFieldMap = new Map((dstObj?.fields ?? []).map((f) => [f.apiName, f]))

    // Compute unmapped fields via coeur pur
    const unmappedReport = computeUnmappedFields(
      (srcObj?.fields ?? []).map(toConnectorField),
      (dstObj?.fields ?? []).map(toConnectorField),
      om.fieldMappings.map((fm) => ({
        sourceFieldName: fm.sourceFieldName,
        destinationFieldName: fm.destinationFieldName,
      })),
      om.exclusions.map((ex) => ({
        id: ex.id,
        sourceFieldName: ex.sourceFieldName,
        reason: ex.reason,
        createdAt: ex.createdAt.toISOString(),
      })),
    )

    totalUnmapped += unmappedReport.unmappedSourceFields.length

    // Build field rows using describeRule
    const fieldRows: FieldRow[] = om.fieldMappings.map((fm) => {
      const srcField = sourceFieldMap.get(fm.sourceFieldName)
      const dstField = destFieldMap.get(fm.destinationFieldName)
      const srcType = srcField?.dataType ?? 'unknown'
      const dstType = dstField?.dataType ?? 'unknown'

      const ruleType = resolveRuleType(fm.migrationLogic)

      let input: RuleDescriptionInput
      let isLlmCall = false

      if (ruleType === null || ruleType === 'DIRECT_COPY') {
        input = { ruleType: 'DIRECT_COPY', sourceDataType: srcType, destDataType: dstType }
      } else if (ruleType === 'VALUE_EQUIVALENCE') {
        input = {
          ruleType: 'VALUE_EQUIVALENCE',
          valueEquivalences: fm.migrationLogic!.valueEquivalences,
        }
      } else if (ruleType === 'INFORMATIONAL') {
        input = {
          ruleType: 'INFORMATIONAL',
          informationalMessage: fm.migrationLogic?.classificationPrompt?.promptText ?? null,
        }
      } else if (ruleType === 'ERROR') {
        input = { ruleType: 'ERROR', sourceType: srcType, destType: dstType }
      } else if (ruleType === 'PROMPT') {
        input = {
          ruleType: 'PROMPT',
          promptText: fm.migrationLogic?.classificationPrompt?.promptText ?? null,
        }
        // TODO: wiring réel Claude API ici quand ANTHROPIC_API_KEY disponible
        isLlmCall = false // fallback uniquement pour l'instant
      } else {
        input = { ruleType: 'INCOMPATIBLE', sourceType: srcType, destType: dstType }
      }

      if (fm.compatibilityStatus === 'INCOMPATIBLE') {
        input = { ruleType: 'ERROR', sourceType: srcType, destType: dstType }
        ruleType // overridden
      }

      const { description, source } = describeRule(input)
      // TODO: when the Claude API is wired for PROMPT rules, increment on real LLM calls.
      if (isLlmCall) totalLlmCalls++

      if (ruleType !== null && ruleType !== 'DIRECT_COPY') totalRules++

      return {
        sourceFieldName: fm.sourceFieldName,
        sourceFieldLabel: srcField?.label ?? fm.sourceFieldName,
        destinationFieldName: fm.destinationFieldName,
        destinationFieldLabel: dstField?.label ?? fm.destinationFieldName,
        sourceType: srcType,
        destType: dstType,
        description,
        ruleType: ruleType ?? 'DIRECT_COPY',
        isFallback: source === 'fallback',
      }
    })

    totalFields += fieldRows.length

    return {
      sourceObjectName: om.sourceObjectName,
      destinationObjectName: om.destinationObjectName,
      fieldRows,
      filters: om.filters.map((f) => ({
        fieldApiName: f.fieldApiName,
        operator: f.operator,
        value: f.value,
        isActive: f.isActive,
      })),
      unmappedSourceFields: unmappedReport.unmappedSourceFields,
      unmappedRequiredDestFields: unmappedReport.unmappedRequiredDestFields,
    }
  })

  const html = renderTextDocumentHtml({
    planName: plan.name,
    planDescription: plan.description,
    sourceName: plan.sourceConnection?.name ?? 'N/A',
    destName: plan.destinationConnection?.name ?? 'N/A',
    objectCount: objectSections.length,
    fieldCount: totalFields,
    ruleCount: totalRules,
    unmappedCount: totalUnmapped,
    llmCallCount: totalLlmCalls,
    sections: objectSections,
    generatedAt: new Date().toISOString(),
  })

  // Marquer les anciens comme OUTDATED
  await prisma.textDocument.updateMany({
    where: { planId, status: 'CURRENT' },
    data: { status: 'OUTDATED' },
  })

  const doc = await prisma.textDocument.create({
    data: {
      planId,
      htmlContent: html,
      objectCount: objectSections.length,
      fieldCount: totalFields,
      ruleCount: totalRules,
      unmappedCount: totalUnmapped,
      llmCallCount: totalLlmCalls,
    },
  })

  await logAuditEvent({
    planId,
    action: 'GENERATE_TEXT_DOCUMENT',
    entity: 'TextDocument',
    entityId: doc.id,
    details: {
      objectCount: objectSections.length,
      fieldCount: totalFields,
      ruleCount: totalRules,
      unmappedCount: totalUnmapped,
      llmCallCount: totalLlmCalls,
    },
  })

  return doc
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listTextDocuments(planId: string) {
  return prisma.textDocument.findMany({
    where: { planId },
    select: {
      id: true,
      version: true,
      status: true,
      objectCount: true,
      fieldCount: true,
      ruleCount: true,
      unmappedCount: true,
      llmCallCount: true,
      generatedAt: true,
    },
    orderBy: { generatedAt: 'desc' },
  })
}

export async function getTextDocument(documentId: string) {
  return prisma.textDocument.findUniqueOrThrow({ where: { id: documentId } })
}

// ---------------------------------------------------------------------------
// Rendu HTML
// ---------------------------------------------------------------------------

interface TextDocumentData {
  planName: string
  planDescription: string | null
  sourceName: string
  destName: string
  objectCount: number
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
  generatedAt: string
  sections: ObjectSection[]
}

const FILTER_LABEL: Record<string, string> = {
  EQUALS: 'est égal à',
  NOT_EQUALS: 'est différent de',
  CONTAINS: 'contient',
  NOT_CONTAINS: 'ne contient pas',
  STARTS_WITH: 'commence par',
  ENDS_WITH: 'se termine par',
  GREATER_THAN: 'supérieur à',
  LESS_THAN: 'inférieur à',
  IS_NULL: 'est vide',
  DATE_AFTER: 'est après le',
  DATE_BEFORE: 'est avant le',
}

function compatibilityBadge(srcType: string, dstType: string): string {
  if (srcType === dstType) return `<span class="badge-ok">Compatibles (${srcType})</span>`
  return `<span class="badge-warn">Conversion (${srcType} → ${dstType})</span>`
}

function renderTextDocumentHtml(data: TextDocumentData): string {
  const sections = data.sections.map((s, idx) => {
    const fieldRows = s.fieldRows.length > 0
      ? s.fieldRows.map((d) => `
      <tr${d.isFallback ? ' class="row-fallback"' : ''}>
        <td><strong>${escHtml(d.sourceFieldLabel)}</strong><br><code>${escHtml(d.sourceFieldName)}</code></td>
        <td><strong>${escHtml(d.destinationFieldLabel)}</strong><br><code>${escHtml(d.destinationFieldName)}</code></td>
        <td>${escHtml(d.sourceType)}</td>
        <td>${escHtml(d.destType)}</td>
        <td>${compatibilityBadge(d.sourceType, d.destType)}</td>
        <td${d.isFallback ? ' class="fallback-cell"' : ''}>${d.description.replace(/\n/g, '<br>')}</td>
      </tr>`).join('')
      : `<tr><td colspan="6"><em>Aucun mapping de champ défini.</em></td></tr>`

    const activeFilters = s.filters.filter((f) => f.isActive)
    const filterBlock = activeFilters.length > 0
      ? `<h4>Filtres de migration</h4><ul>${activeFilters.map((f) =>
          `<li><strong>${escHtml(f.fieldApiName)}</strong> ${escHtml(FILTER_LABEL[f.operator] ?? f.operator)} ${f.value ? escHtml(f.value) : ''}</li>`
        ).join('')}</ul>`
      : `<h4>Filtres de migration</h4><p><em>Aucun filtre défini — tous les enregistrements seront migrés.</em></p>`

    const unmappedBlock = (s.unmappedSourceFields.length > 0 || s.unmappedRequiredDestFields.length > 0)
      ? `<div class="warning">
          <h4>Champs source non-mappés (ne seront PAS migrés)</h4>
          ${s.unmappedSourceFields.length > 0
            ? `<ul>${s.unmappedSourceFields.map((f) => `<li><code>${escHtml(f.apiName)}</code> <span class="meta">[${escHtml(f.dataType)}] ${escHtml(f.label)}</span></li>`).join('')}</ul>`
            : '<p><em>Tous les champs source sont mappés.</em></p>'}
          ${s.unmappedRequiredDestFields.length > 0
            ? `<h4>Champs destination requis non-couverts</h4><ul>${s.unmappedRequiredDestFields.map((f) => `<li><code>${escHtml(f.apiName)}</code> <span class="meta">[${escHtml(f.dataType)}] ${escHtml(f.label)}</span></li>`).join('')}</ul>`
            : ''}
         </div>`
      : `<p class="ok-notice">Couverture complète — tous les champs source sont mappés.</p>`

    return `
      <section id="section-${idx}">
        <h3>${idx + 1}. ${escHtml(s.sourceObjectName)} → ${escHtml(s.destinationObjectName)}</h3>
        <table>
          <thead>
            <tr>
              <th>Champ source</th>
              <th>Champ destination</th>
              <th>Type source</th>
              <th>Type dest.</th>
              <th>Compatibilité</th>
              <th>Règle de migration</th>
            </tr>
          </thead>
          <tbody>${fieldRows}</tbody>
        </table>
        ${filterBlock}
        ${unmappedBlock}
      </section>`
  }).join('')

  const toc = data.sections.length >= 3
    ? `<nav aria-label="Table des matières"><h3>Table des matières</h3><ol>${
        data.sections.map((s, i) => `<li><a href="#section-${i}">${escHtml(s.sourceObjectName)} → ${escHtml(s.destinationObjectName)}</a></li>`).join('')
      }</ol></nav>`
    : ''

  const noObjMsg = data.sections.length === 0
    ? `<div class="warning"><p>Aucun mapping d'objet défini pour ce plan de migration.</p></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Document Technique — ${escHtml(data.planName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h3 { margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
    h4 { margin-top: 1rem; color: #444; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.88rem; }
    th, td { border: 1px solid #ddd; padding: 0.45rem 0.6rem; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr.row-fallback { background: #fff8e1; }
    td.fallback-cell { font-family: monospace; font-size: 0.82rem; color: #7b5800; }
    .meta { color: #666; font-size: 0.85rem; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 0.6rem 1rem; margin: 0.8rem 0; border-radius: 3px; }
    .ok-notice { color: #2e7d32; font-size: 0.9rem; }
    .badge-ok { background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 3px; font-size: 0.78rem; }
    .badge-warn { background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 3px; font-size: 0.78rem; }
    code { background: #f0f0f0; padding: 1px 4px; border-radius: 2px; font-size: 0.82rem; }
    nav ol { columns: 2; gap: 2rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin: 1rem 0; }
    .stat-card { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px; padding: 0.6rem 1rem; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: bold; color: #1565c0; }
    .stat-label { font-size: 0.78rem; color: #666; }
    @media print {
      tr { break-inside: avoid; page-break-inside: avoid; }
      h2, h3 { break-inside: avoid; page-break-inside: avoid; break-after: avoid; }
      .warning { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Document Technique de Migration</h1>
  <h2>${escHtml(data.planName)}</h2>
  ${data.planDescription ? `<p>${escHtml(data.planDescription)}</p>` : ''}

  <div class="meta">
    <p><strong>Source :</strong> ${escHtml(data.sourceName)} &nbsp;|&nbsp; <strong>Destination :</strong> ${escHtml(data.destName)}</p>
    <p><strong>Généré le :</strong> ${new Date(data.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${data.objectCount}</div><div class="stat-label">Objets mappés</div></div>
    <div class="stat-card"><div class="stat-value">${data.fieldCount}</div><div class="stat-label">Champs mappés</div></div>
    <div class="stat-card"><div class="stat-value">${data.ruleCount}</div><div class="stat-label">Règles de migration</div></div>
    <div class="stat-card"><div class="stat-value">${data.unmappedCount}</div><div class="stat-label">Champs non-mappés</div></div>
  </div>

  ${toc}
  ${noObjMsg}
  ${sections}
</body>
</html>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
