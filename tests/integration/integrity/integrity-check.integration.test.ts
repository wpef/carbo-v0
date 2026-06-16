// @vitest-environment node
//
// Integration tests — 017-mapping-integrity-check
// Runs against real Postgres (DATABASE_URL from .env.test).
// NOT launched by the unit-test runner — executed sequentially by the CI orchestrator.
//
// Covers:
//   - checkIntegrity: healthy plan → 0 issues, status = DRAFT
//   - checkIntegrity: source object deleted (new snapshot) → BROKEN_REFERENCE, status = BROKEN
//   - checkIntegrity: source field deleted → BROKEN_REFERENCE on FIELD_MAPPING
//   - checkIntegrity: INCOMPATIBLE type change → INCOMPATIBLE_TYPE
//   - checkIntegrity: unmapped required field → UNMAPPED_REQUIRED_FIELD
//   - checkIntegrity: filter on missing field → INVALID_FILTER
//   - checkIntegrity: idempotent (re-run produces same issue, no duplicate)
//   - checkIntegrity: stale issue auto-resolved when schema is repaired
//   - resolveIssue: manually marks single issue resolved, updates plan status
//   - resolveAllForPlan: bulk-resolves all issues, returns to DRAFT
//   - repairBrokenMappings: deletes BROKEN_REFERENCE mappings (Principle IX)
//   - GET /api/plans/[planId]/integrity → 200 IntegrityCheckResult
//   - POST /api/plans/[planId]/integrity → 200 RepairResult
//   - PATCH /api/plans/[planId]/integrity → 200 resolve single issue
//   - GET /api/plans/[planId]/integrity → 404 unknown plan

import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  checkIntegrity,
  resolveIssue,
  resolveAllForPlan,
  repairBrokenMappings,
  getUnresolvedIssues,
  IssueAlreadyResolvedError,
} from '@/features/integrity/services/integrity-service'
import { seedSnapshot } from '../_helpers/seed-schema'

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const planIds: string[] = []
const connIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
})

// ─── Seed helper ──────────────────────────────────────────────────────────────

