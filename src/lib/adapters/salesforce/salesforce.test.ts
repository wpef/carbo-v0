// Unit tests for the Salesforce adapter (v4)
// Network calls are fully mocked — no real Salesforce creds required.
// Ref: specs/adapters/salesforce/

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist mock functions so they are available when vi.mock factories run ────

const { mockQuery, mockDescribeGlobal, mockDescribe, mockFindUnique, mockUpdate, mockCreate, mockFetch } =
  vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockDescribeGlobal: vi.fn(),
    mockDescribe: vi.fn(),
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
    mockCreate: vi.fn(),
    mockFetch: vi.fn(),
  }))

// ─── Mock jsforce ─────────────────────────────────────────────────────────────

vi.mock('jsforce', () => {
  class MockConnection {
    query = mockQuery
    describeGlobal = mockDescribeGlobal
    describe = mockDescribe
  }
  return {
    default: {
      Connection: MockConnection,
    },
  }
})

// ─── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connectorConnection: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      create: mockCreate,
    },
  },
}))

// ─── Mock audit ───────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

// ─── Mock global fetch ────────────────────────────────────────────────────────

vi.stubGlobal('fetch', mockFetch)

// ─── Now import the modules under test ───────────────────────────────────────

import {
  buildAuthorizationUrl,
  generatePkceChallenge,
  exchangeCodeForTokens,
  refreshAccessToken,
  storePkceVerifier,
  takePkceVerifier,
  computeExpiresAt,
  MissingSalesforceEnvError,
  SalesforceAuthError,
  loadSalesforceConfig,
} from './salesforce-auth'
import {
  mapDescribeGlobalToSchema,
  mapDescribeToFields,
  normaliseType,
} from './salesforce-schema'
import {
  buildSoqlQuery,
  buildCountQuery,
  executeQuery,
  calculateFieldStats,
  safeIdent,
} from './salesforce-records'
import {
  isSystemObject,
  isDefaultSelected,
} from './salesforce-constants'
import { salesforceAdapter } from './salesforce-adapter'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CONFIG = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  callbackUrl: 'https://example.com/callback',
  loginUrl: 'https://login.salesforce.com',
}

const VALID_SF_CONN_CONFIG = {
  instanceUrl: 'https://na1.salesforce.com',
  accessToken: 'ACCESS_TOKEN',
  refreshToken: 'REFRESH_TOKEN',
  tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h from now
  orgName: 'ACME Org',
  userId: 'USER_001',
}

function makeFetchOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response)
}

