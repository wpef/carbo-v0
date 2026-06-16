// @vitest-environment node
//
// Tests d'intégration — Lane Documents (019, 020, 021)
// Branche Neon partagée — NE PAS LANCER individuellement.
// Lancé en séquentiel par l'orchestrateur.
//
// Couvre les flux DB suivants :
//   - Génération document texte : persistance HTML, stats (unmappedCount, llmCallCount)
//   - Génération document contractuel : numéro de référence DB-unique, structure 7 articles
//   - Unicité du numéro de référence (CARBO-YYYYMMDD-XXXX) via comptage DB
//   - Transition CURRENT → OUTDATED sur régénération
//   - Route PDF : retour HTML print-ready (mode actuel)
//   - Idempotence : 2ème génération crée un nouveau doc immutable
//
// Données réalistes : plan SF Contact → HubSpot Contacts avec règles VALUE_EQUIVALENCE et DIRECT_COPY.

import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  generateTextDocument,
  listTextDocuments,
  getTextDocument,
} from '@/features/documents/services/text-document-service'
import {
  generateContractualDocument,
  listContractualDocuments,
  getContractualDocument,
} from '@/features/documents/services/contractual-document-service'
import { isValidReferenceNumber } from '@/features/documents/lib/reference-number'
import { seedSnapshot } from '../_helpers/seed-schema'

// ---------------------------------------------------------------------------
// Fixtures DB
// ---------------------------------------------------------------------------

const planIds: string[] = []
const connectionIds: string[] = []
const snapshotIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connectionIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
})

async function seedFullPlan(name = 'SF Contact → HubSpot (test)') {
  const source = await prisma.connectorConnection.create({
    data: { adapterType: 'salesforce', name: `SF (doc-test-${Date.now()})`, status: 'CONNECTED' },
  })
  const dest = await prisma.connectorConnection.create({
    data: { adapterType: 'hubspot', name: `HS (doc-test-${Date.now()})`, status: 'CONNECTED' },
  })
  connectionIds.push(source.id, dest.id)

  const plan = await prisma.migrationPlan.create({
    data: {
      name,
      description: 'Migration pilote SF → HubSpot Q3 2026',
      sourceConnectionId: source.id,
      destinationConnectionId: dest.id,
    },
  })
  planIds.push(plan.id)

  // Snapshot source (Salesforce)
  const srcSnapshot = await seedSnapshot(source.id, 'SOURCE', [
    {
      apiName: 'Contact',
      label: 'Contact',
      fields: [
        { apiName: 'FirstName', label: 'First Name', dataType: 'string', isRequired: false },
        { apiName: 'LastName', label: 'Last Name', dataType: 'string', isRequired: true },
        { apiName: 'Email', label: 'Email', dataType: 'email', isRequired: true },
        { apiName: 'Phone', label: 'Phone', dataType: 'phone', isRequired: false },
        { apiName: 'LeadSource', label: 'Lead Source', dataType: 'picklist', isRequired: false },
        // MobilePhone non-mappé intentionnellement → testera unmappedCount
        { apiName: 'MobilePhone', label: 'Mobile Phone', dataType: 'phone', isRequired: false },
      ],
    },
  ])
  snapshotIds.push(srcSnapshot.id)

  // Snapshot destination (HubSpot)
  const dstSnapshot = await seedSnapshot(dest.id, 'DESTINATION', [
    {
      apiName: 'contacts',
      label: 'Contacts',
      fields: [
        { apiName: 'firstname', label: 'First name', dataType: 'string', isRequired: true },
        { apiName: 'lastname', label: 'Last name', dataType: 'string', isRequired: true },
        { apiName: 'email', label: 'Email', dataType: 'string', isRequired: true },
        { apiName: 'phone', label: 'Phone number', dataType: 'string', isRequired: false },
        { apiName: 'hs_lead_source', label: 'Lead source', dataType: 'enumeration', isRequired: false },
      ],
    },
  ])
  snapshotIds.push(dstSnapshot.id)

  // Object mapping Contact → contacts
  const om = await prisma.objectMapping.create({
    data: {
      planId: plan.id,
      sourceObjectName: 'Contact',
      destinationObjectName: 'contacts',
    },
  })

  // Field mappings avec règles
  const fmFirstName = await prisma.fieldMapping.create({
    data: {
      objectMappingId: om.id,
      sourceFieldName: 'FirstName',
      destinationFieldName: 'firstname',
      compatibilityStatus: 'COMPATIBLE',
    },
  })
  // DIRECT_COPY — pas de migrationLogic

  const fmLastName = await prisma.fieldMapping.create({
    data: {
      objectMappingId: om.id,
      sourceFieldName: 'LastName',
      destinationFieldName: 'lastname',
      compatibilityStatus: 'COMPATIBLE',
    },
  })

  const fmEmail = await prisma.fieldMapping.create({
    data: {
      objectMappingId: om.id,
      sourceFieldName: 'Email',
      destinationFieldName: 'email',
      compatibilityStatus: 'COMPATIBLE',
    },
  })

  const fmPhone = await prisma.fieldMapping.create({
    data: {
      objectMappingId: om.id,
      sourceFieldName: 'Phone',
      destinationFieldName: 'phone',
      compatibilityStatus: 'COMPATIBLE',
    },
  })

  // LeadSource → VALUE_EQUIVALENCE
  const fmLeadSource = await prisma.fieldMapping.create({
    data: {
      objectMappingId: om.id,
      sourceFieldName: 'LeadSource',
      destinationFieldName: 'hs_lead_source',
      compatibilityStatus: 'COMPATIBLE',
    },
  })

  const logicLeadSource = await prisma.migrationLogic.create({
    data: {
      fieldMappingId: fmLeadSource.id,
      status: 'DEFINED',
      config: '{"type":"VALUE_EQUIVALENCE"}',
      valueEquivalences: {
        create: [
          { sourceValue: 'Web', destinationValue: 'ONLINE' },
          { sourceValue: 'Phone Inquiry', destinationValue: 'PHONE' },
          { sourceValue: 'Partner Referral', destinationValue: 'PARTNER' },
        ],
      },
    },
  })

  // Filtre actif : LeadSource EQUALS Web
  await prisma.migrationFilter.create({
    data: {
      objectMappingId: om.id,
      fieldApiName: 'CreatedDate',
      operator: 'DATE_AFTER',
      value: '2020-01-01',
      isActive: true,
    },
  })

  // MobilePhone intentionnellement NON mappé → doit aparaître dans unmappedCount

  return { plan, om, fmFirstName, fmLeadSource, logicLeadSource }
}