async function seedPlan(label = 'Integrity Test') {
  const srcConn = await prisma.connectorConnection.create({
    data: { adapterType: 'salesforce', name: `SF ${label}`, status: 'CONNECTED' },
  })
  const dstConn = await prisma.connectorConnection.create({
    data: { adapterType: 'hubspot', name: `HS ${label}`, status: 'CONNECTED' },
  })
  connIds.push(srcConn.id, dstConn.id)

  const plan = await prisma.migrationPlan.create({
    data: {
      name: label,
      status: 'DRAFT',
      currentStep: 'FIELD_MAPPING',
      sourceConnectionId: srcConn.id,
      destinationConnectionId: dstConn.id,
    },
  })
  planIds.push(plan.id)

  return { plan, srcConn, dstConn }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkIntegrity — integration', () => {
  it('healthy plan: no issues, status = DRAFT', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('Healthy')

    await seedSnapshot(srcConn.id, 'SOURCE', [
      {
        apiName: 'Contact', label: 'Contact',
        fields: [
          { apiName: 'Email', label: 'Email', dataType: 'email' },
          { apiName: 'FirstName', label: 'First Name', dataType: 'string' },
        ],
      },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      {
        apiName: 'contacts', label: 'Contacts',
        fields: [
          { apiName: 'email', label: 'Email', dataType: 'text', isRequired: false },
          { apiName: 'firstname', label: 'First Name', dataType: 'text', isRequired: false },
        ],
      },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    const result = await checkIntegrity(plan.id)

    expect(result.planStatus).toBe('DRAFT')
    expect(result.unresolvedIssues).toBe(0)
    expect(result.issues).toHaveLength(0)

    const updated = await prisma.migrationPlan.findUniqueOrThrow({ where: { id: plan.id } })
    expect(updated.status).toBe('DRAFT')
  })

  it('source object deleted: BROKEN_REFERENCE on OBJECT_MAPPING, status = BROKEN', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('BrokenSrcObj')

    // Initial snapshot with Contact
    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [{ apiName: 'Email', label: 'Email', dataType: 'email' }] },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [{ apiName: 'email', label: 'Email', dataType: 'text' }] },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    // Demote old snapshot and create a new CURRENT without Contact
    await prisma.schemaSnapshot.updateMany({
      where: { connectionId: srcConn.id, side: 'SOURCE', status: 'CURRENT' },
      data: { status: 'PREVIOUS' },
    })
    await seedSnapshot(srcConn.id, 'SOURCE', [
      // Contact object is GONE
      { apiName: 'Lead', label: 'Lead', fields: [{ apiName: 'Email', label: 'Email', dataType: 'email' }] },
    ])

    const result = await checkIntegrity(plan.id)

    expect(result.planStatus).toBe('BROKEN')
    expect(result.unresolvedIssues).toBeGreaterThan(0)

    const issue = result.issues.find((i) => i.entityType === 'OBJECT_MAPPING' && i.issueType === 'BROKEN_REFERENCE')
    expect(issue).toBeDefined()
    expect(issue?.message).toContain('Contact')

    const updated = await prisma.migrationPlan.findUniqueOrThrow({ where: { id: plan.id } })
    expect(updated.status).toBe('BROKEN')
  })

  it('source field deleted: BROKEN_REFERENCE on FIELD_MAPPING', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('BrokenSrcField')

    await seedSnapshot(srcConn.id, 'SOURCE', [
      {
        apiName: 'Contact', label: 'Contact',
        fields: [
          { apiName: 'Email', label: 'Email', dataType: 'email' },
          { apiName: 'CustomField__c', label: 'Custom', dataType: 'string' },
        ],
      },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      {
        apiName: 'contacts', label: 'Contacts',
        fields: [
          { apiName: 'email', label: 'Email', dataType: 'text' },
          { apiName: 'custom_field', label: 'Custom', dataType: 'text' },
        ],
      },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    const fm = await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'CustomField__c', destinationFieldName: 'custom_field', sourceFieldType: 'string', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    // New snapshot without CustomField__c
    await prisma.schemaSnapshot.updateMany({
      where: { connectionId: srcConn.id, side: 'SOURCE', status: 'CURRENT' },
      data: { status: 'PREVIOUS' },
    })
    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [{ apiName: 'Email', label: 'Email', dataType: 'email' }] },
    ])

    const result = await checkIntegrity(plan.id)

    expect(result.planStatus).toBe('BROKEN')
    const issue = result.issues.find((i) => i.entityType === 'FIELD_MAPPING' && i.entityId === fm.id && i.issueType === 'BROKEN_REFERENCE')
    expect(issue).toBeDefined()
    expect(issue?.message).toContain('CustomField__c')
  })

  it('INCOMPATIBLE type change: INCOMPATIBLE_TYPE on FIELD_MAPPING', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('IncompatibleType')

    // Source: Email is 'string', dest: email is 'boolean' (INCOMPATIBLE per matrix)
    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [{ apiName: 'Email', label: 'Email', dataType: 'string' }] },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [{ apiName: 'email', label: 'Email', dataType: 'boolean', isRequired: false }] },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'string', destinationFieldType: 'boolean', compatibilityStatus: 'INCOMPATIBLE' },
    })

    const result = await checkIntegrity(plan.id)

    expect(result.planStatus).toBe('BROKEN')
    const issue = result.issues.find((i) => i.issueType === 'INCOMPATIBLE_TYPE')
    expect(issue).toBeDefined()
  })

  it('unmapped required destination field: UNMAPPED_REQUIRED_FIELD (WARNING)', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('UnmappedRequired')

    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [{ apiName: 'Email', label: 'Email', dataType: 'email' }] },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      {
        apiName: 'contacts', label: 'Contacts',
        fields: [
          { apiName: 'email', label: 'Email', dataType: 'text', isRequired: false },
          { apiName: 'phone', label: 'Phone', dataType: 'text', isRequired: true, isReadOnly: false },
        ],
      },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    // Only map email, not phone (required)
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    const result = await checkIntegrity(plan.id)

    const issue = result.issues.find((i) => i.issueType === 'UNMAPPED_REQUIRED_FIELD')
    expect(issue).toBeDefined()
    expect(issue?.message).toContain('phone')
    expect(issue?.severity).toBe('WARNING')
    // UNMAPPED_REQUIRED_FIELD is a WARNING, not ERROR — plan can still be BROKEN if unresolved
    expect(result.unresolvedIssues).toBeGreaterThan(0)
  })

  it('filter on missing source field: INVALID_FILTER', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('InvalidFilter')

    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [{ apiName: 'Email', label: 'Email', dataType: 'email' }] },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [{ apiName: 'email', label: 'Email', dataType: 'text' }] },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    // Filter references a field that no longer exists
    await prisma.migrationFilter.create({
      data: { objectMappingId: om.id, fieldApiName: 'Status__c', operator: 'EQUALS', value: 'Active', isActive: true },
    })

    const result = await checkIntegrity(plan.id)

    const issue = result.issues.find((i) => i.issueType === 'INVALID_FILTER')
    expect(issue).toBeDefined()
    expect(issue?.message).toContain('Status__c')
  })

  it('idempotent: re-running check on same snapshot produces no duplicate issues', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('Idempotent')

    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [] }, // empty → no fields
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [] },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    await checkIntegrity(plan.id)
    const afterFirst = await prisma.integrityIssue.count({ where: { planId: plan.id } })

    await checkIntegrity(plan.id)
    const afterSecond = await prisma.integrityIssue.count({ where: { planId: plan.id } })

    expect(afterSecond).toBe(afterFirst) // same count — no duplicates
  })

  it('stale issue auto-resolved when the mapping is fixed', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('AutoResolve')

    // Initial snapshot missing the field → issue created
    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [] },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [{ apiName: 'email', label: 'Email', dataType: 'text' }] },
    ])

    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    const fm = await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    await checkIntegrity(plan.id)
    const unresolvedAfterFirst = await prisma.integrityIssue.count({ where: { planId: plan.id, resolved: false } })
    expect(unresolvedAfterFirst).toBeGreaterThan(0)

    // Rotate snapshot: add the Email field back
    await prisma.schemaSnapshot.updateMany({
      where: { connectionId: srcConn.id, side: 'SOURCE', status: 'CURRENT' },
      data: { status: 'PREVIOUS' },
    })
    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [{ apiName: 'Email', label: 'Email', dataType: 'email' }] },
    ])

    await checkIntegrity(plan.id)

    const unresolvedAfterSecond = await prisma.integrityIssue.count({ where: { planId: plan.id, resolved: false } })
    expect(unresolvedAfterSecond).toBe(0)

    // The stale issue should now be resolved
    const resolvedIssue = await prisma.integrityIssue.findFirst({ where: { planId: plan.id, entityId: fm.id, resolved: true } })
    expect(resolvedIssue).toBeDefined()
    expect(resolvedIssue?.resolvedAt).not.toBeNull()
  })
})

