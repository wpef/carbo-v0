// @vitest-environment node
//
// Integration test (layer 2) — runs against the disposable Neon test branch
// (DATABASE_URL loaded from .env.test by vitest.setup.ts). Proves that the
// filter SERVICE persists CRUD operations end-to-end with audit trail.
//
// Realistic data: Salesforce Contact → HubSpot contacts (Principle IV).
// NOT launched by unit test run — executed sequentially by the orchestrator.

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  listFilters,
  createFilter,
  updateFilter,
  deleteFilter,
  getFilterableFields,
  estimateFilteredCount,
  FilterNotFoundError,
  FilterFieldNotFoundError,
  MappingNotFoundError,
} from '@/features/filters/services/filter-service'
import { seedSnapshot } from '../_helpers/seed-schema'

// ─── Test lifecycle ───────────────────────────────────────────────────────────

const planIds: string[] = []
const connectionIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connectionIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
})

// ─── Seed helper ─────────────────────────────────────────────────────────────

async function seedContactMapping() {
  const source = await prisma.connectorConnection.create({
    data: { adapterType: 'demo', name: 'SF Demo (filters-test)', status: 'CONNECTED' },
  })
  const dest = await prisma.connectorConnection.create({
    data: { adapterType: 'demo', name: 'HS Demo (filters-test)', status: 'CONNECTED' },
  })
  connectionIds.push(source.id, dest.id)

  const plan = await prisma.migrationPlan.create({
    data: {
      name: 'Filters integration test plan',
      sourceConnectionId: source.id,
      destinationConnectionId: dest.id,
    },
  })
  planIds.push(plan.id)

  // Schema snapshot with realistic Salesforce Contact fields
  const snapshot = await seedSnapshot(source.id, 'SOURCE', [
    {
      apiName: 'Contact',
      label: 'Contact',
      fields: [
        { apiName: 'Id', label: 'Contact ID', dataType: 'id', isRequired: true, isReadOnly: true, isUnique: true },
        { apiName: 'FirstName', label: 'First Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
        { apiName: 'LastName', label: 'Last Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
        { apiName: 'Email', label: 'Email', dataType: 'email', isRequired: false, isReadOnly: false, isUnique: true },
        { apiName: 'Phone', label: 'Phone', dataType: 'phone', isRequired: false, isReadOnly: false, isUnique: false },
        { apiName: 'CreatedDate', label: 'Created Date', dataType: 'datetime', isRequired: true, isReadOnly: true, isUnique: false },
        { apiName: 'LeadSource', label: 'Lead Source', dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false },
      ],
    },
  ])

  const mapping = await prisma.objectMapping.create({
    data: {
      planId: plan.id,
      sourceObjectName: 'Contact',
      destinationObjectName: 'contacts',
    },
  })

  return { plan, mapping, snapshot, source, dest }
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('listFilters — integration', () => {
  it('returns empty list when no filters exist', async () => {
    const { mapping } = await seedContactMapping()
    const result = await listFilters(mapping.id)
    expect(result.filters).toEqual([])
    expect(result.count).toBe(0)
  })

  it('throws MappingNotFoundError for unknown mappingId', async () => {
    await expect(listFilters('non-existent-id')).rejects.toThrow(MappingNotFoundError)
  })
})

describe('createFilter — integration (FR-001, FR-005, FR-007)', () => {
  it('persists a valid filter and returns the filter DTO', async () => {
    const { mapping } = await seedContactMapping()

    const filter = await createFilter(mapping.id, {
      fieldApiName: 'Email',
      operator: 'NOT_EQUALS',
      value: '',
    })

    expect(filter.id).toBeDefined()
    expect(filter.objectMappingId).toBe(mapping.id)
    expect(filter.fieldApiName).toBe('Email')
    expect(filter.operator).toBe('NOT_EQUALS')
    expect(filter.value).toBe('')
    expect(filter.isActive).toBe(true)

    // Verify persistence
    const persisted = await prisma.migrationFilter.findUnique({ where: { id: filter.id } })
    expect(persisted).toBeTruthy()
  })

  it('persists a DATE_AFTER filter on CreatedDate (realistic SF use case)', async () => {
    const { mapping } = await seedContactMapping()

    const filter = await createFilter(mapping.id, {
      fieldApiName: 'CreatedDate',
      operator: 'DATE_AFTER',
      value: '2020-01-01',
    })

    expect(filter.operator).toBe('DATE_AFTER')
    expect(filter.value).toBe('2020-01-01')
    expect(filter.warning).toBeUndefined()
  })

  it('returns warning when DATE_AFTER is used on a text field (soft warning, FR-002)', async () => {
    const { mapping } = await seedContactMapping()

    const filter = await createFilter(mapping.id, {
      fieldApiName: 'LastName',
      operator: 'DATE_AFTER',
      value: '2020-01-01',
    })

    // Still created (soft warning does not block)
    expect(filter.id).toBeDefined()
    expect(filter.warning).toBeDefined()
    expect(filter.warning).toMatch(/DATE_AFTER/)
  })

  it('throws FilterFieldNotFoundError for a non-existent source field (FR-005)', async () => {
    const { mapping } = await seedContactMapping()

    await expect(
      createFilter(mapping.id, {
        fieldApiName: 'NonExistentField__c',
        operator: 'EQUALS',
        value: 'test',
      }),
    ).rejects.toThrow(FilterFieldNotFoundError)
  })

  it('logs FILTER_CREATED to audit trail (FR-007)', async () => {
    const { mapping, plan } = await seedContactMapping()

    const filter = await createFilter(mapping.id, {
      fieldApiName: 'LeadSource',
      operator: 'EQUALS',
      value: 'Web',
    })

    const auditLog = await prisma.auditLog.findFirst({
      where: { planId: plan.id, action: 'FILTER_CREATED', entityId: filter.id },
    })
    expect(auditLog).toBeTruthy()
    const details = JSON.parse(auditLog!.details ?? '{}')
    expect(details.fieldApiName).toBe('LeadSource')
    expect(details.operator).toBe('EQUALS')
  })
})

describe('listFilters — ordered by id asc (insertion-order proxy), with field label enrichment', () => {
  it('returns filters in stable insertion order (3 filters, all present)', async () => {
    const { mapping } = await seedContactMapping()

    await createFilter(mapping.id, { fieldApiName: 'Email', operator: 'NOT_EQUALS', value: '' })
    await createFilter(mapping.id, { fieldApiName: 'CreatedDate', operator: 'DATE_AFTER', value: '2020-01-01' })
    await createFilter(mapping.id, { fieldApiName: 'LeadSource', operator: 'EQUALS', value: 'Web' })

    const result = await listFilters(mapping.id)
    expect(result.count).toBe(3)
    const apiNames = result.filters.map((f) => f.fieldApiName)
    expect(apiNames).toContain('Email')
    expect(apiNames).toContain('CreatedDate')
    expect(apiNames).toContain('LeadSource')
  })

  it('enriches filters with fieldLabel from snapshot', async () => {
    const { mapping } = await seedContactMapping()
    await createFilter(mapping.id, { fieldApiName: 'Email', operator: 'NOT_EQUALS', value: '' })

    const result = await listFilters(mapping.id)
    expect(result.filters[0].fieldLabel).toBe('Email') // label from ObjectField
  })
})

describe('updateFilter (PATCH toggle + operator change)', () => {
  it('toggles isActive via PATCH', async () => {
    const { mapping } = await seedContactMapping()
    const filter = await createFilter(mapping.id, {
      fieldApiName: 'Email',
      operator: 'NOT_EQUALS',
      value: '',
    })

    expect(filter.isActive).toBe(true)

    const updated = await updateFilter(filter.id, { isActive: false })
    expect(updated.isActive).toBe(false)

    const backOn = await updateFilter(filter.id, { isActive: true })
    expect(backOn.isActive).toBe(true)
  })

  it('updates operator and value', async () => {
    const { mapping } = await seedContactMapping()
    const filter = await createFilter(mapping.id, {
      fieldApiName: 'LeadSource',
      operator: 'EQUALS',
      value: 'Web',
    })

    const updated = await updateFilter(filter.id, { operator: 'NOT_EQUALS', value: 'Partner' })
    expect(updated.operator).toBe('NOT_EQUALS')
    expect(updated.value).toBe('Partner')
  })

  it('throws FilterNotFoundError for unknown filterId', async () => {
    await expect(updateFilter('bad-id', { isActive: false })).rejects.toThrow(FilterNotFoundError)
  })
})

describe('deleteFilter — FR-006, FR-007', () => {
  it('removes the filter from the database', async () => {
    const { mapping } = await seedContactMapping()
    const filter = await createFilter(mapping.id, {
      fieldApiName: 'Phone',
      operator: 'IS_NULL',
    })

    await deleteFilter(filter.id)

    const deleted = await prisma.migrationFilter.findUnique({ where: { id: filter.id } })
    expect(deleted).toBeNull()
  })

  it('logs FILTER_REMOVED to audit trail (FR-007)', async () => {
    const { mapping, plan } = await seedContactMapping()
    const filter = await createFilter(mapping.id, {
      fieldApiName: 'Phone',
      operator: 'IS_NULL',
    })
    const filterId = filter.id

    await deleteFilter(filterId)

    const auditLog = await prisma.auditLog.findFirst({
      where: { planId: plan.id, action: 'FILTER_REMOVED', entityId: filterId },
    })
    expect(auditLog).toBeTruthy()
  })

  it('throws FilterNotFoundError when deleting a non-existent filter', async () => {
    await expect(deleteFilter('non-existent-filter-id')).rejects.toThrow(FilterNotFoundError)
  })

  it('cascade-deletes filters when ObjectMapping is deleted', async () => {
    const { mapping } = await seedContactMapping()
    const filter = await createFilter(mapping.id, {
      fieldApiName: 'Email',
      operator: 'NOT_EQUALS',
      value: '',
    })
    const filterId = filter.id

    // Cascade: delete the mapping
    await prisma.objectMapping.delete({ where: { id: mapping.id } })

    const orphan = await prisma.migrationFilter.findUnique({ where: { id: filterId } })
    expect(orphan).toBeNull()
  })
})

describe('getFilterableFields', () => {
  it('returns source fields from the schema snapshot', async () => {
    const { mapping } = await seedContactMapping()
    const fields = await getFilterableFields(mapping.id)

    expect(fields.length).toBeGreaterThan(0)
    const apiNames = fields.map((f) => f.apiName)
    expect(apiNames).toContain('Email')
    expect(apiNames).toContain('CreatedDate')
    expect(apiNames).toContain('LeadSource')
  })

  it('returns empty array when there is no schema snapshot', async () => {
    // Mapping with no snapshot attached
    const source = await prisma.connectorConnection.create({
      data: { adapterType: 'demo', name: 'No-snapshot source', status: 'CONNECTED' },
    })
    connectionIds.push(source.id)
    const plan = await prisma.migrationPlan.create({
      data: { name: 'No-snapshot plan', sourceConnectionId: source.id },
    })
    planIds.push(plan.id)
    const mapping = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })

    const fields = await getFilterableFields(mapping.id)
    expect(fields).toEqual([])
  })
})

describe('estimateFilteredCount — FR-004', () => {
  it('returns total count when no filters are active (isFiltered=false)', async () => {
    const { mapping } = await seedContactMapping()

    // Demo adapter returns 50 Contact records
    const estimate = await estimateFilteredCount(mapping.id)
    expect(estimate.isFiltered).toBe(false)
    expect(estimate.isEstimateAvailable).toBe(true)
    expect(estimate.estimatedCount).toBe(estimate.totalCount)
    expect(typeof estimate.totalCount).toBe('number')
  })

  it('returns isFiltered=true when at least one active filter exists', async () => {
    const { mapping } = await seedContactMapping()

    await createFilter(mapping.id, { fieldApiName: 'Email', operator: 'NOT_EQUALS', value: '' })

    const estimate = await estimateFilteredCount(mapping.id)
    expect(estimate.isFiltered).toBe(true)
    expect(estimate.isEstimateAvailable).toBe(true)
    // Demo adapter has no getFilteredRecordCount → falls back to total count
    expect(estimate.estimatedCount).toBe(estimate.totalCount)
  })

  it('inactive filters do not affect isFiltered', async () => {
    const { mapping } = await seedContactMapping()

    const filter = await createFilter(mapping.id, {
      fieldApiName: 'Email',
      operator: 'NOT_EQUALS',
      value: '',
    })
    await updateFilter(filter.id, { isActive: false })

    const estimate = await estimateFilteredCount(mapping.id)
    expect(estimate.isFiltered).toBe(false)
  })

  it('returns isEstimateAvailable=false when source connection is missing', async () => {
    // Plan with no source connection
    const plan = await prisma.migrationPlan.create({
      data: { name: 'No-source plan' },
    })
    planIds.push(plan.id)
    const mapping = await prisma.objectMapping.create({
      data: { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
    })

    const estimate = await estimateFilteredCount(mapping.id)
    expect(estimate.isEstimateAvailable).toBe(false)
    expect(estimate.message).toMatch(/connexion source/)
  })
})

describe('AND logic — FR-003', () => {
  it('stores multiple filters that are conceptually ANDed (service does not OR them)', async () => {
    const { mapping } = await seedContactMapping()

    await createFilter(mapping.id, { fieldApiName: 'Email', operator: 'NOT_EQUALS', value: '' })
    await createFilter(mapping.id, { fieldApiName: 'CreatedDate', operator: 'DATE_AFTER', value: '2020-01-01' })

    const { filters, count } = await listFilters(mapping.id)
    expect(count).toBe(2)
    expect(filters.every((f) => f.isActive)).toBe(true)

    // Both filters passed to estimateFilteredCount as active conditions (AND logic)
    const estimate = await estimateFilteredCount(mapping.id)
    expect(estimate.isFiltered).toBe(true)
  })
})