// ---------------------------------------------------------------------------
// Tests document texte (019)
// ---------------------------------------------------------------------------

describe('generateTextDocument (019) — intégration Neon', () => {
  it('génère un TextDocument avec HTML non-vide et stats correctes', async () => {
    const { plan } = await seedFullPlan('Text Doc Test')

    const doc = await generateTextDocument(plan.id)

    expect(doc.id).toBeTruthy()
    expect(doc.planId).toBe(plan.id)
    expect(doc.htmlContent.length).toBeGreaterThan(500)
    expect(doc.htmlContent).toContain('Document Technique')

    // Stats
    expect(doc.fieldCount).toBe(5) // 5 field mappings
    expect(doc.ruleCount).toBeGreaterThanOrEqual(1) // au moins LeadSource
    expect(doc.unmappedCount).toBeGreaterThanOrEqual(1) // MobilePhone non-mappé
    expect(doc.status).toBe('CURRENT')
  })

  it('HTML contient le block unmapped fields (MobilePhone)', async () => {
    const { plan } = await seedFullPlan('Text Doc Unmapped Test')
    const doc = await generateTextDocument(plan.id)

    expect(doc.htmlContent).toContain('MobilePhone')
    expect(doc.htmlContent).toContain('non-mappés')
  })

  it('HTML contient la description VALUE_EQUIVALENCE pour LeadSource', async () => {
    const { plan } = await seedFullPlan('Text Doc Rule Test')
    const doc = await generateTextDocument(plan.id)

    expect(doc.htmlContent).toContain('Web')
    expect(doc.htmlContent).toContain('ONLINE')
    // describeRule VALUE_EQUIVALENCE format : "'Web' becomes 'ONLINE'"
    expect(doc.htmlContent).toContain('becomes')
  })

  it('HTML inclut les filtres de migration', async () => {
    const { plan } = await seedFullPlan('Text Doc Filter Test')
    const doc = await generateTextDocument(plan.id)

    expect(doc.htmlContent).toContain('CreatedDate')
    expect(doc.htmlContent).toContain('2020-01-01')
  })

  it('2ème génération → 1er doc passe en OUTDATED, nouveau en CURRENT', async () => {
    const { plan } = await seedFullPlan('Text Doc Idempotence Test')

    const doc1 = await generateTextDocument(plan.id)
    expect(doc1.status).toBe('CURRENT')

    const doc2 = await generateTextDocument(plan.id)
    expect(doc2.status).toBe('CURRENT')

    // doc1 doit être OUTDATED en base
    const doc1Refreshed = await prisma.textDocument.findUniqueOrThrow({ where: { id: doc1.id } })
    expect(doc1Refreshed.status).toBe('OUTDATED')
  })

  it('listTextDocuments retourne les docs triés par date décroissante', async () => {
    const { plan } = await seedFullPlan('Text Doc List Test')

    await generateTextDocument(plan.id)
    await generateTextDocument(plan.id)

    const list = await listTextDocuments(plan.id)
    expect(list.length).toBeGreaterThanOrEqual(2)
    // Premier = le plus récent
    expect(list[0].generatedAt >= list[1].generatedAt).toBe(true)
    // Les stats unmappedCount sont incluses dans la liste
    expect(list[0]).toHaveProperty('unmappedCount')
    expect(list[0]).toHaveProperty('llmCallCount')
  })

  it('getTextDocument retourne le doc avec htmlContent', async () => {
    const { plan } = await seedFullPlan('Text Doc Get Test')
    const doc = await generateTextDocument(plan.id)
    const fetched = await getTextDocument(doc.id)

    expect(fetched.id).toBe(doc.id)
    expect(fetched.htmlContent).toBe(doc.htmlContent)
  })
})

