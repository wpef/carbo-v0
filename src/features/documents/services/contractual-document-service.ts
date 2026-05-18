import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { generateFieldMappingDescriptions } from './rule-description-engine'

async function generateReferenceNumber(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `CARBO-${dateStr}`

  const existing = await prisma.contractualDocument.findMany({
    where: { referenceNumber: { startsWith: prefix } },
    select: { referenceNumber: true },
    orderBy: { referenceNumber: 'desc' },
    take: 1,
  })

  let counter = 1
  if (existing.length > 0) {
    const lastNum = parseInt(existing[0].referenceNumber.slice(-4), 10)
    counter = lastNum + 1
  }

  return `${prefix}-${String(counter).padStart(4, '0')}`
}

export async function generateContractualDocument(planId: string) {
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

  const referenceNumber = await generateReferenceNumber()

  let totalFields = 0
  let totalRules = 0
  let totalFilters = 0

  const objectSections = plan.objectMappings.map((om) => {
    const srcObj = sourceSnapshot?.objects.find((o) => o.apiName === om.sourceObjectName)
    const dstObj = destSnapshot?.objects.find((o) => o.apiName === om.destinationObjectName)

    const sourceFieldMap = new Map((srcObj?.fields ?? []).map((f) => [f.apiName, { dataType: f.dataType }]))
    const destFieldMap = new Map((dstObj?.fields ?? []).map((f) => [f.apiName, { dataType: f.dataType }]))

    const descriptions = generateFieldMappingDescriptions(om.fieldMappings, sourceFieldMap, destFieldMap)
    totalFields += descriptions.length
    totalRules += descriptions.filter((d) => d.ruleType !== 'DIRECT_COPY').length
    totalFilters += om.filters.length

    return {
      sourceObjectName: om.sourceObjectName,
      destinationObjectName: om.destinationObjectName,
      descriptions,
      filters: om.filters,
      exclusions: om.exclusions,
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
    sections: objectSections,
    generatedAt: new Date().toISOString(),
  })

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
    },
  })

  await logAuditEvent({
    planId,
    action: 'GENERATE_CONTRACTUAL_DOCUMENT',
    entity: 'ContractualDocument',
    entityId: doc.id,
    details: { referenceNumber, objectCount: objectSections.length, fieldCount: totalFields },
  })

  console.log(`[Documents] Generated contractual document ${doc.id} (${referenceNumber}) for plan ${planId}`)
  return doc
}

export async function listContractualDocuments(planId: string) {
  return prisma.contractualDocument.findMany({
    where: { planId },
    select: { id: true, referenceNumber: true, version: true, status: true, objectCount: true, fieldCount: true, ruleCount: true, filterCount: true, generatedAt: true },
    orderBy: { generatedAt: 'desc' },
  })
}

export async function getContractualDocument(documentId: string) {
  return prisma.contractualDocument.findUniqueOrThrow({ where: { id: documentId } })
}

