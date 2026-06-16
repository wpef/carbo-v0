// Unit tests for hubspot-schema-write.ts
// fetch is stubbed; no real network calls.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createProperty,
  createCustomObject,
  modifyProperty,
  PropertyAlreadyExistsError,
  InvalidPropertyTypeError,
  EnterpriseRequiredError,
} from '../hubspot-schema-write'

const MOCK_TOKEN = 'test-token'

// ---------------------------------------------------------------------------
// Helpers — mock fetch for getProperties (called internally by createProperty)
// and the actual POST
// ---------------------------------------------------------------------------

function makePropertiesResponse(names: string[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: names.map((name) => ({
        name,
        label: name,
        type: 'string',
      })),
    }),
  }
}

function makeCreatedPropertyResponse(name: string, type: string) {
  return {
    ok: true,
    status: 201,
    json: async () => ({
      name,
      label: name,
      type,
      groupName: 'contactinformation',
    }),
  }
}

describe('createProperty', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a string property on an existing object', async () => {
    // First call: GET existing properties (uniqueness check)
    fetchMock.mockResolvedValueOnce(makePropertiesResponse(['firstname', 'lastname']))
    // Second call: POST to create
    fetchMock.mockResolvedValueOnce(makeCreatedPropertyResponse('migration_source_id', 'string'))

    const field = await createProperty(MOCK_TOKEN, 'contacts', {
      name: 'migration_source_id',
      label: 'Migration Source ID',
      type: 'string',
      fieldType: 'text',
    })

    expect(field.apiName).toBe('migration_source_id')
    expect(field.isReadOnly).toBe(false)
  })

  it('throws PropertyAlreadyExistsError when name conflicts', async () => {
    fetchMock.mockResolvedValueOnce(makePropertiesResponse(['migration_source_id', 'firstname']))

    await expect(
      createProperty(MOCK_TOKEN, 'contacts', {
        name: 'migration_source_id',
        label: 'Migration Source ID',
        type: 'string',
        fieldType: 'text',
      }),
    ).rejects.toThrow(PropertyAlreadyExistsError)
  })

  it('throws InvalidPropertyTypeError for unsupported type', async () => {
    await expect(
      createProperty(MOCK_TOKEN, 'contacts', {
        name: 'test_field',
        label: 'Test Field',
        type: 'rich_text' as never,
        fieldType: 'rich_text',
      }),
    ).rejects.toThrow(InvalidPropertyTypeError)
  })

  it('throws InvalidPropertyTypeError when enumeration has no options', async () => {
    fetchMock.mockResolvedValueOnce(makePropertiesResponse([]))

    await expect(
      createProperty(MOCK_TOKEN, 'contacts', {
        name: 'status_field',
        label: 'Status',
        type: 'enumeration',
        fieldType: 'select',
        options: [], // empty
      }),
    ).rejects.toThrow(InvalidPropertyTypeError)
  })

  it('sends options in body for enumeration type', async () => {
    fetchMock.mockResolvedValueOnce(makePropertiesResponse([]))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        name: 'status',
        label: 'Status',
        type: 'enumeration',
        options: [{ label: 'Active', value: 'ACTIVE' }],
      }),
    })

    await createProperty(MOCK_TOKEN, 'contacts', {
      name: 'status',
      label: 'Status',
      type: 'enumeration',
      fieldType: 'select',
      options: [{ label: 'Active', value: 'ACTIVE' }],
    })

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.options).toBeDefined()
    expect(body.options[0].value).toBe('ACTIVE')
  })

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce(makePropertiesResponse([]))
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ message: 'Invalid property definition' }),
    })

    await expect(
      createProperty(MOCK_TOKEN, 'contacts', {
        name: 'bad_field',
        label: 'Bad Field',
        type: 'string',
        fieldType: 'text',
      }),
    ).rejects.toThrow('HubSpot property create failed')
  })
})

describe('createCustomObject', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a custom object and returns ConnectorObject', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        name: 'car',
        labels: { singular: 'Car', plural: 'Cars' },
        objectTypeId: '2-123456',
      }),
    })

    const obj = await createCustomObject(MOCK_TOKEN, {
      name: 'car',
      labels: { singular: 'Car', plural: 'Cars' },
      primaryDisplayProperty: 'name',
      properties: [{ name: 'name', label: 'Name', type: 'string', fieldType: 'text' }],
    })

    expect(obj.apiName).toBe('car')
    expect(obj.label).toBe('Cars')
    expect(obj.isCustom).toBe(true)
  })

  it('throws EnterpriseRequiredError on 403', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' })

    await expect(
      createCustomObject(MOCK_TOKEN, {
        name: 'custom_obj',
        labels: { singular: 'Custom', plural: 'Customs' },
        primaryDisplayProperty: 'name',
        properties: [{ name: 'name', label: 'Name', type: 'string', fieldType: 'text' }],
      }),
    ).rejects.toThrow(EnterpriseRequiredError)
  })

  it('throws InvalidPropertyTypeError for embedded bad property type', async () => {
    await expect(
      createCustomObject(MOCK_TOKEN, {
        name: 'obj',
        labels: { singular: 'Obj', plural: 'Objs' },
        primaryDisplayProperty: 'name',
        properties: [
          { name: 'name', label: 'Name', type: 'score' as never, fieldType: 'text' },
        ],
      }),
    ).rejects.toThrow(InvalidPropertyTypeError)
  })

  it('throws on non-403 API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'Something went wrong' }),
    })

    await expect(
      createCustomObject(MOCK_TOKEN, {
        name: 'obj',
        labels: { singular: 'Obj', plural: 'Objs' },
        primaryDisplayProperty: 'name',
        properties: [{ name: 'name', label: 'Name', type: 'string', fieldType: 'text' }],
      }),
    ).rejects.toThrow('HubSpot custom object create failed')
  })
})

describe('modifyProperty', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a PATCH request with updated label', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'firstname',
        label: 'First Name Updated',
        type: 'string',
      }),
    })

    const result = await modifyProperty(MOCK_TOKEN, 'contacts', 'firstname', {
      label: 'First Name Updated',
    })

    expect(result.label).toBe('First Name Updated')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body as string)
    expect(body.label).toBe('First Name Updated')
  })

  it('maps picklistValues to HubSpot options in the PATCH body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        name: 'status',
        label: 'Status',
        type: 'enumeration',
        options: [
          { label: 'Active', value: 'ACTIVE' },
          { label: 'Inactive', value: 'INACTIVE' },
        ],
      }),
    })

    await modifyProperty(MOCK_TOKEN, 'contacts', 'status', {
      picklistValues: ['ACTIVE', 'INACTIVE'],
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.options).toHaveLength(2)
    expect(body.options[0].value).toBe('ACTIVE')
  })

  it('throws on API error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Property not found' }),
    })

    await expect(
      modifyProperty(MOCK_TOKEN, 'contacts', 'nonexistent', { label: 'New Label' }),
    ).rejects.toThrow('HubSpot property modify failed')
  })
})
