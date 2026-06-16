// 009-record-preview — Unit tests for record-preview-service
// Covers: binary sanitisation, audit logging, error propagation.
// Principle IV: realistic CRM record shapes throughout.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    migrationPlan: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/adapters/registry', () => ({
  getAdapter: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'
import {
  fetchRecordPage,
  RecordPreviewPlanNotFoundError,
  RecordPreviewConnectionNotFoundError,
  RecordPreviewConnectionNotConnectedError,
} from '@/features/schema/services/record-preview-service'

// ---------------------------------------------------------------------------
// Fixtures — realistic Salesforce Contact records
// ---------------------------------------------------------------------------

const PLAN_ID = 'plan-001'
const CONN_ID = 'conn-sf-001'

const MOCK_PLAN = {
  id: PLAN_ID,
  sourceConnection: { id: CONN_ID, adapterType: 'salesforce', status: 'CONNECTED' },
  destinationConnection: null,
}

const SF_CONTACT_RECORDS = [
  { Id: 'CON-0001', FirstName: 'Alice', LastName: 'Smith', Email: 'alice@example.com', Phone: '+1-555-1001', AccountId: 'ACC-0001', CreatedDate: '2024-01-01T00:00:00Z' },
  { Id: 'CON-0002', FirstName: 'Bob',   LastName: 'Jones', Email: 'bob@example.com',   Phone: null,          AccountId: 'ACC-0002', CreatedDate: '2024-01-02T00:00:00Z' },
  { Id: 'CON-0003', FirstName: 'Carol', LastName: 'Davis', Email: 'carol@example.com', Phone: '+1-555-1003', AccountId: 'ACC-0001', CreatedDate: '2024-01-03T00:00:00Z' },
]

const PAGINATED_RESPONSE = {
  records: SF_CONTACT_RECORDS,
  totalCount: 150,
  pageSize: 50,
  currentPage: 1,
  hasNextPage: true,
}

function mockFindUnique() { return vi.mocked(prisma.migrationPlan.findUnique) }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchRecordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique().mockResolvedValue(MOCK_PLAN as never)
  })

  it('returns paginated records from the adapter', async () => {
    const mockAdapter = { getRecords: vi.fn().mockResolvedValue(PAGINATED_RESPONSE) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const result = await fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)
    expect(result.records).toHaveLength(3)
    expect(result.totalCount).toBe(150)
    expect(result.hasNextPage).toBe(true)
  })

  it('calls getAdapter with the connection adapterType (salesforce)', async () => {
    const mockAdapter = { getRecords: vi.fn().mockResolvedValue(PAGINATED_RESPONSE) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)
    expect(vi.mocked(getAdapter)).toHaveBeenCalledWith('salesforce')
  })

  it('replaces Buffer values with "[binary data]" placeholder', async () => {
    const recordsWithBinary = [
      { ...SF_CONTACT_RECORDS[0], Photo: Buffer.from('binary-data') },
    ]
    const mockAdapter = {
      getRecords: vi.fn().mockResolvedValue({ ...PAGINATED_RESPONSE, records: recordsWithBinary }),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const result = await fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)
    expect((result.records[0] as Record<string, unknown>).Photo).toBe('[binary data]')
  })

  it('replaces Uint8Array values with "[binary data]" placeholder', async () => {
    const recordsWithUint8 = [
      { ...SF_CONTACT_RECORDS[0], Thumbnail: new Uint8Array([1, 2, 3]) },
    ]
    const mockAdapter = {
      getRecords: vi.fn().mockResolvedValue({ ...PAGINATED_RESPONSE, records: recordsWithUint8 }),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const result = await fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)
    expect((result.records[0] as Record<string, unknown>).Thumbnail).toBe('[binary data]')
  })

  it('logs RECORDS_PREVIEWED audit event after successful fetch', async () => {
    const mockAdapter = { getRecords: vi.fn().mockResolvedValue(PAGINATED_RESPONSE) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 2, 50)

    expect(vi.mocked(logAuditEvent)).toHaveBeenCalledOnce()
    const [call] = vi.mocked(logAuditEvent).mock.calls
    expect(call[0].action).toBe('RECORDS_PREVIEWED')
    expect(call[0].planId).toBe(PLAN_ID)
    expect(call[0].details?.objectApiName).toBe('Contact')
    expect(call[0].details?.page).toBe(2)
  })

  it('throws RecordPreviewPlanNotFoundError when plan does not exist', async () => {
    mockFindUnique().mockResolvedValue(null as never)
    await expect(fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)).rejects.toBeInstanceOf(
      RecordPreviewPlanNotFoundError,
    )
  })

  it('throws RecordPreviewConnectionNotFoundError when no source connection', async () => {
    mockFindUnique().mockResolvedValue({ ...MOCK_PLAN, sourceConnection: null } as never)
    await expect(fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)).rejects.toBeInstanceOf(
      RecordPreviewConnectionNotFoundError,
    )
  })

  it('throws RecordPreviewConnectionNotConnectedError when connection is EXPIRED', async () => {
    mockFindUnique().mockResolvedValue({
      ...MOCK_PLAN,
      sourceConnection: { ...MOCK_PLAN.sourceConnection, status: 'EXPIRED' },
    } as never)
    await expect(fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)).rejects.toBeInstanceOf(
      RecordPreviewConnectionNotConnectedError,
    )
  })

  it('passes page and pageSize to the adapter correctly', async () => {
    const mockAdapter = { getRecords: vi.fn().mockResolvedValue(PAGINATED_RESPONSE) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await fetchRecordPage(PLAN_ID, 'SOURCE', 'Account', 3, 25)
    expect(mockAdapter.getRecords).toHaveBeenCalledWith(CONN_ID, 'Account', 3, 25)
  })

  it('preserves non-binary field values unchanged', async () => {
    const mockAdapter = { getRecords: vi.fn().mockResolvedValue(PAGINATED_RESPONSE) }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const result = await fetchRecordPage(PLAN_ID, 'SOURCE', 'Contact', 1, 50)
    expect((result.records[0] as Record<string, unknown>).FirstName).toBe('Alice')
    expect((result.records[1] as Record<string, unknown>).Phone).toBeNull()
  })
})