interface ContractualDocumentData {
  referenceNumber: string
  planName: string
  planDescription: string | null
  sourceName: string
  destName: string
  objectCount: number
  fieldCount: number
  ruleCount: number
  filterCount: number
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

function renderContractualHtml(data: ContractualDocumentData): string {
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

    const exclusionBlock = s.exclusions.length > 0
      ? `<h4>Champs exclus de la migration</h4><ul>${s.exclusions.map((e) => `<li><code>${e.sourceFieldName}</code>${e.reason ? ` — ${e.reason}` : ''}</li>`).join('')}</ul>`
      : `<p><em>Tous les champs source sont mappés — aucune exclusion.</em></p>`

    return `
      <h3>${idx + 1}. Correspondance : ${s.sourceObjectName} → ${s.destinationObjectName}</h3>
      <table>
        <thead><tr><th>Champ source</th><th>Champ destination</th><th>Type source</th><th>Type dest.</th><th>Règle de migration</th></tr></thead>
        <tbody>${fieldRows}</tbody>
      </table>
      ${exclusionBlock}
    `
  }).join('')

  const allFilters = data.sections.flatMap((s) =>
    s.filters.map((f) => ({ object: s.sourceObjectName, ...f })),
  )
  const filterSection = allFilters.length > 0
    ? `<h3>Filtres de migration</h3><table><thead><tr><th>Objet</th><th>Champ</th><th>Opérateur</th><th>Valeur</th></tr></thead><tbody>${allFilters.map((f) => `<tr><td>${f.object}</td><td>${f.fieldApiName}</td><td>${filterLabel[f.operator] ?? f.operator}</td><td>${f.value ?? '—'}</td></tr>`).join('')}</tbody></table>`
    : `<h3>Filtres de migration</h3><p><em>Aucun filtre défini — tous les enregistrements seront migrés.</em></p>`

  const toc = `<nav><h3>Table des matières</h3><ol>
    <li>Périmètre</li>
    ${data.sections.map((s, i) => `<li>${s.sourceObjectName} → ${s.destinationObjectName}</li>`).join('')}
    <li>Filtres de migration</li>
    <li>Approbation</li>
  </ol></nav>`

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Document Contractuel — ${data.referenceNumber}</title>
<style>
body { font-family: 'Georgia', serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
h1 { text-align: center; border-bottom: 3px double #333; padding-bottom: 1rem; }
h2 { text-align: center; color: #444; font-weight: normal; }
h3 { margin-top: 2.5rem; border-bottom: 1px solid #999; padding-bottom: 0.3rem; counter-increment: section; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.85rem; }
th, td { border: 1px solid #999; padding: 0.5rem; text-align: left; }
th { background: #e8e8e8; font-weight: bold; }
.ref { text-align: center; font-size: 0.9rem; color: #666; margin-top: -0.5rem; }
.scope { background: #f8f8f8; border: 1px solid #ddd; padding: 1rem; margin: 1rem 0; }
.signature { margin-top: 3rem; border-top: 2px solid #333; padding-top: 1rem; }
.signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1.5rem; }
.signature-field { border-bottom: 1px solid #999; padding: 0.5rem 0; min-height: 3rem; }
.signature-label { font-size: 0.8rem; color: #666; margin-bottom: 0.3rem; }
</style></head>
<body>
<h1>Document Contractuel de Migration</h1>
<h2>${data.planName}</h2>
<p class="ref">Référence : ${data.referenceNumber}</p>
<p class="ref">Généré le ${new Date(data.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })}</p>

${toc}

<h3>Périmètre</h3>
<div class="scope">
<p><strong>Système source :</strong> ${data.sourceName}</p>
<p><strong>Système destination :</strong> ${data.destName}</p>
<p><strong>Objets migrés :</strong> ${data.objectCount}</p>
<p><strong>Champs mappés :</strong> ${data.fieldCount}</p>
<p><strong>Règles de transformation :</strong> ${data.ruleCount}</p>
<p><strong>Filtres actifs :</strong> ${data.filterCount}</p>
</div>
${data.planDescription ? `<p>${data.planDescription}</p>` : ''}

${sections}

${filterSection}

<div class="signature">
<h3>Approbation</h3>
<p>En signant ce document, les parties confirment avoir pris connaissance du périmètre de migration décrit ci-dessus et approuvent son exécution.</p>
<div class="signature-grid">
  <div>
    <div class="signature-label">Nom du client</div>
    <div class="signature-field"></div>
    <div class="signature-label">Date</div>
    <div class="signature-field"></div>
    <div class="signature-label">Signature</div>
    <div class="signature-field"></div>
  </div>
  <div>
    <div class="signature-label">Nom du consultant</div>
    <div class="signature-field"></div>
    <div class="signature-label">Date</div>
    <div class="signature-field"></div>
    <div class="signature-label">Signature</div>
    <div class="signature-field"></div>
  </div>
</div>
</div>
</body></html>`
}