function makeFetchError(status: number, body: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  } as Response)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. salesforce-auth.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('salesforce-auth', () => {
  describe('loadSalesforceConfig', () => {
    it('throws MissingSalesforceEnvError when env vars are absent', () => {
      const saved = { ...process.env }
      delete process.env.SALESFORCE_CLIENT_ID
      delete process.env.SALESFORCE_CLIENT_SECRET
      delete process.env.SALESFORCE_CALLBACK_URL
      expect(() => loadSalesforceConfig()).toThrow(MissingSalesforceEnvError)
      Object.assign(process.env, saved)
    })

    it('returns config when all env vars are set', () => {
      process.env.SALESFORCE_CLIENT_ID = 'CID'
      process.env.SALESFORCE_CLIENT_SECRET = 'CSEC'
      process.env.SALESFORCE_CALLBACK_URL = 'https://cb.example.com'
      process.env.SALESFORCE_LOGIN_URL = 'https://test.salesforce.com'
      const cfg = loadSalesforceConfig()
      expect(cfg.clientId).toBe('CID')
      expect(cfg.loginUrl).toBe('https://test.salesforce.com')
      delete process.env.SALESFORCE_CLIENT_ID
      delete process.env.SALESFORCE_CLIENT_SECRET
      delete process.env.SALESFORCE_CALLBACK_URL
      delete process.env.SALESFORCE_LOGIN_URL
    })
  })

  describe('generatePkceChallenge', () => {
    it('produces distinct verifier and challenge', () => {
      const { verifier, challenge } = generatePkceChallenge()
      expect(verifier).not.toBe(challenge)
      expect(verifier.length).toBeGreaterThanOrEqual(43)
    })

    it('challenge is base64url (no + / =)', () => {
      const { challenge } = generatePkceChallenge()
      expect(challenge).not.toMatch(/[+/=]/)
    })

    it('two calls produce independent pairs', () => {
      const a = generatePkceChallenge()
      const b = generatePkceChallenge()
      expect(a.verifier).not.toBe(b.verifier)
      expect(a.challenge).not.toBe(b.challenge)
    })
  })

  describe('storePkceVerifier / takePkceVerifier', () => {
    beforeEach(() => {
      // Reset the global store between tests
      globalThis.__sfPkceStore = undefined
    })

    it('returns the verifier after storing it', () => {
      storePkceVerifier('state-abc', 'verifier-xyz')
      expect(takePkceVerifier('state-abc')).toBe('verifier-xyz')
    })

    it('is single-use: second take returns undefined', () => {
      storePkceVerifier('state-def', 'verifier-v2')
      takePkceVerifier('state-def')
      expect(takePkceVerifier('state-def')).toBeUndefined()
    })

    it('returns undefined for unknown state', () => {
      expect(takePkceVerifier('no-such-state')).toBeUndefined()
    })
  })

  describe('buildAuthorizationUrl', () => {
    it('includes required OAuth2 + PKCE parameters', () => {
      const url = buildAuthorizationUrl(VALID_CONFIG, 'test-state', 'test-challenge')
      expect(url).toContain('/services/oauth2/authorize')
      expect(url).toContain('response_type=code')
      expect(url).toContain('code_challenge=test-challenge')
      expect(url).toContain('code_challenge_method=S256')
      expect(url).toContain('state=test-state')
      expect(url).toContain(`client_id=${encodeURIComponent(VALID_CONFIG.clientId)}`)
    })

    it('uses the loginUrl as base', () => {
      const url = buildAuthorizationUrl(VALID_CONFIG, 's', 'c')
      expect(url.startsWith(VALID_CONFIG.loginUrl)).toBe(true)
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('returns token response on success', async () => {
      const tokenResponse = {
        access_token: 'AT',
        refresh_token: 'RT',
        instance_url: 'https://na1.salesforce.com',
        id: 'https://login.salesforce.com/id/org/user',
        token_type: 'Bearer',
        issued_at: String(Date.now()),
        signature: 'sig',
      }
      mockFetch.mockReturnValueOnce(makeFetchOk(tokenResponse))
      const result = await exchangeCodeForTokens(VALID_CONFIG, 'auth-code', 'verifier')
      expect(result.access_token).toBe('AT')
      expect(result.refresh_token).toBe('RT')
    })

    it('throws SalesforceAuthError on non-200 response', async () => {
      mockFetch.mockReturnValueOnce(
        makeFetchError(400, { error: 'invalid_grant', error_description: 'Code expired' }),
      )
      await expect(exchangeCodeForTokens(VALID_CONFIG, 'bad-code', 'verifier')).rejects.toThrow(
        SalesforceAuthError,
      )
    })
  })

  describe('refreshAccessToken', () => {
    it('returns refreshed token response on success', async () => {
      const refreshed = {
        access_token: 'AT2',
        instance_url: 'https://na1.salesforce.com',
        id: 'https://login.salesforce.com/id/org/user',
        token_type: 'Bearer',
        issued_at: String(Date.now()),
        signature: 'sig',
      }
      mockFetch.mockReturnValueOnce(makeFetchOk(refreshed))
      const result = await refreshAccessToken(VALID_CONFIG, 'REFRESH_TOKEN')
      expect(result.access_token).toBe('AT2')
    })

    it('throws SalesforceAuthError on refresh failure', async () => {
      mockFetch.mockReturnValueOnce(
        makeFetchError(401, { error: 'invalid_grant', error_description: 'Refresh failed' }),
      )
      await expect(refreshAccessToken(VALID_CONFIG, 'bad-rt')).rejects.toThrow(SalesforceAuthError)
    })
  })

  describe('computeExpiresAt', () => {
    it('returns a date ~28 min in the future from issued_at', () => {
      const issuedAt = Date.now()
      const expires = new Date(computeExpiresAt(String(issuedAt))).getTime()
      const diffMin = (expires - issuedAt) / 60000
      expect(diffMin).toBeCloseTo(28, 0) // 30 min - 2 min safety buffer
    })

    it('falls back to "now" when issuedAt is absent', () => {
      const before = Date.now()
      const expires = new Date(computeExpiresAt()).getTime()
      expect(expires).toBeGreaterThanOrEqual(before + 28 * 60 * 1000 - 1000)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. salesforce-schema.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('salesforce-schema', () => {
  describe('mapDescribeGlobalToSchema', () => {
    it('maps standard sobjects to ConnectorObject[]', () => {
      const result = mapDescribeGlobalToSchema({
        sobjects: [
          { name: 'Contact', label: 'Contact', custom: false, queryable: true },
          { name: 'Account', label: 'Account', custom: false, queryable: true },
        ],
      })
      expect(result).toHaveLength(2)
      expect(result[0].apiName).toBe('Contact')
      expect(result[0].isCustom).toBe(false)
      expect(result[0].isSelected).toBe(true) // Contact is in DEFAULT_CRM_OBJECTS
    })

    it('filters out non-queryable objects', () => {
      const result = mapDescribeGlobalToSchema({
        sobjects: [
          { name: 'Contact', label: 'Contact', custom: false, queryable: true },
          { name: 'InternalThing', label: 'Internal', custom: false, queryable: false },
        ],
      })
      expect(result).toHaveLength(1)
      expect(result[0].apiName).toBe('Contact')
    })

    it('filters out deprecated objects', () => {
      const result = mapDescribeGlobalToSchema({
        sobjects: [
          { name: 'Contact', label: 'Contact', custom: false, queryable: true, deprecatedAndHidden: true },
          { name: 'Account', label: 'Account', custom: false, queryable: true },
        ],
      })
      expect(result).toHaveLength(1)
      expect(result[0].apiName).toBe('Account')
    })

    it('pre-selects custom objects (__c suffix)', () => {
      const result = mapDescribeGlobalToSchema({
        sobjects: [{ name: 'Invoice__c', label: 'Invoice', custom: true, queryable: true }],
      })
      expect(result[0].isSelected).toBe(true)
    })

    it('marks system objects with [system] description', () => {
      const result = mapDescribeGlobalToSchema({
        sobjects: [{ name: 'ApexClass', label: 'Apex Class', custom: false, queryable: true }],
      })
      expect(result[0].description).toBe('[system]')
    })
  })

  describe('mapDescribeToFields', () => {
    const baseField = {
      name: 'FirstName',
      label: 'First Name',
      type: 'string',
      nillable: true,
      createable: true,
      updateable: true,
      unique: false,
    }

    it('maps basic string field', () => {
      const fields = mapDescribeToFields({ name: 'Contact', label: 'Contact', fields: [baseField] })
      expect(fields[0].apiName).toBe('FirstName')
      expect(fields[0].dataType).toBe('string')
      expect(fields[0].isRequired).toBe(false)
      expect(fields[0].isReadOnly).toBe(false)
    })

    it('marks non-nillable createable field as required', () => {
      const fields = mapDescribeToFields({
        name: 'Contact',
        label: 'Contact',
        fields: [{ ...baseField, name: 'LastName', nillable: false, createable: true }],
      })
      expect(fields[0].isRequired).toBe(true)
    })

    it('marks non-createable non-updateable field as readOnly', () => {
      const fields = mapDescribeToFields({
        name: 'Contact',
        label: 'Contact',
        fields: [{ ...baseField, name: 'Id', createable: false, updateable: false }],
      })
      expect(fields[0].isReadOnly).toBe(true)
    })

    it('maps reference field with referenceTo and relationshipType=lookup', () => {
      const fields = mapDescribeToFields({
        name: 'Contact',
        label: 'Contact',
        fields: [{
          name: 'AccountId',
          label: 'Account ID',
          type: 'reference',
          nillable: true,
          createable: true,
          updateable: true,
          unique: false,
          referenceTo: ['Account'],
        }],
      })
      expect(fields[0].dataType).toBe('reference')
      expect(fields[0].referenceTo).toBe('Account')
      expect(fields[0].relationshipType).toBe('lookup')
    })

    it('maps picklist field with active values only', () => {
      const fields = mapDescribeToFields({
        name: 'Lead',
        label: 'Lead',
        fields: [{
          name: 'Status',
          label: 'Status',
          type: 'picklist',
          nillable: true,
          createable: true,
          updateable: true,
          unique: false,
          picklistValues: [
            { value: 'Open', active: true },
            { value: 'Closed', active: false },
            { value: 'Converted', active: true },
          ],
        }],
      })
      expect(fields[0].dataType).toBe('picklist')
      expect(fields[0].picklistValues).toEqual(['Open', 'Converted'])
    })
  })

  describe('normaliseType', () => {
    it.each([
      ['string', 'string'],
      ['textarea', 'string'],
      ['phone', 'phone'],
      ['email', 'email'],
      ['url', 'url'],
      ['int', 'integer'],
      ['integer', 'integer'],
      ['double', 'decimal'],
      ['long', 'decimal'],
      ['currency', 'currency'],
      ['percent', 'percent'],
      ['boolean', 'boolean'],
      ['date', 'date'],
      ['datetime', 'datetime'],
      ['time', 'time'],
      ['picklist', 'picklist'],
      ['multipicklist', 'picklist'],
      ['reference', 'reference'],
      ['id', 'string'],
      ['encryptedstring', 'encryptedstring'], // exotic — pass-through
    ])('maps %s → %s', (input, expected) => {
      expect(normaliseType(input)).toBe(expected)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. salesforce-constants.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('salesforce-constants', () => {
  describe('isSystemObject', () => {
    it.each([
      'ApexClass', 'AuthSession', 'LoginHistory', 'Profile', 'User',
      'ContactHistory', 'ContactShare', 'ContactChangeEvent',
      'FlowElement', 'SetupAuditTrail',
    ])('identifies %s as system object', (name) => {
      expect(isSystemObject(name)).toBe(true)
    })

    it.each(['Contact', 'Account', 'Lead', 'Invoice__c', 'CustomObject__c'])(
      'does not flag %s as system object',
      (name) => {
        expect(isSystemObject(name)).toBe(false)
      },
    )
  })

  describe('isDefaultSelected', () => {
    it('pre-selects common CRM objects', () => {
      expect(isDefaultSelected('Contact', false)).toBe(true)
      expect(isDefaultSelected('Account', false)).toBe(true)
      expect(isDefaultSelected('Lead', false)).toBe(true)
    })

    it('pre-selects custom objects with __c suffix', () => {
      expect(isDefaultSelected('Invoice__c', true)).toBe(true)
    })

    it('does not pre-select non-CRM standard objects', () => {
      expect(isDefaultSelected('Pricebook2', false)).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. salesforce-records.ts
// ─────────────────────────────────────────────────────────────────────────────

describe('salesforce-records', () => {
  describe('safeIdent', () => {
    it('allows valid identifiers', () => {
      expect(safeIdent('Contact')).toBe('Contact')
      expect(safeIdent('Invoice__c')).toBe('Invoice__c')
    })

    it('throws on identifier with injection chars', () => {
      expect(() => safeIdent('Contact; DROP TABLE--')).toThrow('Invalid SF identifier')
      expect(() => safeIdent('Contact WHERE 1=1')).toThrow('Invalid SF identifier')
    })
  })

  describe('buildSoqlQuery', () => {
    it('generates correct SOQL for page 1', () => {
      const soql = buildSoqlQuery('Contact', ['Id', 'FirstName'], 1, 25)
      expect(soql).toBe('SELECT Id, FirstName FROM Contact LIMIT 25 OFFSET 0')
    })

    it('generates correct OFFSET for page 2', () => {
      const soql = buildSoqlQuery('Contact', ['Id'], 2, 25)
      expect(soql).toBe('SELECT Id FROM Contact LIMIT 25 OFFSET 25')
    })

    it('defaults to Id when no fields given', () => {
      const soql = buildSoqlQuery('Account', [], 1, 50)
      expect(soql).toContain('SELECT Id FROM Account')
    })

    it('caps pageSize at 200', () => {
      const soql = buildSoqlQuery('Contact', ['Id'], 1, 500)
      expect(soql).toContain('LIMIT 200')
    })

    it('throws when OFFSET would exceed 2000', () => {
      // page=42, pageSize=50 → offset = 41*50 = 2050 > 2000
      expect(() => buildSoqlQuery('Contact', ['Id'], 42, 50)).toThrow('SALESFORCE_OFFSET_EXCEEDED')
    })
  })

  describe('buildCountQuery', () => {
    it('returns COUNT() query', () => {
      expect(buildCountQuery('Contact')).toBe('SELECT COUNT() FROM Contact')
    })
  })

  describe('executeQuery', () => {
    it('maps query result to PaginatedRecords', async () => {
      const conn = {
        query: vi.fn().mockResolvedValue({
          totalSize: 100,
          done: true,
          records: [
            { attributes: { type: 'Contact' }, Id: '001', Name: 'John' },
          ],
        }),
      }
      const result = await executeQuery(conn, 'SELECT Id FROM Contact LIMIT 25 OFFSET 0', 1, 25)
      expect(result.records).toHaveLength(1)
      expect(result.records[0]).not.toHaveProperty('attributes')
      expect(result.totalCount).toBe(100)
      expect(result.currentPage).toBe(1)
      expect(result.hasNextPage).toBe(true)
    })

    it('uses totalCountHint when provided', async () => {
      const conn = {
        query: vi.fn().mockResolvedValue({ totalSize: 5, done: true, records: [] }),
      }
      const result = await executeQuery(conn, 'SELECT Id FROM Opp LIMIT 25 OFFSET 0', 1, 25, 999)
      expect(result.totalCount).toBe(999)
    })

    it('hasNextPage is false when on last page', async () => {
      const conn = {
        query: vi.fn().mockResolvedValue({ totalSize: 10, done: true, records: new Array(10).fill({}) }),
      }
      const result = await executeQuery(conn, 'SELECT Id FROM T LIMIT 25 OFFSET 0', 1, 25, 10)
      expect(result.hasNextPage).toBe(false)
    })
  })

  describe('calculateFieldStats', () => {
    const records = [
      { Name: 'Alice', Status: 'Open' },
      { Name: 'Bob', Status: null },
      { Name: 'Alice', Status: 'Closed' },
      { Name: null },
    ]

    it('counts null values correctly', () => {
      const stats = calculateFieldStats(records, 'Name')
      expect(stats.nullCount).toBe(1)
    })

    it('counts distinct non-null values', () => {
      const stats = calculateFieldStats(records, 'Name')
      expect(stats.distinctCount).toBe(2) // Alice, Bob
    })

    it('collects sample values', () => {
      const stats = calculateFieldStats(records, 'Status')
      expect(stats.sampleValues).toContain('Open')
      expect(stats.sampleValues).toContain('Closed')
    })

    it('returns correct fieldApiName', () => {
      const stats = calculateFieldStats(records, 'Status')
      expect(stats.fieldApiName).toBe('Status')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. salesforce-adapter.ts (ConnectorAdapter interface)
// ─────────────────────────────────────────────────────────────────────────────

describe('salesforceAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue({
      id: 'conn-1',
      adapterType: 'salesforce',
      config: JSON.stringify(VALID_SF_CONN_CONFIG),
    })
  })

  it('capabilities are read-only', () => {
    expect(salesforceAdapter.capabilities.canRead).toBe(true)
    expect(salesforceAdapter.capabilities.canWrite).toBe(false)
    expect(salesforceAdapter.capabilities.canWriteSchema).toBe(false)
  })

  describe('connect()', () => {
    it('returns CONNECTED status when accessToken and instanceUrl are present', async () => {
      const conn = await salesforceAdapter.connect({
        accessToken: 'AT',
        instanceUrl: 'https://na1.salesforce.com',
        orgName: 'ACME',
      })
      expect(conn.status).toBe('CONNECTED')
      expect(conn.type).toBe('salesforce')
      expect(conn.name).toBe('ACME')
    })

    it('throws SalesforceAuthError when config is incomplete', async () => {
      await expect(salesforceAdapter.connect({ instanceUrl: 'https://na1.salesforce.com' })).rejects.toThrow(
        'Missing accessToken/instanceUrl',
      )
    })
  })

  describe('disconnect()', () => {
    it('resolves without error (stateless)', async () => {
      await expect(salesforceAdapter.disconnect('conn-1')).resolves.toBeUndefined()
    })
  })

  describe('getSchema()', () => {
    it('calls describeGlobal and maps to ConnectorObject[]', async () => {
      mockDescribeGlobal.mockResolvedValue({
        sobjects: [
          { name: 'Contact', label: 'Contact', custom: false, queryable: true },
          { name: 'Invoice__c', label: 'Invoice', custom: true, queryable: true },
        ],
      })
      const schema = await salesforceAdapter.getSchema('conn-1')
      expect(schema.objects).toHaveLength(2)
      expect(schema.objects[0].apiName).toBe('Contact')
      expect(schema.objects[1].isSelected).toBe(true) // __c custom object
    })
  })

  describe('getFields()', () => {
    it('calls describe(objectApiName) and returns ConnectorField[]', async () => {
      mockDescribe.mockResolvedValue({
        name: 'Contact',
        label: 'Contact',
        fields: [
          { name: 'Id', label: 'Contact ID', type: 'id', nillable: false, createable: false, updateable: false, unique: true },
          { name: 'FirstName', label: 'First Name', type: 'string', nillable: true, createable: true, updateable: true, unique: false },
        ],
      })
      const fields = await salesforceAdapter.getFields('conn-1', 'Contact')
      expect(fields).toHaveLength(2)
      expect(fields[0].apiName).toBe('Id')
      expect(fields[0].isReadOnly).toBe(true)
      expect(fields[1].dataType).toBe('string')
    })
  })

  describe('getRecordCount()', () => {
    it('executes COUNT query and returns totalSize', async () => {
      mockQuery.mockResolvedValue({ totalSize: 12345, done: true, records: [] })
      const count = await salesforceAdapter.getRecordCount('conn-1', 'Contact')
      expect(count).toBe(12345)
      expect(mockQuery).toHaveBeenCalledWith('SELECT COUNT() FROM Contact')
    })
  })

  describe('getFieldStats()', () => {
    it('queries sample records and computes stats per field', async () => {
      // getFieldStats calls conn.query internally
      mockDescribe.mockResolvedValue({
        name: 'Contact',
        label: 'Contact',
        fields: [
          { name: 'Id', label: 'ID', type: 'id', nillable: false, createable: false, updateable: false, unique: true },
          { name: 'Status__c', label: 'Status', type: 'picklist', nillable: true, createable: true, updateable: true, unique: false },
        ],
      })
      mockQuery.mockResolvedValue({
        totalSize: 3,
        done: true,
        records: [
          { Status__c: 'Open', Id: '1' },
          { Status__c: 'Closed', Id: '2' },
          { Status__c: null, Id: '3' },
        ],
      })
      const stats = await salesforceAdapter.getFieldStats('conn-1', 'Contact', ['Status__c'])
      expect(stats).toHaveLength(1)
      expect(stats[0].fieldApiName).toBe('Status__c')
      expect(stats[0].nullCount).toBe(1)
      expect(stats[0].distinctCount).toBe(2)
    })
  })

  describe('getRecords()', () => {
    it('queries with LIMIT/OFFSET and returns PaginatedRecords', async () => {
      // First call: getFields (via describe)
      mockDescribe.mockResolvedValue({
        name: 'Contact',
        label: 'Contact',
        fields: [
          { name: 'Id', label: 'ID', type: 'id', nillable: false, createable: false, updateable: false, unique: true },
          { name: 'Name', label: 'Name', type: 'string', nillable: true, createable: true, updateable: true, unique: false },
        ],
      })
      // COUNT call returns first, then the data query
      mockQuery
        .mockResolvedValueOnce({ totalSize: 100, done: true, records: [] }) // COUNT
        .mockResolvedValueOnce({
          totalSize: 100,
          done: false,
          records: [
            { attributes: { type: 'Contact' }, Id: '001', Name: 'Alice' },
          ],
        })
      const result = await salesforceAdapter.getRecords('conn-1', 'Contact', 1, 25)
      expect(result.currentPage).toBe(1)
      expect(result.totalCount).toBe(100)
      expect(result.records).toHaveLength(1)
      expect(result.records[0]).not.toHaveProperty('attributes')
    })
  })
})
