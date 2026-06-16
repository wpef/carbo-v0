// 020-contractual-document — Service de génération du document contractuel
//
// Structure 7 articles (spec 020 FR-001..FR-015) :
//   Article 1 — Périmètre
//   Article 2 — Correspondances de champs (une sous-section par objet)
//   Article 3 — Règles de migration
//   Article 4 — Exclusions (champs non-mappés, via computeUnmappedFields)
//   Article 5 — Filtres de migration
//   Article 6 — Conditions et réserves
//   Article 7 — Approbation et signature
//
// Numéro de référence unique CARBO-YYYYMMDD-XXXX via comptage DB.
// describeRule (018) câblé pour tous les types de règles.
// unmappedCount + llmCallCount persistés.

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

interface UnmappedEntry {
  apiName: string
  label: string
  dataType: string
}

interface ObjectSection {
  sourceObjectName: string
  destinationObjectName: string
  fieldRows: FieldRow[]
  filters: { fieldApiName: string; operator: string; value: string | null; isActive: boolean }[]
  unmappedSourceFields: UnmappedEntry[]
  unmappedRequiredDestFields: UnmappedEntry[]
}

// ---------------------------------------------------------------------------
// Numéro de référence — unicité réelle via comptage DB (FR-013)
// ---------------------------------------------------------------------------

/**
 * Génère un numéro de référence unique CARBO-YYYYMMDD-XXXX
 * en comptant les documents déjà créés aujourd'hui en base.
 * Utilise le préfixe de la date locale pour correspondre au format attendu.
 */
