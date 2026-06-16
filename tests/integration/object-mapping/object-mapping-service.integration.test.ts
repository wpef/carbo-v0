// @vitest-environment node
//
// Integration tests for object-mapping service (011 — lane object-mapping-ui)
// Runs against the disposable Neon test branch (DATABASE_URL from .env.test).
//
// Coverage:
//   - listObjectMappings: empty + populated
//   - createObjectMapping: success, fan-in warning, duplicate rejection (409 constraint)
//   - deleteObjectMapping: cascade verification (fieldMappings + filters removed)
//   - autoLinkObjects: first run creates pairs + sets objectAutoLinkedAt
//                      second run is idempotent (Principle IX gate)
//   - getMappingStats: aggregates fieldMappings + filters + totalSourceFields

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  listObjectMappings,
  createObjectMapping,
  deleteObjectMapping,
  autoLinkObjects,
  getMappingStats,
} from '@/features/object-mapping/services/object-mapping-service'
import { seedSnapshot } from '../_helpers/seed-schema'

// ─── Shared cleanup registry ──────────────────────────────────────────────────

const planIds: string[] = []
const connectionIds: string[] = []

afterAll(async () => {
  for (const id of planIds) {
    await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  }
  for (const id of connectionIds) {
    await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  }
  await prisma.$disconnect()
})

// ─── Realistic seed data (Principle IV: no toy fixtures) ─────────────────────

const SF_OBJECTS = [
  { apiName: 'Account', label: 'Account', fields: [
    { apiName: 'Name', label: 'Account Name', dataType: 'string', isRequired: true },
    { apiName: 'Phone', label: 'Phone', dataType: 'string' },
    { apiName: 'Website', label: 'Website', dataType: 'url' },
  ]},
  { apiName: 'Contact', label: 'Contact', fields: [
    { apiName: 'FirstName', label: 'First Name', dataType: 'string' },
    { apiName: 'LastName', label: 'Last Name', dataType: 'string', isRequired: true },
    { apiName: 'Email', label: 'Email', dataType: 'email' },
  ]},
  { apiName: 'Lead', label: 'Lead', fields: [
    { apiName: 'FirstName', label: 'First Name', dataType: 'string' },
    { apiName: 'Company', label: 'Company', dataType: 'string', isRequired: true },
  ]},
  { apiName: 'Opportunity', label: 'Opportunity', fields: [
    { apiName: 'Name', label: 'Opp Name', dataType: 'string', isRequired: true },
    { apiName: 'StageName', label: 'Stage', dataType: 'picklist' },
    { apiName: 'Amount', label: 'Amount', dataType: 'currency' },
  ]},
]

const HS_OBJECTS = [
  { apiName: 'companies', label: 'Companies', fields: [
    { apiName: 'name', label: 'Company Name', dataType: 'string', isRequired: true },
    { apiName: 'phone', label: 'Phone Number', dataType: 'string' },
  ]},
  { apiName: 'contacts', label: 'Contacts', fields: [
    { apiName: 'firstname', label: 'First Name', dataType: 'string' },
    { apiName: 'lastname', label: 'Last Name', dataType: 'string', isRequired: true },
    { apiName: 'email', label: 'Email', dataType: 'string' },
  ]},
  { apiName: 'deals', label: 'Deals', fields: [
    { apiName: 'dealname', label: 'Deal Name', dataType: 'string', isRequired: true },
    { apiName: 'amount', label: 'Amount', dataType: 'number' },
    { apiName: 'dealstage', label: 'Deal Stage', dataType: 'enumeration', picklistValues: '["appointmentscheduled","qualifiedtobuy","presentationscheduled"]' },
  ]},
]

async function seedPlan(opts?: { name?: string }) {
  const source = await prisma.connectorConnection.create({
    data: { adapterType: 'salesforce', name: 'Salesforce (integration-test)', status: 'CONNECTED' },
  })
  const dest = await prisma.connectorConnection.create({
    data: { adapterType: 'hubspot', name: 'HubSpot (integration-test)', status: 'CONNECTED' },
  })
  connectionIds.push(source.id, dest.id)

  const plan = await prisma.migrationPlan.create({
    data: {
      name: opts?.name ?? 'Integration test plan',
      sourceConnectionId: source.id,
      destinationConnectionId: dest.id,
    },
  })
  planIds.push(plan.id)

  await seedSnapshot(source.id, 'SOURCE', SF_OBJECTS)
  await seedSnapshot(dest.id, 'DESTINATION', HS_OBJECTS)

  return { plan, source, dest }
}

