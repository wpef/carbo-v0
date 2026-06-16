// @vitest-environment node
//
// Integration tests — Clusters 3, 6, 16 — field-mapping lane (v4)
// Runs against the disposable Neon test branch (DATABASE_URL from .env.test).
// NOT launched by the unit-test runner — executed sequentially by the orchestrator.
//
// Covers:
//   - listFieldMappings: enriched DTO with linkStatus (Cluster 3)
//   - Anti-stale-FK: source/dest field absent → BROKEN
//   - createFieldMapping: D4 INFORMATIONAL → GREEN without logic
//   - createFieldMapping: DuplicateFieldMappingError → correct error class (Cluster 16)
//   - autoMatchFields: creates registry-resolved pairs idempotently
//   - getUnmappedFieldsForMapping: computeUnmappedFields over real DB (Cluster 6)
//   - FieldExclusion CRUD: exclude/re-include a source field
//   - getUnmappedFieldsForPlan: plan-level aggregate

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  listFieldMappings,
  createFieldMapping,
  deleteFieldMapping,
  autoMatchFields,
  DuplicateFieldMappingError,
} from '@/features/field-mapping/services/field-mapping-service'
import {
  getUnmappedFieldsForMapping,
  getUnmappedFieldsForPlan,
  createExclusion,
  deleteExclusion,
  listExclusions,
} from '@/features/unmapped/services/unmapped-service'

// ─── Seed data ────────────────────────────────────────────────────────────────

const planIds: string[] = []
const connectionIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connectionIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
})