async function generateReferenceNumberFromDb(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  const prefix = `CARBO-${dateStr}`

  // Compter les documents déjà générés aujourd'hui
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const existingCount = await prisma.contractualDocument.count({
    where: {
      referenceNumber: { startsWith: prefix },
      generatedAt: { gte: todayStart, lte: todayEnd },
    },
  })

  const seq = existingCount + 1
  return `${prefix}-${String(seq).padStart(4, '0')}`
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

function resolveRuleType(logic: {
  config: string
  valueEquivalences: { sourceValue: string; destinationValue: string }[]
  classificationPrompt: { promptText: string } | null
} | null): RuleType | null {
  if (!logic) return null
  if (logic.valueEquivalences.length > 0) return 'VALUE_EQUIVALENCE'
  if (logic.classificationPrompt) {
    try {
      const cfg = JSON.parse(logic.config || '{}')
      if (cfg.type === 'INFORMATIONAL') return 'INFORMATIONAL'
      if (cfg.type === 'ERROR') return 'ERROR'
      if (cfg.type === 'PROMPT') return 'PROMPT'
    } catch { /* malformed config */ }
    return 'PROMPT'
  }
  try {
    const cfg = JSON.parse(logic.config || '{}')
    if (cfg.type === 'INFORMATIONAL') return 'INFORMATIONAL'
    if (cfg.type === 'ERROR') return 'ERROR'
    if (cfg.type === 'PROMPT') return 'PROMPT'
    if (cfg.type === 'DIRECT_COPY') return 'DIRECT_COPY'
  } catch { /* malformed config */ }
  return 'DIRECT_COPY'
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

// ---------------------------------------------------------------------------
// generateContractualDocument
// ---------------------------------------------------------------------------

export async function generateContractualDocument(planId: string) {
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

  // Générer le numéro de référence via DB
  const referenceNumber = await generateReferenceNumberFromDb()

  let totalFields = 0
  let totalRules = 0
  let totalFilters = 0
  let totalUnmapped = 0
  let totalLlmCalls = 0

  const objectSections: ObjectSection[] = plan.objectMappings.map((om) => {
    const srcObj = sourceSnapshot?.objects.find((o) => o.apiName === om.sourceObjectName)
    const dstObj = destSnapshot?.objects.find((o) => o.apiName === om.destinationObjectName)

    const sourceFieldMap = new Map((srcObj?.fields ?? []).map((f) => [f.apiName, f]))
    const destFieldMap = new Map((dstObj?.fields ?? []).map((f) => [f.apiName, f]))

    // Compute unmapped via coeur pur
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

    const activeFilters = om.filters.filter((f) => f.isActive)
    totalFilters += activeFilters.length

    // Build field rows using describeRule
    const fieldRows: FieldRow[] = om.fieldMappings.map((fm) => {
      const srcField = sourceFieldMap.get(fm.sourceFieldName)
      const dstField = destFieldMap.get(fm.destinationFieldName)
      const srcType = srcField?.dataType ?? 'unknown'
      const dstType = dstField?.dataType ?? 'unknown'

      let ruleType = resolveRuleType(fm.migrationLogic)
      if (fm.compatibilityStatus === 'INCOMPATIBLE') ruleType = 'ERROR'

      let input: RuleDescriptionInput
      let isLlmCall = false

      if (!ruleType || ruleType === 'DIRECT_COPY') {
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
        // TODO: wiring réel Claude API quand ANTHROPIC_API_KEY disponible
        isLlmCall = false
      } else {
        input = { ruleType: 'INCOMPATIBLE', sourceType: srcType, destType: dstType }
      }

      const { description, source } = describeRule(input)
      // TODO: when the Claude API is wired for PROMPT rules, increment on real LLM calls.
      if (isLlmCall) totalLlmCalls++

      if (ruleType && ruleType !== 'DIRECT_COPY') totalRules++

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

  const html = renderContractualHtml({
    referenceNumber,
    planName: plan.name,
    planDescription: plan.description,
    sourceName: plan.sourceConnection?.name ?? 'N/A',
    destName: plan.destinationConnection?.name ?? 'N/A',
    objectCount: objectSections.length,
    fieldCount: totalFields,
    ruleCount: totalRules,
    filterCount: totalFilters,
    unmappedCount: totalUnmapped,
    sections: objectSections,
    generatedAt: new Date().toISOString(),
  })

  // Marquer les anciens comme OUTDATED
  await prisma.contractualDocument.updateMany({
    where: { planId, status: 'CURRENT' },
    data: { status: 'OUTDATED' },
  })

  const doc = await prisma.contractualDocument.create({
    data: {
      planId,
      referenceNumber,
      htmlContent: html,
      objectCount: objectSections.length,
      fieldCount: totalFields,
      ruleCount: totalRules,
      filterCount: totalFilters,
      unmappedCount: totalUnmapped,
      llmCallCount: totalLlmCalls,
    },
  })

  await logAuditEvent({
    planId,
    action: 'GENERATE_CONTRACTUAL_DOCUMENT',
    entity: 'ContractualDocument',
    entityId: doc.id,
    details: {
      referenceNumber,
      objectCount: objectSections.length,
      fieldCount: totalFields,
      ruleCount: totalRules,
      filterCount: totalFilters,
      unmappedCount: totalUnmapped,
      llmCallCount: totalLlmCalls,
    },
  })

  return doc
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listContractualDocuments(planId: string) {
  return prisma.contractualDocument.findMany({
    where: { planId },
    select: {
      id: true,
      referenceNumber: true,
      version: true,
      status: true,
      objectCount: true,
      fieldCount: true,
      ruleCount: true,
      filterCount: true,
      unmappedCount: true,
      llmCallCount: true,
      generatedAt: true,
    },
    orderBy: { generatedAt: 'desc' },
  })
}

export async function getContractualDocument(documentId: string) {
  return prisma.contractualDocument.findUniqueOrThrow({ where: { id: documentId } })
}

// ---------------------------------------------------------------------------
// Rendu HTML — Structure 7 articles contractuels
// ---------------------------------------------------------------------------

interface ContractualDocData {
  referenceNumber: string
  planName: string
  planDescription: string | null
  sourceName: string
  destName: string
  objectCount: number
  fieldCount: number
  ruleCount: number
  filterCount: number
  unmappedCount: number
  generatedAt: string
  sections: ObjectSection[]
}

function renderContractualHtml(data: ContractualDocData): string {
  const hasToc = data.sections.length >= 3

  // --- Article 2 : Correspondances ---
  const correspondenceSections = data.sections.map((s, idx) => {
    const rows = s.fieldRows.length > 0
      ? s.fieldRows.map((d) => `
        <tr${d.isFallback ? ' class="row-fallback"' : ''}>
          <td><strong>${escHtml(d.sourceFieldLabel)}</strong><br><code>${escHtml(d.sourceFieldName)}</code></td>
          <td><strong>${escHtml(d.destinationFieldLabel)}</strong><br><code>${escHtml(d.destinationFieldName)}</code></td>
          <td>${escHtml(d.sourceType)}</td>
          <td>${escHtml(d.destType)}</td>
          <td${d.isFallback ? ' class="fallback-cell"' : ''}>${d.description.replace(/\n/g, '<br>')}</td>
        </tr>`).join('')
      : `<tr><td colspan="5"><em>Aucun mapping de champ défini pour cet objet.</em></td></tr>`

    return `
      <h4 id="correspondence-${idx}">${idx + 1}. ${escHtml(s.sourceObjectName)} → ${escHtml(s.destinationObjectName)}</h4>
      <table>
        <thead>
          <tr>
            <th>Champ source</th>
            <th>Champ destination</th>
            <th>Type source</th>
            <th>Type dest.</th>
            <th>Règle de migration</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
  }).join('')

  // --- Article 3 : Règles de migration (toutes les règles non-DIRECT_COPY) ---
  const allRules = data.sections.flatMap((s) =>
    s.fieldRows
      .filter((r) => r.ruleType !== 'DIRECT_COPY')
      .map((r) => ({ object: s.sourceObjectName, ...r }))
  )

  const rulesSection = allRules.length > 0
    ? `<table>
        <thead><tr><th>Objet source</th><th>Champ source</th><th>Champ destination</th><th>Type de règle</th><th>Description</th></tr></thead>
        <tbody>${allRules.map((r) => `
          <tr${r.isFallback ? ' class="row-fallback"' : ''}>
            <td>${escHtml(r.object)}</td>
            <td><code>${escHtml(r.sourceFieldName)}</code></td>
            <td><code>${escHtml(r.destinationFieldName)}</code></td>
            <td><span class="rule-type">${escHtml(r.ruleType)}</span></td>
            <td${r.isFallback ? ' class="fallback-cell"' : ''}>${r.description.replace(/\n/g, '<br>')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : `<p><em>Aucune règle de migration spécifique définie — tous les champs sont copiés directement.</em></p>`

  // --- Article 4 : Exclusions par section ---
  const exclusionSections = data.sections.map((s) => {
    const unmappedSrc = s.unmappedSourceFields
    const unmappedDst = s.unmappedRequiredDestFields

    if (unmappedSrc.length === 0 && unmappedDst.length === 0) {
      return `<p class="ok-notice"><strong>${escHtml(s.sourceObjectName)}</strong> : Tous les champs source sont mappés — aucune exclusion.</p>`
    }

    return `
      <h4>${escHtml(s.sourceObjectName)} → ${escHtml(s.destinationObjectName)}</h4>
      ${unmappedSrc.length > 0
        ? `<p><strong>Champs source non migrés :</strong></p>
           <ul>${unmappedSrc.map((f) => `<li><code>${escHtml(f.apiName)}</code> — ${escHtml(f.label)} [${escHtml(f.dataType)}]</li>`).join('')}</ul>`
        : '<p>Tous les champs source sont mappés.</p>'}
      ${unmappedDst.length > 0
        ? `<p><strong>Champs destination requis non couverts :</strong></p>
           <ul>${unmappedDst.map((f) => `<li><code>${escHtml(f.apiName)}</code> — ${escHtml(f.label)} [${escHtml(f.dataType)}]</li>`).join('')}</ul>`
        : ''}`
  }).join('')

  // --- Article 5 : Filtres ---
  const allFilters = data.sections.flatMap((s) =>
    s.filters.filter((f) => f.isActive).map((f) => ({ object: s.sourceObjectName, ...f }))
  )

  const filtersSection = allFilters.length > 0
    ? `<table>
        <thead><tr><th>Objet</th><th>Champ</th><th>Opérateur</th><th>Valeur</th><th>Effet</th></tr></thead>
        <tbody>${allFilters.map((f) => `
          <tr>
            <td>${escHtml(f.object)}</td>
            <td><code>${escHtml(f.fieldApiName)}</code></td>
            <td>${escHtml(FILTER_LABEL[f.operator] ?? f.operator)}</td>
            <td>${f.value ? escHtml(f.value) : '—'}</td>
            <td>Seuls les enregistrements où <strong>${escHtml(f.fieldApiName)}</strong> ${escHtml(FILTER_LABEL[f.operator] ?? f.operator)} ${f.value ? `<em>${escHtml(f.value)}</em>` : ''} seront migrés.</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : `<p><em>Aucun filtre défini — tous les enregistrements seront migrés.</em></p>`

  // --- Table des matières ---
  const toc = hasToc
    ? `<nav class="toc" aria-label="Table des matières">
        <h3>Table des matières</h3>
        <ol>
          <li><a href="#article-1">Article 1 — Périmètre de migration</a></li>
          <li><a href="#article-2">Article 2 — Correspondances de champs</a>
            <ol>${data.sections.map((s, i) => `<li><a href="#correspondence-${i}">${escHtml(s.sourceObjectName)} → ${escHtml(s.destinationObjectName)}</a></li>`).join('')}</ol>
          </li>
          <li><a href="#article-3">Article 3 — Règles de migration</a></li>
          <li><a href="#article-4">Article 4 — Exclusions (champs non migrés)</a></li>
          <li><a href="#article-5">Article 5 — Filtres de migration</a></li>
          <li><a href="#article-6">Article 6 — Conditions et réserves</a></li>
          <li><a href="#article-7">Article 7 — Approbation et signature</a></li>
        </ol>
      </nav>`
    : ''

  const dateStr = new Date(data.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Document Contractuel — ${escHtml(data.referenceNumber)}</title>
  <style>
    body { font-family: 'Georgia', serif; max-width: 960px; margin: 0 auto; padding: 2.5rem; color: #1a1a1a; line-height: 1.5; }
    h1 { text-align: center; border-bottom: 3px double #333; padding-bottom: 1rem; font-size: 1.6rem; }
    h2.plan-name { text-align: center; color: #444; font-weight: normal; font-size: 1.2rem; margin-top: 0.5rem; }
    .doc-header { text-align: center; margin-bottom: 1.5rem; }
    .doc-ref { font-size: 0.95rem; color: #555; font-family: monospace; }
    .doc-date { font-size: 0.9rem; color: #666; }
    h3.article { margin-top: 2.5rem; border-bottom: 1px solid #999; padding-bottom: 0.4rem; font-size: 1.1rem; color: #1a1a1a; }
    h4 { margin-top: 1.2rem; color: #333; font-size: 1rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.85rem; }
    th, td { border: 1px solid #bbb; padding: 0.45rem 0.65rem; text-align: left; vertical-align: top; }
    th { background: #e8e8e8; font-weight: bold; font-family: system-ui, sans-serif; font-size: 0.82rem; }
    tr:nth-child(even) { background: #f9f9f9; }
    tr.row-fallback { background: #fff8e1; }
    td.fallback-cell { font-family: monospace; font-size: 0.80rem; color: #7b5800; }
    code { background: #f0f0f0; padding: 1px 4px; border-radius: 2px; font-size: 0.82rem; font-family: monospace; }
    .rule-type { background: #e3f2fd; color: #0d47a1; padding: 1px 6px; border-radius: 3px; font-size: 0.78rem; font-family: system-ui; }
    .ok-notice { color: #2e7d32; font-size: 0.9rem; }
    .scope-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 2rem; margin: 1rem 0; font-size: 0.95rem; }
    .scope-grid dt { font-weight: bold; color: #555; }
    .scope-grid dd { margin: 0; }
    .toc { background: #f8f8f8; border: 1px solid #ddd; padding: 1rem 1.5rem; margin: 1.5rem 0; border-radius: 4px; }
    .toc h3 { margin-top: 0; font-size: 1rem; }
    .toc ol { margin: 0.3rem 0; padding-left: 1.5rem; }
    .toc li { margin: 0.2rem 0; font-size: 0.9rem; }
    .toc a { color: #1565c0; text-decoration: none; }
    .signature-section { margin-top: 4rem; border-top: 2px solid #333; padding-top: 1.5rem; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 2rem; }
    .sig-block h4 { border-bottom: 1px solid #ccc; padding-bottom: 0.3rem; margin-bottom: 1rem; }
    .sig-line { border-bottom: 1px solid #999; margin-top: 0.5rem; min-height: 2.5rem; padding: 0.3rem 0; }
    .sig-label { font-size: 0.8rem; color: #666; font-family: system-ui; margin-top: 1rem; }
    .sig-checkbox { margin-top: 1rem; font-size: 0.9rem; }
    .outdated-banner { background: #ffebee; border: 2px solid #c62828; color: #c62828; padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px; font-family: system-ui; font-weight: bold; text-align: center; display: none; }
    @media print {
      tr { break-inside: avoid; page-break-inside: avoid; }
      h3.article, h4 { break-inside: avoid; page-break-inside: avoid; break-after: avoid; }
      .toc { break-inside: avoid; }
      .signature-section { break-before: page; }
    }
  </style>
</head>
<body>

  <h1>Document Contractuel de Migration de Données</h1>
  <div class="doc-header">
    <h2 class="plan-name">${escHtml(data.planName)}</h2>
    <p class="doc-ref">Référence : <strong>${escHtml(data.referenceNumber)}</strong></p>
    <p class="doc-date">Généré le ${dateStr}</p>
  </div>

  ${toc}

  <!-- ═══════════════════════════════════════════════════════════════════════
       ARTICLE 1 — Périmètre de migration
  ════════════════════════════════════════════════════════════════════════════ -->
  <h3 class="article" id="article-1">Article 1 — Périmètre de migration</h3>
  ${data.planDescription ? `<p>${escHtml(data.planDescription)}</p>` : ''}
  <dl class="scope-grid">
    <dt>Système source</dt><dd>${escHtml(data.sourceName)}</dd>
    <dt>Système destination</dt><dd>${escHtml(data.destName)}</dd>
    <dt>Objets migrés</dt><dd>${data.objectCount}</dd>
    <dt>Champs mappés</dt><dd>${data.fieldCount}</dd>
    <dt>Règles de transformation</dt><dd>${data.ruleCount}</dd>
    <dt>Filtres actifs</dt><dd>${data.filterCount}</dd>
    <dt>Champs non-migrés (exclusions)</dt><dd>${data.unmappedCount}</dd>
  </dl>

  <!-- ═══════════════════════════════════════════════════════════════════════
       ARTICLE 2 — Correspondances de champs
  ════════════════════════════════════════════════════════════════════════════ -->
  <h3 class="article" id="article-2">Article 2 — Correspondances de champs</h3>
  <p>Les tableaux ci-dessous décrivent, pour chaque objet migré, les correspondances entre champs source et champs destination, ainsi que la règle de migration appliquée.</p>
  ${data.sections.length === 0
    ? '<p><em>Aucun mapping d\'objet défini pour ce plan.</em></p>'
    : correspondenceSections}

  <!-- ═══════════════════════════════════════════════════════════════════════
       ARTICLE 3 — Règles de migration
  ════════════════════════════════════════════════════════════════════════════ -->
  <h3 class="article" id="article-3">Article 3 — Règles de migration</h3>
  <p>Récapitulatif de toutes les règles de transformation spécifiques (hors copie directe) applicables aux champs migrés.</p>
  ${rulesSection}

  <!-- ═══════════════════════════════════════════════════════════════════════
       ARTICLE 4 — Exclusions
  ════════════════════════════════════════════════════════════════════════════ -->
  <h3 class="article" id="article-4">Article 4 — Exclusions (champs ne seront PAS migrés)</h3>
  <p>Les champs source listés ci-dessous sont explicitement exclus du périmètre de migration. Ils ne seront pas transférés vers le système destination. Le client en prend acte par sa signature.</p>
  ${data.sections.length === 0
    ? '<p><em>Aucun objet défini — voir Article 1.</em></p>'
    : exclusionSections}

  <!-- ═══════════════════════════════════════════════════════════════════════
       ARTICLE 5 — Filtres de migration
  ════════════════════════════════════════════════════════════════════════════ -->
  <h3 class="article" id="article-5">Article 5 — Filtres de migration</h3>
  <p>Les filtres ci-dessous restreignent le périmètre des enregistrements effectivement migrés. Seuls les enregistrements répondant aux critères seront traités.</p>
  ${filtersSection}

  <!-- ═══════════════════════════════════════════════════════════════════════
       ARTICLE 6 — Conditions et réserves
  ════════════════════════════════════════════════════════════════════════════ -->
  <h3 class="article" id="article-6">Article 6 — Conditions et réserves</h3>
  <ol>
    <li>Le présent document décrit l'état du plan de migration à la date de génération indiquée en en-tête. Toute modification ultérieure du plan nécessite la génération d'un nouveau document avec un numéro de référence distinct.</li>
    <li>Les champs source non listés dans les tableaux de correspondance (Article 2) ne seront pas migrés. Le client confirme avoir pris connaissance de ces exclusions (Article 4).</li>
    <li>Les champs présentant une incompatibilité de types (signalés par "WARNING" dans la règle de migration) feront l'objet d'une exportation CSV pour traitement manuel.</li>
    <li>Les règles de classification par IA (type PROMPT) sont soumises à une revue préalable par le consultant avant exécution.</li>
    <li>Ce document est immutable une fois signé. En cas de modification du périmètre, un avenant devra être établi.</li>
  </ol>

  <!-- ═══════════════════════════════════════════════════════════════════════
       ARTICLE 7 — Approbation et signature
  ════════════════════════════════════════════════════════════════════════════ -->
  <h3 class="article" id="article-7">Article 7 — Approbation et signature</h3>
  <div class="signature-section">
    <p>En signant ce document, les parties certifient avoir pris connaissance du périmètre de migration défini aux articles 1 à 6 et approuvent son exécution conformément aux conditions décrites.</p>
    <div class="signature-grid">
      <div class="sig-block">
        <h4>Client</h4>
        <div class="sig-checkbox">
          <label>&#9744; J'approuve le périmètre de migration décrit dans ce document.</label>
        </div>
        <div class="sig-label">Nom et prénom</div>
        <div class="sig-line"></div>
        <div class="sig-label">Fonction</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date</div>
        <div class="sig-line"></div>
        <div class="sig-label">Signature</div>
        <div class="sig-line" style="min-height:4rem;"></div>
      </div>
      <div class="sig-block">
        <h4>Consultant (Carbo)</h4>
        <div class="sig-checkbox">
          <label>&#9744; Je certifie l'exactitude des informations contenues dans ce document.</label>
        </div>
        <div class="sig-label">Nom et prénom</div>
        <div class="sig-line"></div>
        <div class="sig-label">Fonction</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date</div>
        <div class="sig-line"></div>
        <div class="sig-label">Signature</div>
        <div class="sig-line" style="min-height:4rem;"></div>
      </div>
    </div>
    <p style="margin-top:2rem;font-size:0.8rem;color:#888;font-family:system-ui;">
      Référence : ${escHtml(data.referenceNumber)} — Généré le ${dateStr} par Carbo.
    </p>
  </div>

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
