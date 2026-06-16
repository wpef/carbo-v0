// Unit tests for hubspot-schema.ts
// fetch is stubbed; no real network calls.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getStandardObjects,
  getCustomObjects,
  getProperties,
  normaliseType,
} from '../hubspot-schema'

const MOCK_TOKEN = 'test-token'

describe('getStandardObjects', () => {
  it('returns the five built-in objects', () => {
    const objects = getStandardObjects()
    expect(objects).toHaveLength(5)
    const apiNames = objects.map((o) => o.apiName)
    expect(apiNames).toContain('contacts')
    expect(apiNames).toContain('companies')
    expect(apiNames).toContain('deals')
    expect(apiNames).toContain('tickets')
    expect(apiNames).toContain('line_items')
  })

  it('marks all standard objects as isCustom=false', () => {
    const objects = getStandardObjects()
    expect(objects.every((o) => o.isCustom === false)).toBe(true)
  })

  it('pre-selects all standard objects', () => {
    const objects = getStandardObjects()
    expect(objects.every((o) => o.isSelected === true)).toBe(true)
  })
})

describe('getCustomObjects', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty array on 403 (non-Enterprise portal)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' })
    const result = await getCustomObjects(MOCK_TOKEN)
    expect(result).toEqual([])
  })

  it('returns empty array on 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
    const result = await getCustomObjects(MOCK_TOKEN)
    expect(result).toEqual([])
  })

  it('maps custom object results to ConnectorObject', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: 'my_custom_object',
            labels: { singular: 'My Object', plural: 'My Objects' },
            objectTypeId: '0-99',
            archived: false,
          },
        ],
      }),
    })

    const result = await getCustomObjects(MOCK_TOKEN)
    expect(result).toHaveLength(1)
    expect(result[0].apiName).toBe('my_custom_object')
    expect(result[0].label).toBe('My Objects')
    expect(result[0].isCustom).toBe(true)
    expect(result[0].isSelected).toBe(true)
  })

  it('excludes archived custom objects', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: 'active_object',
            labels: { singular: 'Active', plural: 'Actives' },
            objectTypeId: '0-1',
            archived: false,
          },
          {
            name: 'archived_object',
            labels: { singular: 'Archived', plural: 'Archiveds' },
            objectTypeId: '0-2',
            archived: true,
          },
        ],
      }),
    })

    const result = await getCustomObjects(MOCK_TOKEN)
    expect(result).toHaveLength(1)
    expect(result[0].apiName).toBe('active_object')
  })

  it('throws on non-403/404 errors', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
    await expect(getCustomObjects(MOCK_TOKEN)).rejects.toThrow('HubSpot schemas API failed')
  })
})

describe('getProperties', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps HubSpot properties to ConnectorField', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: 'firstname',
            label: 'First Name',
            type: 'string',
            modificationMetadata: { readOnlyValue: false },
            hasUniqueValue: false,
          },
          {
            name: 'email',
            label: 'Email',
            type: 'string',
            modificationMetadata: { readOnlyValue: false },
            hasUniqueValue: true,
          },
          {
            name: 'hs_object_id',
            label: 'Record ID',
            type: 'number',
            modificationMetadata: { readOnlyValue: true },
            hasUniqueValue: true,
          },
        ],
      }),
    })

    const fields = await getProperties(MOCK_TOKEN, 'contacts')
    expect(fields).toHaveLength(3)

    const email = fields.find((f) => f.apiName === 'email')
    expect(email?.isUnique).toBe(true)
    expect(email?.dataType).toBe('string')

    const id = fields.find((f) => f.apiName === 'hs_object_id')
    expect(id?.isReadOnly).toBe(true)
    expect(id?.dataType).toBe('decimal') // number -> decimal
  })

  it('maps enumeration type with picklistValues', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            name: 'hs_lead_status',
            label: 'Lead Status',
            type: 'enumeration',
            options: [
              { label: 'New', value: 'NEW' },
              { label: 'Open', value: 'OPEN' },
              { label: 'In Progress', value: 'IN_PROGRESS' },
            ],
          },
        ],
      }),
    })

    const fields = await getProperties(MOCK_TOKEN, 'contacts')
    const status = fields[0]
    expect(status.dataType).toBe('picklist') // enumeration -> picklist
    expect(status.picklistValues).toEqual(['NEW', 'OPEN', 'IN_PROGRESS'])
  })

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
    await expect(getProperties(MOCK_TOKEN, 'unknown_object')).rejects.toThrow(
      'HubSpot properties fetch failed',
    )
  })
})

describe('normaliseType', () => {
  it.each([
    ['string', 'string'],
    ['number', 'decimal'],
    ['date', 'date'],
    ['datetime', 'datetime'],
    ['enumeration', 'picklist'],
    ['bool', 'boolean'],
    ['phone_number', 'phone'],
    ['calculation_equation', 'calculation_equation'], // pass-through
  ])('maps %s -> %s', (hsType, expected) => {
    expect(normaliseType(hsType)).toBe(expected)
  })
})
