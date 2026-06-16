// 005-source-field-retrieval — Unit tests for field-retrieval-service.ts
// Covers Cluster 5: isAccessible persistence and picklistValues JSON serialisation.
// Principle IV: realistic Salesforce/HubSpot field shapes throughout.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — use inline factories to avoid hoisting issues
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    schemaObject: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    objectField: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/adapters/registry', () => ({
  getAdapter: vi.fn(),
}))

import { getAdapter } from '@/lib/adapters/registry'
import { prisma } from '@/lib/prisma'
import { retrieveFieldsForObjects } from '@/features/schema/services/field-retrieval-service'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SNAPSHOT_ID   = 'snap-sf-001'
const OBJECT_ID     = 'obj-account-001'
const CONNECTION_ID = 'conn-sf-001'

const STORED_SCHEMA_OBJECT = { id: OBJECT_ID, apiName: 'Account', snapshotId: SNAPSHOT_ID }

// Realistic Salesforce Account fields as returned by adapter
const SF_ACCOUNT_FIELDS = [
  {
    apiName: 'Name',
    label: 'Account Name',
    dataType: 'string',
    isRequired: true,
    isReadOnly: false,
    isUnique: false,
    // No isAccessible / picklistValues — standard field
  },
  {
    apiName: 'Industry',
    label: 'Industry',
    dataType: 'picklist',
    isRequired: false,
    isReadOnly: false,
    isUnique: false,
    picklistValues: ['Agriculture', 'Technology', 'Finance', 'Healthcare', 'Energy'],
  },
  {
    apiName: 'AnnualRevenue',
    label: 'Annual Revenue',
    dataType: 'currency',
    isRequired: false,
    isReadOnly: false,
    isUnique: false,
  },
  {
    apiName: 'SystemModstamp',
    label: 'System Modstamp',
    dataType: 'datetime',
    isRequired: true,
    isReadOnly: true,
    isUnique: false,
    isAccessible: false, // field not accessible to this user
  },
]

