// Unit tests for hubspot-records.ts
// fetch is stubbed; no real network calls.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  searchRecords,
  mapToConnectorRecords,
  calculateFieldStats,
  countRecords,
} from '../hubspot-records'

// Reset the global cursor store between tests
beforeEach(() => {
  globalThis.__hsCursorStore = undefined
})

const MOCK_TOKEN = 'test-token'
const MOCK_SCOPE = 'conn-001'
const MOCK_OBJECT = 'contacts'

function makeSearchResponse(total: number, count: number, nextAfter?: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      total,
      results: Array.from({ length: count }, (_, i) => ({
        id: `rec-${i + 1}`,
        properties: { firstname: `User ${i + 1}`, email: `user${i + 1}@test.com` },
      })),
      paging: nextAfter ? { next: { after: nextAfter } } : undefined,
    }),
  }
}

describe('searchRecords', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns paginated records for page 1', async () => {
    fetchMock.mockResolvedValueOnce(makeSearchResponse(50, 10, 'cursor-p2'))

    const result = await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, ['firstname'], 1, 10)

    expect(result.records).toHaveLength(10)
    expect(result.totalCount).toBe(50)
    expect(result.currentPage).toBe(1)
    expect(result.pageSize).toBe(10)
    expect(result.hasNextPage).toBe(true)
  })

  it('flattens { id, properties } into a flat record', async () => {
    fetchMock.mockResolvedValueOnce(makeSearchResponse(1, 1))

    const result = await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 10)
    const record = result.records[0]
    expect(record.id).toBe('rec-1')
    expect(record.firstname).toBe('User 1')
  })

  it('uses the stored cursor for page 2', async () => {
    // Page 1 — populates cursor store
    fetchMock.mockResolvedValueOnce(makeSearchResponse(20, 10, 'cursor-for-p2'))
    await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 10)

    // Page 2 — should use the cursor
    fetchMock.mockResolvedValueOnce(makeSearchResponse(20, 10))
    await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 2, 10)

    const [, p2Init] = fetchMock.mock.calls[1] as [string, RequestInit]
    const body = JSON.parse(p2Init.body as string)
    expect(body.after).toBe('cursor-for-p2')
  })

  it('caps pageSize at 100', async () => {
    fetchMock.mockResolvedValueOnce(makeSearchResponse(5, 5))
    await searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 9999)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.limit).toBe(100)
  })

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
    await expect(searchRecords(MOCK_TOKEN, MOCK_SCOPE, MOCK_OBJECT, [], 1, 10)).rejects.toThrow(
      'HubSpot search failed',
    )
  })
})

describe('mapToConnectorRecords', () => {
  it('merges id and properties into a flat object', () => {
    const results = [
      { id: 'r1', properties: { name: 'Alice', email: 'alice@test.com' } },
      { id: 'r2', properties: { name: 'Bob', email: 'bob@test.com' } },
    ]
    const records = mapToConnectorRecords(results)
    expect(records).toHaveLength(2)
    expect(records[0]).toEqual({ id: 'r1', name: 'Alice', email: 'alice@test.com' })
    expect(records[1]).toEqual({ id: 'r2', name: 'Bob', email: 'bob@test.com' })
  })

  it('handles empty results', () => {
    expect(mapToConnectorRecords([])).toEqual([])
  })
})

describe('calculateFieldStats', () => {
  const records = [
    { firstname: 'Alice', email: 'alice@test.com' },
    { firstname: 'Bob', email: null },
    { firstname: 'Alice', email: 'charlie@test.com' },
    { firstname: null, email: '' },
    { firstname: 'Diana', email: 'diana@test.com' },
  ]

  it('counts null/empty/undefined values correctly', () => {
    const stats = calculateFieldStats(records, 'firstname')
    // null is 1 occurrence
    expect(stats.nullCount).toBe(1)
  })

  it('counts distinct non-null values', () => {
    const stats = calculateFieldStats(records, 'firstname')
    // Alice, Bob, Diana = 3 distinct
    expect(stats.distinctCount).toBe(3)
  })

  it('returns up to 5 sample values', () => {
    const bigRecords = Array.from({ length: 20 }, (_, i) => ({ field: `val-${i}` }))
    const stats = calculateFieldStats(bigRecords, 'field')
    expect(stats.sampleValues.length).toBeLessThanOrEqual(5)
  })

  it('counts null and empty string as null', () => {
    const stats = calculateFieldStats(records, 'email')
    // null and '' both count
    expect(stats.nullCount).toBe(2)
  })
})

describe('countRecords', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the total from a limit=1 search', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ total: 1234, results: [{ id: 'r1', properties: {} }] }),
    })

    const count = await countRecords(MOCK_TOKEN, MOCK_OBJECT)
    expect(count).toBe(1234)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.limit).toBe(1)
  })
})