// Seed a full SF→HubSpot Contact→contacts plan with CURRENT snapshots + fields.
async function seedContactPlan() {
  const sourceConn = await prisma.connectorConnection.create({
    data: { adapterType: 'salesforce', name: 'SF FM-Integration (test)', status: 'CONNECTED' },
  })
  const destConn = await prisma.connectorConnection.create({
    data: { adapterType: 'hubspot', name: 'HS FM-Integration (test)', status: 'CONNECTED' },
  })
  connectionIds.push(sourceConn.id, destConn.id)

  const plan = await prisma.migrationPlan.create({
    data: {
      name: 'FM Integration — SF Contact → HS contacts',
      sourceConnectionId: sourceConn.id,
      destinationConnectionId: destConn.id,
    },
  })
  planIds.push(plan.id)

  // SOURCE snapshot: Salesforce Contact object with real SF field types
  const srcSnapshot = await prisma.schemaSnapshot.create({
    data: {
      connectionId: sourceConn.id,
      side: 'SOURCE',
      status: 'CURRENT',
    },
  })
  const srcObj = await prisma.schemaObject.create({
    data: { snapshotId: srcSnapshot.id, apiName: 'Contact', label: 'Contact' },
  })
  await prisma.objectField.createMany({
    data: [
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'Id',             label: 'Record ID',    dataType: 'id',       isRequired: true,  isReadOnly: true  },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'FirstName',      label: 'First Name',   dataType: 'string',   isRequired: false, isReadOnly: false },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'LastName',       label: 'Last Name',    dataType: 'string',   isRequired: true,  isReadOnly: false },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'Email',          label: 'Email',        dataType: 'email',    isRequired: false, isReadOnly: false },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'Phone',          label: 'Phone',        dataType: 'phone',    isRequired: false, isReadOnly: false },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'Title',          label: 'Title',        dataType: 'string',   isRequired: false, isReadOnly: false },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'Department',     label: 'Department',   dataType: 'string',   isRequired: false, isReadOnly: false },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'LeadSource',     label: 'Lead Source',  dataType: 'picklist', isRequired: false, isReadOnly: false, picklistValues: '["Web","Phone","Referral"]' },
      { objectId: srcObj.id, snapshotId: srcSnapshot.id, apiName: 'CreatedDate',    label: 'Created Date', dataType: 'datetime', isRequired: false, isReadOnly: true  },
    ],
  })

  // DESTINATION snapshot: HubSpot contacts object with real HS field types
  const dstSnapshot = await prisma.schemaSnapshot.create({
    data: {
      connectionId: destConn.id,
      side: 'DESTINATION',
      status: 'CURRENT',
    },
  })
  const dstObj = await prisma.schemaObject.create({
    data: { snapshotId: dstSnapshot.id, apiName: 'contacts', label: 'Contacts' },
  })
  await prisma.objectField.createMany({
    data: [
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'hs_object_id', label: 'Record ID',    dataType: 'number',      isRequired: true,  isReadOnly: true  },
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'firstname',    label: 'First Name',   dataType: 'text',        isRequired: false, isReadOnly: false },
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'lastname',     label: 'Last Name',    dataType: 'text',        isRequired: true,  isReadOnly: false },
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'email',        label: 'Email',        dataType: 'text',        isRequired: false, isReadOnly: false },
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'phone',        label: 'Phone Number', dataType: 'text',        isRequired: false, isReadOnly: false },
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'jobtitle',     label: 'Job Title',    dataType: 'text',        isRequired: false, isReadOnly: false },
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'department',   label: 'Department',   dataType: 'text',        isRequired: false, isReadOnly: false },
      { objectId: dstObj.id, snapshotId: dstSnapshot.id, apiName: 'hs_lead_status', label: 'Lead Status', dataType: 'enumeration', isRequired: true,  isReadOnly: false, picklistValues: '["new","open","in_progress","open_deal","unqualified","connected","bad_timing"]' },
    ],
  })

  // Object mapping: SF Contact → HubSpot contacts
  const objectMapping = await prisma.objectMapping.create({
    data: {
      planId: plan.id,
      sourceObjectName: 'Contact',
      destinationObjectName: 'contacts',
    },
  })

  return { plan, objectMapping, srcObj, dstObj, srcSnapshot, dstSnapshot, sourceConn, destConn }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('listFieldMappings — Cluster 3: linkStatus enrichment', () => {
  it('D4 INFORMATIONAL (string→text): returns GREEN without any logic', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    // Manually create a mapping: FirstName (string) → firstname (text) — D4
    await prisma.fieldMapping.create({
      data: {
        objectMappingId: objectMapping.id,
        sourceFieldName: 'FirstName',
        destinationFieldName: 'firstname',
        sourceFieldType: 'string',
        destinationFieldType: 'text',
        compatibilityStatus: 'COMPATIBLE',
      },
    })

    const dtos = await listFieldMappings(objectMapping.id)
    const dto = dtos.find((d) => d.sourceFieldName === 'FirstName')

    expect(dto).toBeDefined()
    expect(dto!.linkStatus).toBe('GREEN')
    expect(dto!.sourceFieldLabel).toBe('First Name')
    expect(dto!.destFieldLabel).toBe('First Name')
    expect(dto!.sourceFieldType).toBe('string')
    expect(dto!.destFieldType).toBe('text')
  })

  it('D1 VALUE_EQUIVALENCE (picklist→enumeration), no logic: RED_SOLID', async () => {
    const { objectMapping } = await seedContactPlan()

    await prisma.fieldMapping.create({
      data: {
        objectMappingId: objectMapping.id,
        sourceFieldName: 'LeadSource',
        destinationFieldName: 'hs_lead_status',
        sourceFieldType: 'picklist',
        destinationFieldType: 'enumeration',
        compatibilityStatus: 'COMPATIBLE',
      },
    })

    const dtos = await listFieldMappings(objectMapping.id)
    const dto = dtos.find((d) => d.sourceFieldName === 'LeadSource')

    expect(dto!.linkStatus).toBe('RED_SOLID')
    expect(dto!.migrationLogic).toBeNull()
  })

  it('Source field absent from CURRENT snapshot → BROKEN', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    // Create a mapping for a field that does NOT exist in the CURRENT snapshot
    await prisma.fieldMapping.create({
      data: {
        objectMappingId: objectMapping.id,
        sourceFieldName: 'StaleCustomField__c', // not in CURRENT snapshot
        destinationFieldName: 'firstname',
        sourceFieldType: 'string',
        destinationFieldType: 'text',
        compatibilityStatus: 'COMPATIBLE',
      },
    })

    const dtos = await listFieldMappings(objectMapping.id)
    const dto = dtos.find((d) => d.sourceFieldName === 'StaleCustomField__c')

    expect(dto).toBeDefined()
    expect(dto!.linkStatus).toBe('BROKEN')
    expect(dto!.statusDetail).toMatch(/source/)
  })
})

describe('createFieldMapping — Cluster 16: duplicate prevention (409)', () => {
  it('throws DuplicateFieldMappingError when sourceFieldName is already mapped', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    await createFieldMapping(plan.id, objectMapping.id, {
      sourceFieldName: 'FirstName',
      destinationFieldName: 'firstname',
    })

    await expect(
      createFieldMapping(plan.id, objectMapping.id, {
        sourceFieldName: 'FirstName',
        destinationFieldName: 'lastname', // different dest, same source — must throw
      }),
    ).rejects.toThrow(DuplicateFieldMappingError)
  })

  it('creates a mapping and returns DTO with linkStatus GREEN for D4', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    const dto = await createFieldMapping(plan.id, objectMapping.id, {
      sourceFieldName: 'LastName',
      destinationFieldName: 'lastname',
    })

    expect(dto.linkStatus).toBe('GREEN')
    expect(dto.sourceFieldLabel).toBe('Last Name')
    expect(dto.destFieldLabel).toBe('Last Name')
    expect(dto.autoCreated).toBe(false)
  })
})