// Convenience accessors for the mocked Prisma fns
function mockFindUnique() { return vi.mocked(prisma.schemaObject.findUnique) }
function mockDeleteMany()  { return vi.mocked(prisma.objectField.deleteMany)  }
function mockCreateMany()  { return vi.mocked(prisma.objectField.createMany)  }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('retrieveFieldsForObjects — Cluster 5: isAccessible + picklistValues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique().mockResolvedValue(STORED_SCHEMA_OBJECT as never)
    mockDeleteMany().mockResolvedValue({ count: 0 } as never)
    mockCreateMany().mockResolvedValue({ count: SF_ACCOUNT_FIELDS.length } as never)
  })

  it('persists isAccessible=false when adapter returns isAccessible:false on a field', async () => {
    const mockAdapter = { getFields: vi.fn().mockResolvedValue(SF_ACCOUNT_FIELDS) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await retrieveFieldsForObjects('plan-001', CONNECTION_ID, 'salesforce', SNAPSHOT_ID, ['Account'])

    expect(mockCreateMany()).toHaveBeenCalledOnce()
    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }

    const systemField = data.find((f) => f.apiName === 'SystemModstamp')
    expect(systemField).toBeDefined()
    expect(systemField!.isAccessible).toBe(false)
  })

  it('defaults isAccessible=true when adapter does not return the property (pre-existing adapters)', async () => {
    const mockAdapter = { getFields: vi.fn().mockResolvedValue(SF_ACCOUNT_FIELDS) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await retrieveFieldsForObjects('plan-001', CONNECTION_ID, 'salesforce', SNAPSHOT_ID, ['Account'])

    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }

    const nameField = data.find((f) => f.apiName === 'Name')
    expect(nameField!.isAccessible).toBe(true)

    const industryField = data.find((f) => f.apiName === 'Industry')
    expect(industryField!.isAccessible).toBe(true)
  })

  it('serialises picklistValues as JSON string when adapter returns them', async () => {
    const mockAdapter = { getFields: vi.fn().mockResolvedValue(SF_ACCOUNT_FIELDS) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await retrieveFieldsForObjects('plan-001', CONNECTION_ID, 'salesforce', SNAPSHOT_ID, ['Account'])

    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }

    const industryField = data.find((f) => f.apiName === 'Industry')
    expect(industryField).toBeDefined()
    expect(typeof industryField!.picklistValues).toBe('string')
    const parsed = JSON.parse(industryField!.picklistValues as string) as string[]
    expect(parsed).toEqual(['Agriculture', 'Technology', 'Finance', 'Healthcare', 'Energy'])
  })

  it('stores picklistValues=null when field has no picklist metadata', async () => {
    const mockAdapter = { getFields: vi.fn().mockResolvedValue(SF_ACCOUNT_FIELDS) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await retrieveFieldsForObjects('plan-001', CONNECTION_ID, 'salesforce', SNAPSHOT_ID, ['Account'])

    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    const revenueField = data.find((f) => f.apiName === 'AnnualRevenue')
    expect(revenueField!.picklistValues).toBeNull()
  })

  it('handles HubSpot enumeration fields with string[] picklistValues', async () => {
    mockFindUnique().mockResolvedValue({ id: 'obj-contacts-001', apiName: 'contacts', snapshotId: SNAPSHOT_ID } as never)

    const hubspotContactFields = [
      {
        apiName: 'lifecyclestage',
        label: 'Lifecycle Stage',
        dataType: 'enumeration',
        isRequired: false,
        isReadOnly: false,
        isUnique: false,
        picklistValues: ['subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'customer', 'evangelist', 'other'],
      },
    ]
    const mockAdapter = { getFields: vi.fn().mockResolvedValue(hubspotContactFields) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await retrieveFieldsForObjects('plan-001', 'conn-hs-001', 'hubspot', SNAPSHOT_ID, ['contacts'])

    const { data } = mockCreateMany().mock.calls[0][0] as { data: Record<string, unknown>[] }
    const stageField = data.find((f) => f.apiName === 'lifecyclestage')

    expect(typeof stageField!.picklistValues).toBe('string')
    const parsed = JSON.parse(stageField!.picklistValues as string) as string[]
    expect(parsed).toContain('salesqualifiedlead')
    expect(parsed).toHaveLength(8)
  })

  it('returns a result with correct fieldCount when retrieval succeeds', async () => {
    const mockAdapter = { getFields: vi.fn().mockResolvedValue(SF_ACCOUNT_FIELDS) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const results = await retrieveFieldsForObjects('plan-001', CONNECTION_ID, 'salesforce', SNAPSHOT_ID, ['Account'])

    expect(results).toHaveLength(1)
    expect(results[0].objectApiName).toBe('Account')
    expect(results[0].fieldCount).toBe(SF_ACCOUNT_FIELDS.length)
    expect(results[0].error).toBeUndefined()
  })

  it('records an error per object without aborting the batch when getFields throws', async () => {
    mockFindUnique()
      .mockResolvedValueOnce({ id: 'obj-account-001', apiName: 'Account', snapshotId: SNAPSHOT_ID } as never)
      .mockResolvedValueOnce({ id: 'obj-contact-001', apiName: 'Contact', snapshotId: SNAPSHOT_ID } as never)

    const mockAdapter = {
      getFields: vi.fn()
        .mockResolvedValueOnce(SF_ACCOUNT_FIELDS)
        .mockRejectedValueOnce(new Error('INSUFFICIENT_ACCESS')),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const results = await retrieveFieldsForObjects('plan-001', CONNECTION_ID, 'salesforce', SNAPSHOT_ID, ['Account', 'Contact'])

    expect(results).toHaveLength(2)
    const accountResult = results.find((r) => r.objectApiName === 'Account')
    const contactResult = results.find((r) => r.objectApiName === 'Contact')

    expect(accountResult!.fieldCount).toBe(SF_ACCOUNT_FIELDS.length)
    expect(accountResult!.error).toBeUndefined()

    expect(contactResult!.fieldCount).toBe(0)
    expect(contactResult!.error).toContain('INSUFFICIENT_ACCESS')
  })

  it('clears existing fields (deleteMany) before createMany — no stale data', async () => {
    const mockAdapter = { getFields: vi.fn().mockResolvedValue(SF_ACCOUNT_FIELDS) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await retrieveFieldsForObjects('plan-001', CONNECTION_ID, 'salesforce', SNAPSHOT_ID, ['Account'])

    const deleteManyOrder = mockDeleteMany().mock.invocationCallOrder[0]
    const createManyOrder = mockCreateMany().mock.invocationCallOrder[0]
    expect(deleteManyOrder).toBeLessThan(createManyOrder)
  })
})