// ─── listObjectMappings ───────────────────────────────────────────────────────

describe('listObjectMappings', () => {
  it('returns empty array for a plan with no mappings', async () => {
    const { plan } = await seedPlan({ name: 'list-empty' })
    const result = await listObjectMappings(plan.id)
    expect(result).toEqual([])
  })

  it('returns all mappings in ascending sourceObjectName order', async () => {
    const { plan } = await seedPlan({ name: 'list-populated' })
    await prisma.objectMapping.createMany({
      data: [
        { planId: plan.id, sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
        { planId: plan.id, sourceObjectName: 'Account', destinationObjectName: 'companies' },
      ],
    })
    const result = await listObjectMappings(plan.id)
    expect(result.map((m) => m.sourceObjectName)).toEqual(['Account', 'Contact'])
  })
})

// ─── createObjectMapping ──────────────────────────────────────────────────────

describe('createObjectMapping', () => {
  it('creates a mapping and returns it with no warnings for first-time pair', async () => {
    const { plan } = await seedPlan({ name: 'create-success' })
    const { mapping, warnings } = await createObjectMapping(plan.id, 'Account', 'companies')
    expect(mapping.sourceObjectName).toBe('Account')
    expect(mapping.destinationObjectName).toBe('companies')
    expect(mapping.autoCreated).toBe(false)
    expect(warnings).toHaveLength(0)
  })

  it('returns a fan-in warning when two sources map to the same destination', async () => {
    const { plan } = await seedPlan({ name: 'create-fan-in' })
    await createObjectMapping(plan.id, 'Contact', 'contacts')
    const { warnings } = await createObjectMapping(plan.id, 'Lead', 'contacts')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toMatch(/fan-in/i)
  })

  it('throws a unique constraint error for a duplicate pair', async () => {
    const { plan } = await seedPlan({ name: 'create-duplicate' })
    await createObjectMapping(plan.id, 'Account', 'companies')
    await expect(
      createObjectMapping(plan.id, 'Account', 'companies'),
    ).rejects.toThrow()
  })
})

// ─── deleteObjectMapping ──────────────────────────────────────────────────────

describe('deleteObjectMapping', () => {
  it('deletes the mapping and returns child counts', async () => {
    const { plan } = await seedPlan({ name: 'delete-basic' })
    const { mapping } = await createObjectMapping(plan.id, 'Account', 'companies')

    const result = await deleteObjectMapping(plan.id, mapping.id)
    expect(result.fieldMappingsCount).toBe(0)
    expect(result.filtersCount).toBe(0)

    const remaining = await prisma.objectMapping.count({ where: { id: mapping.id } })
    expect(remaining).toBe(0)
  })

  it('cascades fieldMappings + filters on delete', async () => {
    const { plan } = await seedPlan({ name: 'delete-cascade' })
    const { mapping } = await createObjectMapping(plan.id, 'Opportunity', 'deals')

    // Seed child field mappings
    const fm = await prisma.fieldMapping.create({
      data: {
        objectMappingId: mapping.id,
        sourceFieldName: 'Name',
        destinationFieldName: 'dealname',
        sourceFieldType: 'string',
        destinationFieldType: 'string',
      },
    })
    // Seed a migration filter
    await prisma.migrationFilter.create({
      data: {
        objectMappingId: mapping.id,
        fieldApiName: 'Amount',
        operator: 'GREATER_THAN',
        value: '0',
      },
    })

    const result = await deleteObjectMapping(plan.id, mapping.id)
    expect(result.fieldMappingsCount).toBe(1)
    expect(result.filtersCount).toBe(1)

    // Verify cascade: field mapping should be gone
    const fmCount = await prisma.fieldMapping.count({ where: { id: fm.id } })
    expect(fmCount).toBe(0)
  })
})

// ─── autoLinkObjects ──────────────────────────────────────────────────────────

describe('autoLinkObjects (SF → HS registry, Principle IX)', () => {
  it('creates predictable pairs and sets objectAutoLinkedAt in the same transaction', async () => {
    const { plan } = await seedPlan({ name: 'autolink-first-run' })

    const result = await autoLinkObjects(plan.id)

    // Registry: Account→companies, Contact→contacts, Opportunity→deals, Lead→contacts
    expect(result.created).toBe(4)
    expect(result.alreadyLinkedAt).toBeNull()
    expect(result.createdMappings).toHaveLength(4)
    expect(result.createdMappings.every((m) => m.autoCreated)).toBe(true)

    const updatedPlan = await prisma.migrationPlan.findUniqueOrThrow({ where: { id: plan.id } })
    expect(updatedPlan.objectAutoLinkedAt).not.toBeNull()

    const mappings = await prisma.objectMapping.findMany({
      where: { planId: plan.id },
      orderBy: { sourceObjectName: 'asc' },
    })
    expect(mappings.map((m) => `${m.sourceObjectName}→${m.destinationObjectName}`)).toEqual([
      'Account→companies',
      'Contact→contacts',
      'Lead→contacts',
      'Opportunity→deals',
    ])
  })

  it('is idempotent: second run returns alreadyLinkedAt without creating more mappings (Principle IX)', async () => {
    const { plan } = await seedPlan({ name: 'autolink-idempotent' })
    await autoLinkObjects(plan.id)
    const second = await autoLinkObjects(plan.id)

    expect(second.created).toBe(0)
    expect(second.alreadyLinkedAt).not.toBeNull()
    expect(second.createdMappings).toHaveLength(0)

    // Still exactly 4 mappings — no extras
    const count = await prisma.objectMapping.count({ where: { planId: plan.id } })
    expect(count).toBe(4)
  })

  it('does not re-fire even when all manual mappings have been deleted (Principle IX)', async () => {
    const { plan } = await seedPlan({ name: 'autolink-after-manual-delete' })
    await autoLinkObjects(plan.id)

    // Consultant deletes every mapping manually
    await prisma.objectMapping.deleteMany({ where: { planId: plan.id } })

    // Auto-link must NOT re-fire
    const third = await autoLinkObjects(plan.id)
    expect(third.created).toBe(0)
    expect(third.alreadyLinkedAt).not.toBeNull()

    const count = await prisma.objectMapping.count({ where: { planId: plan.id } })
    expect(count).toBe(0)
  })
})

// ─── getMappingStats ──────────────────────────────────────────────────────────

describe('getMappingStats', () => {
  it('returns zero counts for a fresh mapping with no field mappings or filters', async () => {
    const { plan } = await seedPlan({ name: 'stats-empty' })
    const { mapping } = await createObjectMapping(plan.id, 'Account', 'companies')

    const stats = await getMappingStats(plan.id, mapping.id)
    expect(stats.mappedFieldCount).toBe(0)
    expect(stats.validatedFieldCount).toBe(0)
    expect(stats.filterCount).toBe(0)
    // Account has 3 source fields seeded
    expect(stats.totalSourceFields).toBe(3)
    expect(stats.sourceRecordCount).toBeNull()
  })

  it('counts field mappings and validated logic correctly', async () => {
    const { plan } = await seedPlan({ name: 'stats-with-fields' })
    const { mapping } = await createObjectMapping(plan.id, 'Opportunity', 'deals')

    // Seed 2 field mappings, one with VALIDATED logic
    const fm1 = await prisma.fieldMapping.create({
      data: {
        objectMappingId: mapping.id,
        sourceFieldName: 'Name',
        destinationFieldName: 'dealname',
        sourceFieldType: 'string',
        destinationFieldType: 'string',
      },
    })
    await prisma.migrationLogic.create({
      data: { fieldMappingId: fm1.id, status: 'VALIDATED' },
    })

    await prisma.fieldMapping.create({
      data: {
        objectMappingId: mapping.id,
        sourceFieldName: 'StageName',
        destinationFieldName: 'dealstage',
        sourceFieldType: 'picklist',
        destinationFieldType: 'enumeration',
      },
    })

    // Seed a migration filter
    await prisma.migrationFilter.create({
      data: { objectMappingId: mapping.id, fieldApiName: 'Amount', operator: 'GREATER_THAN', value: '0' },
    })

    const stats = await getMappingStats(plan.id, mapping.id)
    expect(stats.mappedFieldCount).toBe(2)
    expect(stats.validatedFieldCount).toBe(1)
    expect(stats.filterCount).toBe(1)
    // Opportunity has 3 source fields seeded
    expect(stats.totalSourceFields).toBe(3)
  })
})
