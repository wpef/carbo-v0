import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { generateFieldMappingDescriptions } from './rule-description-engine'

export async function generateTextDocument(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      sourceConnection: true,
      destinationConnection: true,
      objectMappings: {
        include: {
          fieldMappings: { include: { migrationLogic: { include: { valueEquivalences: true } } } },
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

  const objectSections = plan.objectMappings.map((om) => {
    const srcObj = sourceSnapshot?.objects.find((o) => o.apiName === om.sourceObjectName)
    const dstObj = destSnapshot?.objects.find((o) => o.apiName === om.destinationObjectName)

    const sourceFieldMap = new Map((srcObj?.fields ?? []).map((f) => [f.apiName, { dataType: f.dataType }]))
    const destFieldMap = new Map((dstObj?.fields ?? []).map((f) => [f.apiName, { dataType: f.dataType }]))

    const descriptions = generateFieldMappingDescriptions(om.fieldMappings, sourceFieldMap, destFieldMap)
    totalFields += descriptions.length
    totalRules += descriptions.filter((d) => d.ruleType !== 'DIRECT_COPY').length

    return {
      sourceObjectName: om.sourceObjectName,
      destinationObjectName: om.destinationObjectName,
      descriptions,
      filters: om.filters,
      exclusions: om.exclusions,
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
    sections: objectSections,
    generatedAt: new Date().toISOString(),
  })

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
    },
  })

  await logAuditEvent({
    planId,
    action: 'GENERATE_TEXT_DOCUMENT',
    entity: 'TextDocument',
    entityId: doc.id,
    details: { objectCount: objectSections.length, fieldCount: totalFields, ruleCount: totalRules },
  })

  console.log(`[Documents] Generated text document ${doc.id} for plan ${planId}`)
  return doc
}

export async function listTextDocuments(planId: string) {
  return prisma.textDocument.findMany({
    where: { planId },
    select: { id: true, version: true, status: true, objectCount: true, fieldCount: true, ruleCount: true, generatedAt: true },
    orderBy: { generatedAt: 'desc' },
  })
}

export async function getTextDocument(documentId: string) {
  return prisma.textDocument.findUniqueOrThrow({ where: { id: documentId } })
}

interface TextDocumentData {
  planName: string
  planDescription: string | null
  sourceName: string
  destName: string
  objectCount: number
  fieldCount: number
  ruleCount: number
  generatedAt: string
  sections: {
    sourceObjectName: string
    destinationObjectName: string
    descriptions: {
      sourceFieldName: string
      destinationFieldName: string
      sourceType: string
      destType: string
      description: string
      ruleType: string
    }[]
    filters: { fieldApiName: string; operator: string; value: string | null }[]
    exclusions: { sourceFieldName: string; reason: string | null }[]
  }[]
}

function renderTextDocumentHtml(data: TextDocumentData): string {
  const filterLabel: Record<string, string> = {
    EQUALS: 'est égal à', NOT_EQUALS: 'est différent de', CONTAINS: 'contient',
    NOT_CONTAINS: 'ne contient pas', STARTS_WITH: 'commence par', ENDS_WITH: 'se termine par',
    GREATER_THAN: 'supérieur à', LESS_THAN: 'inférieur à', IS_NULL: 'est vide',
  }

  const sections = data.sections.map((s, idx) => {
    const fieldRows = s.descriptions.map((d) => `
      <tr>
        <td>${d.sourceFieldName}</td>
        <td>${d.destinationFieldName}</td>
        <td>${d.sourceType}</td>
        <td>${d.destType}</td>
        <td>${d.description.replace(/\n/g, '<br>')}</td>
      </tr>`).join('')

    const filterRows = s.filters.length > 0
      ? `<h4>Filtres</h4><ul>${s.filters.map((f) => `<li><strong>${f.fieldApiName}</strong> ${filterLabel[f.operator] ?? f.operator} ${f.value ?? ''}</li>`).join('')}</ul>`
      : ''

    const exclusionRows = s.exclusions.length > 0
      ? `<h4>Champs exclus</h4><ul>${s.exclusions.map((e) => `<li>${e.sourceFieldName}${e.reason ? ` — ${e.reason}` : ''}</li>`).join('')}</ul>`
      : ''

    return `
      <h3 id="section-${idx}">${idx + 1}. ${s.sourceObjectName} → ${s.destinationObjectName}</h3>
      ${s.descriptions.length > 0 ? `
      <table>
        <thead><tr><th>Champ source</th><th>Champ destination</th><th>Type source</th><th>Type dest.</th><th>Règle</th></tr></thead>
        <tbody>${fieldRows}</tbody>
      </table>` : '<p><em>Aucun mapping de champ défini.</em></p>'}
      ${filterRows}
      ${exclusionRows}
    `
  }).join('')

  const toc = data.sections.length >= 3
    ? `<nav><h3>Table des matières</h3><ol>${data.sections.map((s, i) => `<li><a href="#section-${i}">${s.sourceObjectName} → ${s.destinationObjectName}</a></li>`).join('')}</ol></nav>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Document technique — ${data.planName}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
h3 { margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
th { background: #f5f5f5; }
tr:nth-child(even) { background: #fafafa; }
.meta { color: #666; font-size: 0.9rem; }
.warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 0.5rem 1rem; margin: 0.5rem 0; }
nav ol { columns: 2; }
</style></head>
<body>
<h1>Document Technique de Migration</h1>
<h2>${data.planName}</h2>
${data.planDescription ? `<p>${data.planDescription}</p>` : ''}
<div class="meta">
<p><strong>Source :</strong> ${data.sourceName} | <strong>Destination :</strong> ${data.destName}</p>
<p><strong>Objets :</strong> ${data.objectCount} | <strong>Champs mappés :</strong> ${data.fieldCount} | <strong>Règles :</strong> ${data.ruleCount}</p>
<p><strong>Généré le :</strong> ${new Date(data.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>
</div>
${toc}
${sections}
</body></html>`
}
