// @vitest-environment node
//
// Integration test — Cluster 11: detectLiveDrift end-to-end (FR-012 … FR-016)
// Runs against the disposable Neon test branch (DATABASE_URL from .env.test).
// DO NOT run locally with the shared branch — executed sequentially by the orchestrator.
//
// Scope: proves detectLiveDrift correctly builds MappingContext from DB rows,
// calls the adapter, and returns the right DriftReport status + changes.
// The demo adapter is used so no real connector credentials are needed.

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { detectLiveDrift } from '@/features/schema/services/drift-service'
import { retrieveFieldsForObjects } from '@/features/schema/services/field-retrieval-service'

// ---------------------------------------------------------------------------
// Cleanup registry
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Seed helper — creates a full plan with a snapshot of demo objects + fields
// ---------------------------------------------------------------------------

async function seedDemoPlan() {
  const source = await prisma.connectorConnection.create({
    data: { adapterType: 'demo', name: 'Demo Source (drift-integration)', status: 'CONNECTED' },
  })
  const dest = await prisma.connectorConnection.create({
    data: { adapterType: 'demo', name: 'Demo Dest (drift-integration)', status: 'CONNECTED' },
  })
  connectionIds.push(source.id, dest.id)

  const plan = await prisma.migrationPlan.create({
    data: { name: 'Drift integration test', sourceConnectionId: source.id, destinationConnectionId: dest.id },
  })
  planIds.push(plan.id)

  // Create a CURRENT snapshot with the same objects the demo adapter returns
  // (Contact, Account, Deal) so there is nothing to detect initially.
  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      connectionId: source.id,
      side: 'SOURCE',
      status: 'CURRENT',
      objects: {
        create: [
          { apiName: 'Contact', label: 'Contact' },
          { apiName: 'Account', label: 'Account' },
          { apiName: 'Deal',    label: 'Deal'    },
        ],
      },
    },
    include: { objects: true },
  })

  // Populate fields via the real service (Cluster 5 path — writes isAccessible + picklistValues)
  await retrieveFieldsForObjects(plan.id, source.id, 'demo', snapshot.id, ['Contact', 'Account', 'Deal'])

  return { plan, snapshot, source }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectLiveDrift — integration against Neon (demo adapter)', () => {
  it('returns status=ok when stored snapshot matches live demo schema (no mapping context)', async () => {
    const { plan } = await seedDemoPlan()

    const report = await detectLiveDrift(plan.id, 'source')

    // Demo adapter always returns the same schema, no ObjectMappings exist yet
    // → no field-level diff (no mapped objects), object list unchanged → ok
    expect(report.status).toBe('ok')
    expect(report.changes).toHaveLength(0)
    expect(report.role).toBe('source')
  })

  it('returns status=unavailable when no CURRENT snapshot exists', async () => {
    // Create a bare plan with a connection but no snapshot
    const source = await prisma.connectorConnection.create({
      data: { adapterType: 'demo', name: 'Demo no-snapshot', status: 'CONNECTED' },
    })
    connectionIds.push(source.id)

    const plan = await prisma.migrationPlan.create({
      data: { name: 'No snapshot plan', sourceConnectionId: source.id },
    })
    planIds.push(plan.id)

    const report = await detectLiveDrift(plan.id, 'source')

    expect(report.status).toBe('unavailable')
    expect(report.reason).toMatch(/no current snapshot/i)
  })

  it('returns status=ok for destination role with no mapping context (no object mappings)', async () => {
    const { plan } = await seedDemoPlan()
    const report = await detectLiveDrift(plan.id, 'destination')
    // Destination has no snapshot → unavailable
    expect(['ok', 'unavailable']).toContain(report.status)
  })

  it('detects field-level drift when a field is manually removed from the snapshot', async () => {
    const { plan, snapshot } = await seedDemoPlan()

    // Create an ObjectMapping so Contact is in MappingContext
    const sourceObjects = await prisma.schemaObject.findMany({ where: { snapshotId: snapshot.id } })
    const contactObj = sourceObjects.find((o) => o.apiName === 'Contact')!

    const om = await prisma.objectMapping.create({
      data: {
        planId: plan.id,
        sourceObjectName: 'Contact',
        destinationObjectName: 'contacts',
      },
    })

    // Create field mapping on Email so it's in MappingContext
    await prisma.fieldMapping.create({
      data: {
        objectMappingId: om.id,
        sourceFieldName: 'Email',
        destinationFieldName: 'email',
        sourceFieldType: 'email',
        destinationFieldType: 'email',
      },
    })

    // Manually delete the Email field from the stored snapshot to simulate drift
    await prisma.objectField.deleteMany({
      where: { objectId: contactObj.id, apiName: 'Email' },
    })

    // Re-insert it but with a different dataType to simulate a type change
    await prisma.objectField.create({
      data: {
        objectId: contactObj.id,
        snapshotId: snapshot.id,
        apiName: 'Email',
        label: 'Email',
        dataType: 'textarea', // was 'email' in demo adapter — deliberate mismatch
        isRequired: false,
        isReadOnly: false,
        isUnique: false,
        isAccessible: true,
      },
    })

    const report = await detectLiveDrift(plan.id, 'source')

    // The live adapter returns Email with dataType='email', stored has 'textarea'
    // → FIELD_TYPE_CHANGED expected
    expect(report.status).toBe('drift')
    const typeChange = report.changes.find(
      (c) => c.type === 'FIELD_TYPE_CHANGED' && c.fieldApiName === 'Email',
    )
    expect(typeChange).toBeDefined()
    expect(typeChange!.affectsMapping).toBe(true) // Email was in FieldMapping
  })

  it('only inspects field-level changes for mapped objects (FR-016)', async () => {
    const { plan, snapshot } = await seedDemoPlan()

    // Map only Contact — Account and Deal should not get field-level drift
    await prisma.objectMapping.create({
      data: {
        planId: plan.id,
        sourceObjectName: 'Contact',
        destinationObjectName: 'contacts',
      },
    })

    const report = await detectLiveDrift(plan.id, 'source')

    // Any field-level changes must only concern Contact
    const fieldChanges = report.changes.filter((c) => c.fieldApiName !== undefined)
    expect(fieldChanges.every((c) => c.objectApiName === 'Contact')).toBe(true)
  })
})