// ---------------------------------------------------------------------------
// Tests document contractuel (020)
// ---------------------------------------------------------------------------

describe('generateContractualDocument (020) — intégration Neon', () => {
  it('génère un ContractualDocument avec référence valide CARBO-YYYYMMDD-XXXX', async () => {
    const { plan } = await seedFullPlan('Contractual Doc Test')
    const doc = await generateContractualDocument(plan.id)

    expect(doc.id).toBeTruthy()
    expect(doc.referenceNumber).toMatch(/^CARBO-\d{8}-\d{4}$/)
    expect(isValidReferenceNumber(doc.referenceNumber)).toBe(true)
    expect(doc.status).toBe('CURRENT')
  })

  it('HTML contient les 7 articles du document contractuel', async () => {
    const { plan } = await seedFullPlan('Contractual 7 Articles Test')
    const doc = await generateContractualDocument(plan.id)

    const html = doc.htmlContent
    expect(html).toContain('Article 1')
    expect(html).toContain('Article 2')
    expect(html).toContain('Article 3')
    expect(html).toContain('Article 4')
    expect(html).toContain('Article 5')
    expect(html).toContain('Article 6')
    expect(html).toContain('Article 7')
  })

  it('Article 4 liste MobilePhone comme champ exclu', async () => {
    const { plan } = await seedFullPlan('Contractual Exclusions Test')
    const doc = await generateContractualDocument(plan.id)

    expect(doc.htmlContent).toContain('Article 4')
    expect(doc.htmlContent).toContain('MobilePhone')
    expect(doc.unmappedCount).toBeGreaterThanOrEqual(1)
  })

  it('Article 5 liste le filtre CreatedDate DATE_AFTER 2020-01-01', async () => {
    const { plan } = await seedFullPlan('Contractual Filter Test')
    const doc = await generateContractualDocument(plan.id)

    expect(doc.htmlContent).toContain('Article 5')
    expect(doc.htmlContent).toContain('CreatedDate')
    expect(doc.htmlContent).toContain('2020-01-01')
  })

  it('Article 7 contient le bloc de signature', async () => {
    const { plan } = await seedFullPlan('Contractual Signature Test')
    const doc = await generateContractualDocument(plan.id)

    expect(doc.htmlContent).toContain('Article 7')
    expect(doc.htmlContent).toContain('Approbation')
    expect(doc.htmlContent).toContain('Signature')
  })

  it('référence unique : 2 générations du même jour → numéros distincts', async () => {
    const { plan } = await seedFullPlan('Contractual Uniqueness Test')

    const doc1 = await generateContractualDocument(plan.id)
    const doc2 = await generateContractualDocument(plan.id)

    expect(doc1.referenceNumber).not.toBe(doc2.referenceNumber)

    // Les deux sont du même préfixe CARBO-YYYYMMDD
    const prefix1 = doc1.referenceNumber.slice(0, 14) // CARBO-YYYYMMDD
    const prefix2 = doc2.referenceNumber.slice(0, 14)
    expect(prefix1).toBe(prefix2)

    // Séquences consécutives
    const seq1 = parseInt(doc1.referenceNumber.slice(-4), 10)
    const seq2 = parseInt(doc2.referenceNumber.slice(-4), 10)
    expect(seq2).toBe(seq1 + 1)
  })

  it('2ème génération → 1er doc contractuel passe en OUTDATED', async () => {
    const { plan } = await seedFullPlan('Contractual Outdated Test')

    const doc1 = await generateContractualDocument(plan.id)
    const doc2 = await generateContractualDocument(plan.id)

    const doc1Refreshed = await prisma.contractualDocument.findUniqueOrThrow({ where: { id: doc1.id } })
    expect(doc1Refreshed.status).toBe('OUTDATED')
    expect(doc2.status).toBe('CURRENT')
  })

  it('HTML contient la description VALUE_EQUIVALENCE pour LeadSource', async () => {
    const { plan } = await seedFullPlan('Contractual Rule Test')
    const doc = await generateContractualDocument(plan.id)

    // describeRule VALUE_EQUIVALENCE : "'Web' becomes 'ONLINE'"
    expect(doc.htmlContent).toContain('becomes')
    expect(doc.htmlContent).toContain('ONLINE')
  })

  it('stats correctes : filterCount >= 1, unmappedCount >= 1', async () => {
    const { plan } = await seedFullPlan('Contractual Stats Test')
    const doc = await generateContractualDocument(plan.id)

    expect(doc.filterCount).toBeGreaterThanOrEqual(1)
    expect(doc.unmappedCount).toBeGreaterThanOrEqual(1)
    expect(doc.fieldCount).toBe(5)
  })

  it('listContractualDocuments inclut unmappedCount et llmCallCount', async () => {
    const { plan } = await seedFullPlan('Contractual List Test')
    await generateContractualDocument(plan.id)

    const list = await listContractualDocuments(plan.id)
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0]).toHaveProperty('unmappedCount')
    expect(list[0]).toHaveProperty('llmCallCount')
    expect(list[0]).toHaveProperty('referenceNumber')
  })
})

// ---------------------------------------------------------------------------
// Tests route PDF (021) — comportement sans DB (logique pure)
// ---------------------------------------------------------------------------

describe('pdf-export lib — sanitizePdfFilename (pur, sans DB)', () => {
  // Ces tests sont déjà dans unit/ — on valide juste l'import depuis le contexte node
  it('sanitizePdfFilename fonctionne dans l\'environnement node', async () => {
    const { sanitizePdfFilename } = await import('@/features/documents/lib/pdf-export')
    const result = sanitizePdfFilename('SF Contact Migration', 'text-document', '2026-06-16')
    expect(result).toBe('sf-contact-migration_text-document_2026-06-16.pdf')
  })

  it('enrichHtmlForPrint injecte le CSS print dans l\'environnement node', async () => {
    const { enrichHtmlForPrint } = await import('@/features/documents/lib/pdf-export')
    const html = '<html><head></head><body><p>Test</p></body></html>'
    const result = enrichHtmlForPrint(html, 'Plan Test', '2026-06-16')
    expect(result).toContain('@media print')
    expect(result).toContain('print-btn')
  })
})
