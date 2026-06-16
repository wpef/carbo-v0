// 022-schema-write — Unit tests for field-validator.ts (T019)
// Principle IV: realistic CRM field names throughout.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    schemaSnapshot: {
      findUnique: vi.fn(),
    },
    schemaObject: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/adapters/registry', () => ({
  getAdapter: vi.fn(),
}))

import { getAdapter } from '@/lib/adapters/registry'
import { prisma } from '@/lib/prisma'
import { validateCreateField, validateModifyField } from '@/features/schema-write/services/field-validator'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONNECTION_ID = 'conn-hubspot-001'
const ADAPTER_TYPE = 'hubspot'
const SNAPSHOT_ID = 'snap-hs-001'
const OBJECT_API_NAME = 'contacts'

const SUPPORTED_TYPES = ['string', 'number', 'date', 'datetime', 'enumeration', 'bool']

const DEMO_ADAPTER = {
  capabilities: {
    canRead: true,
    canWrite: false,
    canWriteSchema: true,
    supportedFieldTypes: SUPPORTED_TYPES,
  },
}

// Existing fields on the contacts object (realistic HubSpot fields)
const EXISTING_FIELDS = [
  { apiName: 'email' },
  { apiName: 'firstname' },
  { apiName: 'lastname' },
  { apiName: 'lifecyclestage' },
  { apiName: 'annual_revenue' },
]

// Helper: set up mocks for a scenario with a snapshot
function setupWithSnapshot() {
  vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue({ id: SNAPSHOT_ID } as never)
  vi.mocked(prisma.schemaObject.findUnique).mockResolvedValue({
    id: 'obj-contacts-001',
    fields: EXISTING_FIELDS,
  } as never)
  vi.mocked(getAdapter).mockReturnValue(DEMO_ADAPTER as never)
}

// Helper: no snapshot
function setupWithoutSnapshot() {
  vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(null)
  vi.mocked(getAdapter).mockReturnValue(DEMO_ADAPTER as never)
}

// ---------------------------------------------------------------------------
// Tests: validateCreateField
// ---------------------------------------------------------------------------

describe('validateCreateField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { valid: true } for a valid new field (string type, unique name)', async () => {
    setupWithSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: 'customer_segment',
      type: 'string',
    })
    expect(result).toEqual({ valid: true })
  })

  it('returns validation error when name is empty', async () => {
    setupWithoutSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: '',
      type: 'string',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.toLowerCase().includes('name'))).toBe(true)
    }
  })

  it('returns validation error when name is whitespace only', async () => {
    setupWithoutSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: '   ',
      type: 'string',
    })
    expect(result.valid).toBe(false)
  })

  it('returns validation error for unsupported type', async () => {
    setupWithSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: 'blob_field',
      type: 'blob',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("'blob'") || e.includes('blob'))).toBe(true)
    }
  })

  it('returns validation error when field name already exists in snapshot', async () => {
    setupWithSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: 'email', // already in EXISTING_FIELDS
      type: 'string',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('email'))).toBe(true)
    }
  })

  it('returns validation error for enumeration type without picklistValues', async () => {
    setupWithSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: 'deal_source',
      type: 'enumeration',
      // picklistValues missing
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.toLowerCase().includes('picklist'))).toBe(true)
    }
  })

  it('returns { valid: true } for enumeration type with picklistValues', async () => {
    setupWithSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: 'deal_source',
      type: 'enumeration',
      picklistValues: ['Organic', 'Referral', 'Paid', 'Direct'],
    })
    expect(result).toEqual({ valid: true })
  })

  it('skips snapshot uniqueness check when no snapshot exists (allows proceed to adapter)', async () => {
    setupWithoutSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: 'any_new_field',
      type: 'string',
    })
    // No snapshot — valid: true because we cannot check uniqueness locally
    expect(result).toEqual({ valid: true })
  })

  it('returns multiple errors when multiple validations fail', async () => {
    setupWithoutSnapshot()
    const result = await validateCreateField(CONNECTION_ID, ADAPTER_TYPE, OBJECT_API_NAME, {
      name: '',
      type: 'blob',
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: validateModifyField
// ---------------------------------------------------------------------------

describe('validateModifyField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { valid: true } for a valid modification (label update only)', async () => {
    setupWithSnapshot()
    const result = await validateModifyField(
      CONNECTION_ID,
      ADAPTER_TYPE,
      OBJECT_API_NAME,
      'email', // exists
      { label: 'Email Address' },
    )
    expect(result).toEqual({ valid: true })
  })

  it('returns validation error when field does not exist in snapshot', async () => {
    setupWithSnapshot()
    const result = await validateModifyField(
      CONNECTION_ID,
      ADAPTER_TYPE,
      OBJECT_API_NAME,
      'nonexistent_field__c',
      {},
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('nonexistent_field__c'))).toBe(true)
    }
  })

  it('returns validation error when rename conflicts with an existing field name', async () => {
    setupWithSnapshot()
    const result = await validateModifyField(
      CONNECTION_ID,
      ADAPTER_TYPE,
      OBJECT_API_NAME,
      'annual_revenue', // existing field
      { name: 'email' }, // rename to 'email' which also exists
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('email'))).toBe(true)
    }
  })

  it('allows rename when new name does not conflict', async () => {
    setupWithSnapshot()
    const result = await validateModifyField(
      CONNECTION_ID,
      ADAPTER_TYPE,
      OBJECT_API_NAME,
      'annual_revenue',
      { name: 'yearly_revenue' }, // new unique name
    )
    expect(result).toEqual({ valid: true })
  })

  it('returns validation error when new type is unsupported', async () => {
    setupWithSnapshot()
    const result = await validateModifyField(
      CONNECTION_ID,
      ADAPTER_TYPE,
      OBJECT_API_NAME,
      'email',
      { type: 'blob' }, // unsupported
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('blob'))).toBe(true)
    }
  })

  it('allows type change when new type is in supportedFieldTypes', async () => {
    setupWithSnapshot()
    const result = await validateModifyField(
      CONNECTION_ID,
      ADAPTER_TYPE,
      OBJECT_API_NAME,
      'annual_revenue',
      { type: 'number' }, // supported
    )
    expect(result).toEqual({ valid: true })
  })

  it('returns { valid: true } when no snapshot exists (cannot check locally)', async () => {
    setupWithoutSnapshot()
    const result = await validateModifyField(
      CONNECTION_ID,
      ADAPTER_TYPE,
      OBJECT_API_NAME,
      'any_field',
      {},
    )
    expect(result).toEqual({ valid: true })
  })
})