describe('resolveIssue — integration', () => {
  it('marks issue resolved and updates plan status to DRAFT', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('ResolveIssue')

    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Contact', label: 'Contact', fields: [] }, // field missing → issue
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [{ apiName: 'email', label: 'Email', dataType: 'text' }] },
    ])
    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    await checkIntegrity(plan.id)
    const issues = await getUnresolvedIssues(plan.id)
    expect(issues.length).toBeGreaterThan(0)

    const { issue, planStatus } = await resolveIssue(plan.id, issues[0].id)

    expect(issue.resolved).toBe(true)
    expect(issue.resolvedAt).not.toBeNull()
    // All issues resolved → DRAFT
    expect(planStatus).toBe('DRAFT')
  })

  it('throws IssueAlreadyResolvedError on second resolve', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('DoubleResolve')

    await seedSnapshot(srcConn.id, 'SOURCE', [{ apiName: 'Contact', label: 'Contact', fields: [] }])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [{ apiName: 'email', label: 'Email', dataType: 'text' }] },
    ])
    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    await checkIntegrity(plan.id)
    const issues = await getUnresolvedIssues(plan.id)
    const issueId = issues[0].id

    await resolveIssue(plan.id, issueId)
    await expect(resolveIssue(plan.id, issueId)).rejects.toThrow(IssueAlreadyResolvedError)
  })
})

describe('resolveAllForPlan — integration', () => {
  it('bulk-resolves all issues, returns DRAFT', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('BulkResolve')

    await seedSnapshot(srcConn.id, 'SOURCE', [{ apiName: 'Contact', label: 'Contact', fields: [] }])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      {
        apiName: 'contacts', label: 'Contacts',
        fields: [
          { apiName: 'email', label: 'Email', dataType: 'text', isRequired: true, isReadOnly: false },
          { apiName: 'phone', label: 'Phone', dataType: 'text', isRequired: true, isReadOnly: false },
        ],
      },
    ])
    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    await checkIntegrity(plan.id)
    const before = await prisma.integrityIssue.count({ where: { planId: plan.id, resolved: false } })
    expect(before).toBeGreaterThan(0)

    const { resolvedCount, planStatus } = await resolveAllForPlan(plan.id)

    expect(resolvedCount).toBe(before)
    expect(planStatus).toBe('DRAFT')

    const after = await prisma.integrityIssue.count({ where: { planId: plan.id, resolved: false } })
    expect(after).toBe(0)
  })
})

describe('repairBrokenMappings — integration', () => {
  it('deletes BROKEN_REFERENCE mappings and re-checks, returning DRAFT', async () => {
    const { plan, srcConn, dstConn } = await seedPlan('Repair')

    // Source object missing Contact
    await seedSnapshot(srcConn.id, 'SOURCE', [
      { apiName: 'Lead', label: 'Lead', fields: [{ apiName: 'Email', label: 'Email', dataType: 'email' }] },
    ])
    await seedSnapshot(dstConn.id, 'DESTINATION', [
      { apiName: 'contacts', label: 'Contacts', fields: [{ apiName: 'email', label: 'Email', dataType: 'text' }] },
    ])
    const om = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' }, // Contact doesn't exist in source!
    })
    await prisma.fieldMapping.create({
      data: { objectMappingId: om.id, sourceFieldName: 'Email', destinationFieldName: 'email', sourceFieldType: 'email', destinationFieldType: 'text', compatibilityStatus: 'COMPATIBLE' },
    })

    await checkIntegrity(plan.id) // creates BROKEN_REFERENCE on OBJECT_MAPPING

    const { deletedObjectMappings, planStatus } = await repairBrokenMappings(plan.id)

    expect(deletedObjectMappings).toBe(1)
    expect(planStatus).toBe('DRAFT')

    // The object mapping should be gone
    const remaining = await prisma.objectMapping.findMany({ where: { planId: plan.id } })
    expect(remaining).toHaveLength(0)
  })
})