describe('autoMatchFields — idempotent, registry-based', () => {
  it('creates SF→HS Contact field pairs via registry, skips already-mapped', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    // Pre-create one mapping that should be skipped
    await prisma.fieldMapping.create({
      data: {
        objectMappingId: objectMapping.id,
        sourceFieldName: 'FirstName',
        destinationFieldName: 'firstname',
        sourceFieldType: 'string',
        destinationFieldType: 'text',
        compatibilityStatus: 'COMPATIBLE',
      },
    })

    const result = await autoMatchFields(plan.id, objectMapping.id)

    expect(typeof result.created).toBe('number')
    expect(typeof result.skipped).toBe('number')
    // At minimum skipped >= 1 (FirstName already mapped) and created >= 1 (LastName→lastname)
    expect(result.skipped).toBeGreaterThanOrEqual(1)

    // Verify idempotency: running again produces 0 created
    const result2 = await autoMatchFields(plan.id, objectMapping.id)
    expect(result2.created).toBe(0)
  })
})

describe('getUnmappedFieldsForMapping — Cluster 6', () => {
  it('returns correct unmapped source fields and coverage', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    // Map FirstName and LastName only
    await createFieldMapping(plan.id, objectMapping.id, {
      sourceFieldName: 'FirstName',
      destinationFieldName: 'firstname',
    })
    await createFieldMapping(plan.id, objectMapping.id, {
      sourceFieldName: 'LastName',
      destinationFieldName: 'lastname',
    })

    const report = await getUnmappedFieldsForMapping(plan.id, objectMapping.id)

    // 9 total SF Contact fields, 2 mapped → 7 unmapped source
    expect(report.totalSourceFields).toBe(9)
    expect(report.mappedSourceFields).toBe(2)
    expect(report.unmappedSourceFields.length).toBe(7)
    expect(report.sourceCoverage).toBe(22) // Math.round(2/9 * 100) = 22

    // Required dest: hs_object_id, lastname, hs_lead_status (3 total)
    // lastname IS mapped → 2 remaining required dest
    expect(report.totalRequiredDestFields).toBe(3)
    expect(report.unmappedRequiredDestFields.length).toBe(2)
    expect(report.unmappedRequiredDestFields.map((f) => f.apiName)).toContain('hs_lead_status')
    expect(report.isComplete).toBe(false)
  })

  it('FieldExclusion CRUD — exclude and re-include a source field', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    // Exclude CreatedDate (read-only system field)
    const excl = await createExclusion(plan.id, objectMapping.id, 'CreatedDate', 'Read-only system field — not migrated')
    expect(excl.sourceFieldName).toBe('CreatedDate')
    expect(excl.reason).toBe('Read-only system field — not migrated')

    const exclusions = await listExclusions(objectMapping.id)
    expect(exclusions.map((e) => e.sourceFieldName)).toContain('CreatedDate')

    // Re-check report: CreatedDate should no longer appear in unmappedSourceFields
    const report = await getUnmappedFieldsForMapping(plan.id, objectMapping.id)
    expect(report.unmappedSourceFields.map((f) => f.apiName)).not.toContain('CreatedDate')
    expect(report.excludedSourceFields.map((e) => e.sourceFieldName)).toContain('CreatedDate')

    // Re-include
    await deleteExclusion(plan.id, objectMapping.id, excl.id)
    const reportAfter = await getUnmappedFieldsForMapping(plan.id, objectMapping.id)
    expect(reportAfter.unmappedSourceFields.map((f) => f.apiName)).toContain('CreatedDate')
    expect(reportAfter.excludedSourceFields.length).toBe(0)
  })
})

describe('getUnmappedFieldsForPlan — plan-level aggregate', () => {
  it('returns aggregate summary across all object mappings', async () => {
    const { plan } = await seedContactPlan()

    const planReport = await getUnmappedFieldsForPlan(plan.id)

    expect(planReport.objectMappings.length).toBeGreaterThanOrEqual(1)
    expect(typeof planReport.summary.totalUnmappedSource).toBe('number')
    expect(typeof planReport.summary.totalUnmappedRequiredDest).toBe('number')
    // All fields unmapped → not complete
    expect(planReport.summary.isComplete).toBe(false)
  })
})

describe('deleteFieldMapping — removes mapping and updates coverage', () => {
  it('deletes successfully and removes field from mapped list', async () => {
    const { plan, objectMapping } = await seedContactPlan()

    const dto = await createFieldMapping(plan.id, objectMapping.id, {
      sourceFieldName: 'Email',
      destinationFieldName: 'email',
    })
    expect(dto.id).toBeTruthy()

    await deleteFieldMapping(plan.id, dto.id)

    const dtos = await listFieldMappings(objectMapping.id)
    expect(dtos.find((d) => d.id === dto.id)).toBeUndefined()
  })
})
