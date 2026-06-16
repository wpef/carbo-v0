// @vitest-environment node
//
// Integration tests — 022-schema-write
// NOT launched by the unit test runner — executed against a live Neon test DB.
//
// The demo adapter exposes a fixed schema (Contact / Account / Deal) via getSchema(),
// and the post-write snapshot refresh rebuilds from getSchema(); tests therefore write
// against the demo's REAL objects/fields so the round-trip stays consistent. The demo
// schema is mutated in place by the write methods, so we reset it in afterAll.

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createField,
  modifyField,
  createObject,
  checkCapability,
  SchemaWriteValidationError,
} from '@/features/schema-write/services'
import { __resetDemoSchemaForTests } from '@/lib/adapters/demo/demo-adapter'
import { seedSnapshot } from '../_helpers/seed-schema'

// ─── Teardown ─────────────────────────────────────────────────────────────────

const connectionIds: string[] = []
const planIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connectionIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  __resetDemoSchemaForTests() // undo in-place demo schema mutations so other suites aren't polluted
  await prisma.$disconnect()
})

// ─── Seed ─────────────────────────────────────────────────────────────────────
// Seed a DESTINATION snapshot matching the demo adapter's real Contact object,
// so validation (DB-based) and the adapter (getSchema-based) agree.

async function seedDemoDestination() {
  const conn = await prisma.connectorConnection.create({
    data: { adapterType: 'demo', name: `Demo Destination (schema-write IT ${Date.now()})`, status: 'CONNECTED' },
  })
  connectionIds.push(conn.id)

  const plan = await prisma.migrationPlan.create({
    data: { name: 'Schema Write IT Plan', destinationConnectionId: conn.id },
  })
  planIds.push(plan.id)

  await seedSnapshot(conn.id, 'DESTINATION', [
    {
      apiName: 'Contact',
      label: 'Contact',
      fields: [
        { apiName: 'Id', label: 'Contact ID', dataType: 'id', isRequired: true, isReadOnly: true, isUnique: true },
        { apiName: 'FirstName', label: 'First Name', dataType: 'string' },
        { apiName: 'LastName', label: 'Last Name', dataType: 'string', isRequired: true },
        { apiName: 'Email', label: 'Email', dataType: 'email', isRequired: true, isUnique: true },
      ],
    },
  ])

  return { conn, plan }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('022-schema-write — integration', () => {
  it('checkCapability returns canWriteSchema=true and supportedFieldTypes for demo adapter', async () => {
    const { conn } = await seedDemoDestination()
    const capability = await checkCapability(conn.id, 'demo')

    expect(capability.canWriteSchema).toBe(true)
    expect(capability.supportedFieldTypes).toContain('string')
    expect(capability.supportedFieldTypes.length).toBeGreaterThan(0)
  })

  it('createField: creates a new string field on Contact, logs SchemaWriteOperation SUCCESS', async () => {
    const { conn, plan } = await seedDemoDestination()

    const { field, operation } = await createField(
      conn.id,
      'demo',
      'Contact',
      {
        name: 'customer_segment',
        label: 'Customer Segment',
        type: 'string',
        description: 'Marketing segmentation value for the contact.',
      },
      plan.id,
    )

    expect(field.apiName).toBe('customer_segment')
    expect(field.label).toBe('Customer Segment')
    expect(field.dataType).toBe('string')

    expect(operation.operationType).toBe('CREATE_FIELD')
    expect(operation.result).toBe('SUCCESS')
    expect(operation.connectionId).toBe(conn.id)
    expect(operation.errorMessage).toBeNull()

    const dbOp = await prisma.schemaWriteOperation.findUnique({ where: { id: operation.id } })
    expect(dbOp).not.toBeNull()
    expect(dbOp!.status).toBe('SUCCESS')
  })

  it('createField: duplicate field name throws SchemaWriteValidationError', async () => {
    const { conn, plan } = await seedDemoDestination()

    await expect(
      createField(conn.id, 'demo', 'Contact', { name: 'Email', label: 'Email', type: 'string' }, plan.id),
    ).rejects.toThrow(SchemaWriteValidationError)
  })

  it('createField: enumeration type without picklistValues throws SchemaWriteValidationError', async () => {
    const { conn, plan } = await seedDemoDestination()

    await expect(
      createField(
        conn.id,
        'demo',
        'Contact',
        { name: 'deal_stage', label: 'Deal Stage', type: 'enumeration' /* no picklistValues */ },
        plan.id,
      ),
    ).rejects.toThrow(SchemaWriteValidationError)
  })

  it('createField: enumeration with picklistValues succeeds', async () => {
    const { conn, plan } = await seedDemoDestination()

    const { field } = await createField(
      conn.id,
      'demo',
      'Contact',
      {
        name: 'lead_source',
        label: 'Lead Source',
        type: 'enumeration',
        picklistValues: ['Organic', 'Referral', 'Paid Search', 'Event', 'Direct'],
      },
      plan.id,
    )

    expect(field.apiName).toBe('lead_source')
    expect(field.picklistValues).toEqual(['Organic', 'Referral', 'Paid Search', 'Event', 'Direct'])
  })

  it('modifyField: updates an existing field label and logs operation', async () => {
    const { conn, plan } = await seedDemoDestination()

    const { field, operation } = await modifyField(
      conn.id,
      'demo',
      'Contact',
      'FirstName',
      { label: 'Given Name' },
      plan.id,
    )

    expect(field.label).toBe('Given Name')
    expect(operation.operationType).toBe('MODIFY_FIELD')
    expect(operation.result).toBe('SUCCESS')
  })

  it('modifyField: non-existent field throws SchemaWriteValidationError', async () => {
    const { conn, plan } = await seedDemoDestination()

    await expect(
      modifyField(conn.id, 'demo', 'Contact', 'nonexistent__c', { label: 'Updated' }, plan.id),
    ).rejects.toThrow(SchemaWriteValidationError)
  })

  it('createObject: creates a new custom object and logs operation', async () => {
    const { conn, plan } = await seedDemoDestination()

    const { object, operation } = await createObject(
      conn.id,
      'demo',
      {
        name: 'projects',
        label: 'Projects',
        description: 'Custom object for tracking client projects.',
        primaryProperty: { name: 'project_name', label: 'Project Name', type: 'string' },
      },
      plan.id,
    )

    expect(object.apiName).toBe('projects')
    expect(object.label).toBe('Projects')
    expect(object.isCustom).toBe(true)

    expect(operation.operationType).toBe('CREATE_OBJECT')
    expect(operation.result).toBe('SUCCESS')
  })

  it('checkCapability returns canWriteSchema=true for the demo adapter', async () => {
    const { conn } = await seedDemoDestination()
    const cap = await checkCapability(conn.id, 'demo')
    expect(cap.canWriteSchema).toBe(true)
  })

  it('audit trail: AuditLog entry is created for a successful field creation', async () => {
    const { conn, plan } = await seedDemoDestination()

    const before = await prisma.auditLog.count({ where: { planId: plan.id } })

    await createField(
      conn.id,
      'demo',
      'Contact',
      { name: 'nps_score', label: 'NPS Score', type: 'number' },
      plan.id,
    )

    const after = await prisma.auditLog.count({ where: { planId: plan.id } })
    expect(after).toBeGreaterThan(before)
  })
})
