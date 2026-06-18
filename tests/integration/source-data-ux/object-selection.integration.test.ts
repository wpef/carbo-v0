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
import { getAdapterMetadata } from '@/lib/adapters/metadata'

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

// Regression guard for the recette bug found on a real 1123-object SF org:
// (1) common business objects (Contact/Opportunity/…) were classified but NOT pre-selected,
// (2) internal objects identified by SUFFIX (…Feed/…History/…Share) were shown as business.
// This exercises the LIVE adapter metadata end-to-end so the two can't silently regress.
describe('getObjectsWithSelection — real SF metadata (recette regression guard)', () => {
  it('hides suffix-system objects and pre-selects every common + custom object', async () => {
    const conn = await seedConnection()
    const snapshot = await seedSnapshot(conn.id, 'SOURCE', [
      { apiName: 'Account', label: 'Account', isCustom: false },
      { apiName: 'Contact', label: 'Contact', isCustom: false },
      { apiName: 'Opportunity', label: 'Opportunity', isCustom: false },
      { apiName: 'Case', label: 'Case', isCustom: false },
      { apiName: 'AccountFeed', label: 'Account Feed', isCustom: false },
      { apiName: 'ContactHistory', label: 'Contact History', isCustom: false },
      { apiName: 'AccountShare', label: 'Account Share', isCustom: false },
      { apiName: 'Widget__c', label: 'Widget', isCustom: true },
    ])

    const meta = getAdapterMetadata('salesforce')
    const result = await getObjectsWithSelection(
      conn.id,
      snapshot.id,
      meta.commonBusinessObjects,
      meta.systemObjectPrefixes,
      meta.systemObjectSuffixes,
    )
    const byName = new Map(result.objects.map((o) => [o.apiName, o]))

    // Suffix-identified internals are classified system (the bug: they showed as business).
    for (const name of ['AccountFeed', 'ContactHistory', 'AccountShare']) {
      expect(byName.get(name)!.category).toBe('system')
      expect(byName.get(name)!.isSelected).toBe(false)
    }
    // Every common business object is pre-selected (the bug: Contact/Opportunity/Case were not).
    for (const name of ['Account', 'Contact', 'Opportunity', 'Case']) {
      expect(byName.get(name)!.category).toBe('business')
      expect(byName.get(name)!.isSelected).toBe(true)
    }
    // Custom objects pre-selected.
    expect(byName.get('Widget__c')!.isSelected).toBe(true)
    expect(result.summary.system).toBe(3)
  })
})
