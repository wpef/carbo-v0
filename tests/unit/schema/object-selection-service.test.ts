// 004-source-object-selection — Unit tests for object-selection-service
// Covers: initDefaultSelection, migrateSelection, categorise, sorting.
// Principle IV: realistic Salesforce object list throughout.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    schemaObject: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    objectSelection: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue({}),
}))

import { prisma } from '@/lib/prisma'
import { initDefaultSelection, migrateSelection } from '@/features/schema/services/object-selection-service'

// ---------------------------------------------------------------------------
// Fixtures — realistic Salesforce objects
// ---------------------------------------------------------------------------

const SNAP_ID = 'snap-sf-001'
const CONN_ID = 'conn-sf-001'

const SF_OBJECTS = [
  { id: 'obj-account', snapshotId: SNAP_ID, apiName: 'Account',    label: 'Account',        isCustom: false, description: null },
  { id: 'obj-contact', snapshotId: SNAP_ID, apiName: 'Contact',    label: 'Contact',        isCustom: false, description: null },
  { id: 'obj-lead',    snapshotId: SNAP_ID, apiName: 'Lead',       label: 'Lead',           isCustom: false, description: null },
  { id: 'obj-inv',     snapshotId: SNAP_ID, apiName: 'Invoice__c', label: 'Invoice',        isCustom: true,  description: null },
  { id: 'obj-apex',    snapshotId: SNAP_ID, apiName: 'ApexClass',  label: 'Apex Class',     isCustom: false, description: null },
]

const COMMON_BUSINESS = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign']
const SYSTEM_PREFIXES = ['Apex', 'Setup', 'Auth']

function mockFindManyObjects() { return vi.mocked(prisma.schemaObject.findMany) }
function mockFindManySelections() { return vi.mocked(prisma.objectSelection.findMany) }
function mockCountSelections() { return vi.mocked(prisma.objectSelection.count) }
function mockCreateMany() { return vi.mocked(prisma.objectSelection.createMany) }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initDefaultSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindManyObjects().mockResolvedValue(SF_OBJECTS as never)
    mockFindManySelections().mockResolvedValue([] as never) // no existing selections
    mockCountSelections().mockResolvedValue(5 as never) // after creation
    mockCreateMany().mockResolvedValue({ count: SF_OBJECTS.length } as never)
  })

  it('creates selections for all objects when none exist', async () => {
    await initDefaultSelection(CONN_ID, SNAP_ID, COMMON_BUSINESS, undefined)
    expect(mockCreateMany()).toHaveBeenCalledOnce()
    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    expect(data).toHaveLength(SF_OBJECTS.length)
  })

  it('pre-selects custom objects (Invoice__c)', async () => {
    await initDefaultSelection(CONN_ID, SNAP_ID, COMMON_BUSINESS, undefined)
    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    const invoice = data.find((d) => d.objectApiName === 'Invoice__c')
    expect(invoice!.isSelected).toBe(true)
  })

  it('pre-selects objects in commonBusinessObjects (Account, Contact, Lead)', async () => {
    await initDefaultSelection(CONN_ID, SNAP_ID, COMMON_BUSINESS, undefined)
    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    const account = data.find((d) => d.objectApiName === 'Account')
    const contact = data.find((d) => d.objectApiName === 'Contact')
    expect(account!.isSelected).toBe(true)
    expect(contact!.isSelected).toBe(true)
  })

  it('does NOT pre-select system objects like ApexClass', async () => {
    await initDefaultSelection(CONN_ID, SNAP_ID, COMMON_BUSINESS, undefined)
    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    const apex = data.find((d) => d.objectApiName === 'ApexClass')
    expect(apex!.isSelected).toBe(false)
  })

  it('is idempotent: skips objects that already have a selection row', async () => {
    // Simulate Account already has a selection
    mockFindManySelections().mockResolvedValue([
      { objectApiName: 'Account', isSelected: true },
    ] as never)

    await initDefaultSelection(CONN_ID, SNAP_ID, COMMON_BUSINESS, undefined)

    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    // Should not include Account again
    expect(data.find((d) => d.objectApiName === 'Account')).toBeUndefined()
  })
})

describe('migrateSelection', () => {
  const OLD_SNAP_ID = 'snap-sf-000'
  const NEW_SNAP_ID = 'snap-sf-001'

  const OLD_SELECTIONS = [
    { connectionId: CONN_ID, snapshotId: OLD_SNAP_ID, objectApiName: 'Account',    isSelected: true },
    { connectionId: CONN_ID, snapshotId: OLD_SNAP_ID, objectApiName: 'Contact',    isSelected: false },
    { connectionId: CONN_ID, snapshotId: OLD_SNAP_ID, objectApiName: 'OldObject',  isSelected: true }, // orphan
  ]

  const NEW_OBJECTS = [
    { apiName: 'Account', label: 'Account' },
    { apiName: 'Contact', label: 'Contact' },
    { apiName: 'NewObject', label: 'New Object' }, // not in old snapshot
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFindManySelections().mockResolvedValue(OLD_SELECTIONS as never)
    mockFindManyObjects().mockResolvedValue(NEW_OBJECTS as never)
    mockCreateMany().mockResolvedValue({ count: 2 } as never)
  })

  it('copies isSelected state for objects present in both snapshots', async () => {
    await migrateSelection(CONN_ID, OLD_SNAP_ID, NEW_SNAP_ID, undefined)

    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    const account = data.find((d) => d.objectApiName === 'Account')
    const contact = data.find((d) => d.objectApiName === 'Contact')
    expect(account!.isSelected).toBe(true)
    expect(contact!.isSelected).toBe(false)
  })

  it('drops orphan objects (OldObject not in new snapshot)', async () => {
    const { orphans } = await migrateSelection(CONN_ID, OLD_SNAP_ID, NEW_SNAP_ID, undefined)
    expect(orphans).toBe(1) // OldObject
    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    expect(data.find((d) => d.objectApiName === 'OldObject')).toBeUndefined()
  })

  it('returns migrated count matching objects present in both snapshots', async () => {
    const { migrated } = await migrateSelection(CONN_ID, OLD_SNAP_ID, NEW_SNAP_ID, undefined)
    expect(migrated).toBe(2) // Account + Contact
  })

  it('returns early when no old selections exist', async () => {
    mockFindManySelections().mockResolvedValue([] as never)
    const result = await migrateSelection(CONN_ID, OLD_SNAP_ID, NEW_SNAP_ID, undefined)
    expect(result).toEqual({ migrated: 0, orphans: 0 })
    expect(mockCreateMany()).not.toHaveBeenCalled()
  })
})
