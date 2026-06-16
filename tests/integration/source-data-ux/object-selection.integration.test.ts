// @vitest-environment node
//
// Integration test — object selection service against Neon DB.
// Proves initDefaultSelection, migrateSelection, and getObjectsWithSelection
// work end-to-end with real Prisma queries.

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { seedSnapshot } from '../_helpers/seed-schema'
import {
  initDefaultSelection,
  migrateSelection,
  getObjectsWithSelection,
  saveSelections,
} from '@/features/schema/services/object-selection-service'

const planIds: string[] = []
const connectionIds: string[] = []

afterAll(async () => {
  for (const id of planIds) await prisma.migrationPlan.delete({ where: { id } }).catch(() => {})
  for (const id of connectionIds) await prisma.connectorConnection.delete({ where: { id } }).catch(() => {})
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedConnection() {
  const conn = await prisma.connectorConnection.create({
    data: { adapterType: 'salesforce', name: 'SF (object-selection-test)', status: 'CONNECTED' },
  })
  connectionIds.push(conn.id)
  return conn
}

// Realistic Salesforce objects
const SF_SOURCE_OBJECTS = [
  { apiName: 'Account',    label: 'Account',      isCustom: false },
  { apiName: 'Contact',    label: 'Contact',      isCustom: false },
  { apiName: 'Lead',       label: 'Lead',         isCustom: false },
  { apiName: 'Invoice__c', label: 'Invoice',      isCustom: true },
  { apiName: 'ApexClass',  label: 'Apex Class',   isCustom: false },
]

const COMMON_BUSINESS = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign']
const SYSTEM_PREFIXES: string[] = ['Apex', 'Setup']

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initDefaultSelection — integration', () => {
  it('creates selections with correct pre-selection for business and custom objects', async () => {
    const conn = await seedConnection()
    const snapshot = await seedSnapshot(conn.id, 'SOURCE', SF_SOURCE_OBJECTS)

    await initDefaultSelection(conn.id, snapshot.id, COMMON_BUSINESS)

    const selections = await prisma.objectSelection.findMany({
      where: { connectionId: conn.id, snapshotId: snapshot.id },
    })

    expect(selections).toHaveLength(SF_SOURCE_OBJECTS.length)

    const byName = new Map(selections.map((s) => [s.objectApiName, s.isSelected]))
    expect(byName.get('Account')).toBe(true)
    expect(byName.get('Contact')).toBe(true)
    expect(byName.get('Lead')).toBe(true)
    expect(byName.get('Invoice__c')).toBe(true)
    expect(byName.get('ApexClass')).toBe(false) // not in commonBusinessObjects
  })

  it('is idempotent: calling twice does not duplicate rows', async () => {
    const conn = await seedConnection()
    const snapshot = await seedSnapshot(conn.id, 'SOURCE', SF_SOURCE_OBJECTS)

    await initDefaultSelection(conn.id, snapshot.id, COMMON_BUSINESS)
    await initDefaultSelection(conn.id, snapshot.id, COMMON_BUSINESS)

    const count = await prisma.objectSelection.count({
      where: { connectionId: conn.id, snapshotId: snapshot.id },
    })
    expect(count).toBe(SF_SOURCE_OBJECTS.length)
  })
})

describe('migrateSelection — integration', () => {
  it('copies selection state from old snapshot to new snapshot, drops orphans', async () => {
    const conn = await seedConnection()

    // Old snapshot with 3 objects, one of which (OldObject) will be orphaned
    const oldSnap = await seedSnapshot(conn.id, 'SOURCE', [
      { apiName: 'Account',   label: 'Account' },
      { apiName: 'Contact',   label: 'Contact' },
      { apiName: 'OldObject', label: 'Old Object' },
    ])

    // Seed old selections
    await prisma.objectSelection.createMany({
      data: [
        { connectionId: conn.id, snapshotId: oldSnap.id, objectApiName: 'Account',   isSelected: true  },
        { connectionId: conn.id, snapshotId: oldSnap.id, objectApiName: 'Contact',   isSelected: false },
        { connectionId: conn.id, snapshotId: oldSnap.id, objectApiName: 'OldObject', isSelected: true  },
      ],
    })

    // New snapshot: Account and Contact present, OldObject gone, NewObject added
    // Must set status=PREVIOUS on old snap first (unique constraint on connectionId+side+status)
    await prisma.schemaSnapshot.update({ where: { id: oldSnap.id }, data: { status: 'PREVIOUS' } })
    const newSnap = await seedSnapshot(conn.id, 'SOURCE', [
      { apiName: 'Account',   label: 'Account' },
      { apiName: 'Contact',   label: 'Contact' },
      { apiName: 'NewObject', label: 'New Object' },
    ])

    const result = await migrateSelection(conn.id, oldSnap.id, newSnap.id)

    expect(result.migrated).toBe(2)
    expect(result.orphans).toBe(1)

    const newSelections = await prisma.objectSelection.findMany({
      where: { connectionId: conn.id, snapshotId: newSnap.id },
    })
    const byName = new Map(newSelections.map((s) => [s.objectApiName, s.isSelected]))
    expect(byName.get('Account')).toBe(true)
    expect(byName.get('Contact')).toBe(false)
    expect(byName.has('OldObject')).toBe(false)
    // NewObject not in old snapshot — no row created by migrate
    expect(byName.has('NewObject')).toBe(false)
  })
})

describe('getObjectsWithSelection — integration', () => {
  it('auto-bootstraps and returns sorted objects with category', async () => {
    const conn = await seedConnection()
    const snapshot = await seedSnapshot(conn.id, 'SOURCE', SF_SOURCE_OBJECTS)

    const result = await getObjectsWithSelection(
      conn.id,
      snapshot.id,
      COMMON_BUSINESS,
      SYSTEM_PREFIXES,
    )

    expect(result.objects).toHaveLength(SF_SOURCE_OBJECTS.length)
    // Custom first
    expect(result.objects[0].category).toBe('custom')
    expect(result.objects[0].apiName).toBe('Invoice__c')
    // Summary
    expect(result.summary.custom).toBe(1)
    expect(result.summary.system).toBeGreaterThanOrEqual(1) // ApexClass
  })
})

describe('saveSelections — integration', () => {
  it('persists updated isSelected and returns correct summary', async () => {
    const conn = await seedConnection()
    const snapshot = await seedSnapshot(conn.id, 'SOURCE', [
      { apiName: 'Account', label: 'Account' },
      { apiName: 'Contact', label: 'Contact' },
    ])

    const plan = await prisma.migrationPlan.create({
      data: { name: 'Selection test plan', sourceConnectionId: conn.id },
    })
    planIds.push(plan.id)

    await initDefaultSelection(conn.id, snapshot.id, COMMON_BUSINESS)

    // Deselect Account
    const summary = await saveSelections(plan.id, conn.id, snapshot.id, [
      { objectApiName: 'Account', isSelected: false },
    ])

    expect(typeof summary.total).toBe('number')
    expect(summary.selected).toBeLessThan(summary.total)

    const row = await prisma.objectSelection.findUnique({
      where: { connectionId_snapshotId_objectApiName: { connectionId: conn.id, snapshotId: snapshot.id, objectApiName: 'Account' } },
    })
    expect(row!.isSelected).toBe(false)
  })
})
