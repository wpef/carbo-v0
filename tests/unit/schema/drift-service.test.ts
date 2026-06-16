// 003-source-schema-retrieval — Unit tests for drift-service.ts (Cluster 11)
// Principle IV: realistic Salesforce and HubSpot object/field names throughout.
// Pure-function portions of the service are exercised via mocked Prisma + adapter.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — set up before any import of the module under test
// ---------------------------------------------------------------------------

// Mock Prisma so no DB connection is required
vi.mock('@/lib/prisma', () => ({
  prisma: {
    migrationPlan: {
      findUnique: vi.fn(),
    },
    schemaSnapshot: {
      findUnique: vi.fn(),
    },
    objectMapping: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock adapter registry
vi.mock('@/lib/adapters/registry', () => ({
  getAdapter: vi.fn(),
}))

// Mock audit (logAuditEvent writes to DB — isolate it)
vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue({}),
}))

import { prisma } from '@/lib/prisma'
import { getAdapter } from '@/lib/adapters/registry'
import { detectLiveDrift } from '@/features/schema/services/drift-service'

// ---------------------------------------------------------------------------
// Fixtures — Salesforce Account + Contact (realistic shapes)
// ---------------------------------------------------------------------------

const STORED_SNAPSHOT = {
  id: 'snap-sf-001',
  connectionId: 'conn-sf-001',
  side: 'SOURCE' as const,
  status: 'CURRENT' as const,
  fetchedAt: new Date('2026-06-01T10:00:00Z'),
  objects: [
    {
      id: 'obj-account',
      apiName: 'Account',
      label: 'Account',
      snapshotId: 'snap-sf-001',
      description: null,
      isCustom: false,
      fields: [
        {
          id: 'fld-name', apiName: 'Name', label: 'Account Name', dataType: 'string',
          isRequired: true, isReadOnly: false, isUnique: false, isAccessible: true,
          referenceTo: null, relationshipType: null,
          picklistValues: null,
          objectId: 'obj-account', snapshotId: 'snap-sf-001',
        },
        {
          id: 'fld-industry', apiName: 'Industry', label: 'Industry', dataType: 'picklist',
          isRequired: false, isReadOnly: false, isUnique: false, isAccessible: true,
          referenceTo: null, relationshipType: null,
          picklistValues: JSON.stringify(['Agriculture', 'Technology', 'Finance']),
          objectId: 'obj-account', snapshotId: 'snap-sf-001',
        },
      ],
    },
    {
      id: 'obj-contact',
      apiName: 'Contact',
      label: 'Contact',
      snapshotId: 'snap-sf-001',
      description: null,
      isCustom: false,
      fields: [
        {
          id: 'fld-email', apiName: 'Email', label: 'Email', dataType: 'email',
          isRequired: true, isReadOnly: false, isUnique: true, isAccessible: true,
          referenceTo: null, relationshipType: null,
          picklistValues: null,
          objectId: 'obj-contact', snapshotId: 'snap-sf-001',
        },
      ],
    },
  ],
}

const PLAN_WITH_CONNECTION = {
  id: 'plan-001',
  sourceConnection: {
    id: 'conn-sf-001',
    adapterType: 'salesforce',
    name: 'Salesforce (prod)',
    status: 'CONNECTED' as const,
    config: '{}',
    secretsRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  destinationConnection: null,
}

const OBJECT_MAPPINGS_ACCOUNT = [
  {
    id: 'om-001',
    planId: 'plan-001',
    sourceObjectName: 'Account',
    destinationObjectName: 'companies',
    autoCreated: true,
    fieldAutoMatchedAt: null,
    fieldMappings: [
      { sourceFieldName: 'Name', destinationFieldName: 'name' },
      { sourceFieldName: 'Industry', destinationFieldName: 'industry' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectLiveDrift — unit (mocked DB + adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns status=ok when live schema matches stored snapshot', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(STORED_SNAPSHOT as never)
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue(OBJECT_MAPPINGS_ACCOUNT as never)

    // Adapter returns identical schema to stored
    const mockAdapter = {
      getSchema: vi.fn().mockResolvedValue({
        objects: [
          { apiName: 'Account', label: 'Account', isCustom: false, isSelected: true },
          { apiName: 'Contact', label: 'Contact', isCustom: false, isSelected: true },
        ],
      }),
      getFields: vi.fn().mockImplementation((_connId: string, objectApiName: string) => {
        if (objectApiName === 'Account') {
          return Promise.resolve([
            { apiName: 'Name',     label: 'Account Name', dataType: 'string',   isRequired: true,  isReadOnly: false, isUnique: false, picklistValues: undefined },
            { apiName: 'Industry', label: 'Industry',     dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false, picklistValues: ['Agriculture', 'Technology', 'Finance'] },
          ])
        }
        return Promise.resolve([])
      }),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const report = await detectLiveDrift('plan-001', 'source')

    expect(report.status).toBe('ok')
    expect(report.changes).toHaveLength(0)
    expect(report.connectionId).toBe('conn-sf-001')
    expect(report.role).toBe('source')
  })

  it('returns status=drift when a mapped field is removed from live schema', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(STORED_SNAPSHOT as never)
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue(OBJECT_MAPPINGS_ACCOUNT as never)

    const mockAdapter = {
      getSchema: vi.fn().mockResolvedValue({
        objects: [
          { apiName: 'Account', label: 'Account', isCustom: false, isSelected: true },
          { apiName: 'Contact', label: 'Contact', isCustom: false, isSelected: true },
        ],
      }),
      // Industry field removed from live Account
      getFields: vi.fn().mockResolvedValue([
        { apiName: 'Name', label: 'Account Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
        // Industry is gone
      ]),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const report = await detectLiveDrift('plan-001', 'source')

    expect(report.status).toBe('drift')
    const removed = report.changes.find((c) => c.type === 'FIELD_REMOVED' && c.fieldApiName === 'Industry')
    expect(removed).toBeDefined()
    expect(removed!.severity).toBe('critical')
    expect(removed!.affectsMapping).toBe(true) // Industry was in field mapping
    expect(report.severitySummary.critical).toBeGreaterThanOrEqual(1)
  })

  it('returns status=drift when a new picklist value is added on a mapped field', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(STORED_SNAPSHOT as never)
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue(OBJECT_MAPPINGS_ACCOUNT as never)

    const mockAdapter = {
      getSchema: vi.fn().mockResolvedValue({
        objects: [{ apiName: 'Account', label: 'Account', isCustom: false, isSelected: true }],
      }),
      getFields: vi.fn().mockResolvedValue([
        { apiName: 'Name',     label: 'Account Name', dataType: 'string',   isRequired: true,  isReadOnly: false, isUnique: false },
        // 'Biotechnology' added to Industry picklist
        { apiName: 'Industry', label: 'Industry',     dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false,
          picklistValues: ['Agriculture', 'Technology', 'Finance', 'Biotechnology'] },
      ]),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const report = await detectLiveDrift('plan-001', 'source')

    expect(report.status).toBe('drift')
    const plAdded = report.changes.filter((c) => c.type === 'PICKLIST_VALUE_ADDED' && c.fieldApiName === 'Industry')
    expect(plAdded).toHaveLength(1)
    expect(plAdded[0].after).toBe('Biotechnology')
  })

  it('returns status=unavailable when plan is not found', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(null)

    const report = await detectLiveDrift('plan-NONEXISTENT', 'source')

    expect(report.status).toBe('unavailable')
    expect(report.reason).toMatch(/not found/i)
  })

  it('returns status=unavailable when there is no source connection', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue({
      id: 'plan-002',
      sourceConnection: null,
      destinationConnection: null,
    } as never)

    const report = await detectLiveDrift('plan-002', 'source')

    expect(report.status).toBe('unavailable')
    expect(report.reason).toMatch(/no source connection/i)
  })

  it('returns status=unavailable when CURRENT snapshot is missing (schema not yet retrieved)', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue([] as never)

    const report = await detectLiveDrift('plan-001', 'source')

    expect(report.status).toBe('unavailable')
    expect(report.reason).toMatch(/no current snapshot/i)
  })

  it('returns status=unavailable when the adapter throws (FR-015 graceful failure)', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(STORED_SNAPSHOT as never)
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue(OBJECT_MAPPINGS_ACCOUNT as never)

    const mockAdapter = {
      getSchema: vi.fn().mockRejectedValue(new Error('ETIMEDOUT: connect ETIMEDOUT 104.154.101.10:443')),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const report = await detectLiveDrift('plan-001', 'source')

    expect(report.status).toBe('unavailable')
    expect(report.reason).toContain('ETIMEDOUT')
  })

  it('does not fetch fields for unmapped objects (FR-016 efficiency)', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(STORED_SNAPSHOT as never)
    // Only Account is mapped — Contact is NOT in mappings
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue(OBJECT_MAPPINGS_ACCOUNT as never)

    const getFieldsMock = vi.fn().mockResolvedValue([
      { apiName: 'Name', label: 'Account Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
      { apiName: 'Industry', label: 'Industry', dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false,
        picklistValues: ['Agriculture', 'Technology', 'Finance'] },
    ])

    const mockAdapter = {
      getSchema: vi.fn().mockResolvedValue({
        objects: [
          { apiName: 'Account', label: 'Account', isCustom: false, isSelected: true },
          { apiName: 'Contact', label: 'Contact', isCustom: false, isSelected: true },
        ],
      }),
      getFields: getFieldsMock,
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    await detectLiveDrift('plan-001', 'source')

    // getFields should be called exactly once — only for Account (mapped), not Contact (unmapped)
    expect(getFieldsMock).toHaveBeenCalledTimes(1)
    expect(getFieldsMock).toHaveBeenCalledWith('conn-sf-001', 'Account')
  })

  it('gracefully continues when getFields fails for one object (non-fatal)', async () => {
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(STORED_SNAPSHOT as never)
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue(OBJECT_MAPPINGS_ACCOUNT as never)

    const mockAdapter = {
      getSchema: vi.fn().mockResolvedValue({
        objects: [{ apiName: 'Account', label: 'Account', isCustom: false, isSelected: true }],
      }),
      // getFields throws — service must not re-throw
      getFields: vi.fn().mockRejectedValue(new Error('FIELD_ACCESS_DENIED')),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    // Should resolve (not reject) even when getFields fails
    await expect(detectLiveDrift('plan-001', 'source')).resolves.toBeDefined()
  })

  it('correctly deserialises JSON picklistValues from DB when comparing (Cluster 5 integration)', async () => {
    // Stored snapshot has Industry with picklistValues as JSON string (Cluster 5 fix)
    vi.mocked(prisma.migrationPlan.findUnique).mockResolvedValue(PLAN_WITH_CONNECTION as never)
    vi.mocked(prisma.schemaSnapshot.findUnique).mockResolvedValue(STORED_SNAPSHOT as never)
    vi.mocked(prisma.objectMapping.findMany).mockResolvedValue(OBJECT_MAPPINGS_ACCOUNT as never)

    const mockAdapter = {
      getSchema: vi.fn().mockResolvedValue({
        objects: [{ apiName: 'Account', label: 'Account', isCustom: false, isSelected: true }],
      }),
      getFields: vi.fn().mockResolvedValue([
        { apiName: 'Name',     label: 'Account Name', dataType: 'string',   isRequired: true,  isReadOnly: false, isUnique: false },
        // 'Healthcare' added to picklist — should trigger PICKLIST_VALUE_ADDED
        { apiName: 'Industry', label: 'Industry',     dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false,
          picklistValues: ['Agriculture', 'Technology', 'Finance', 'Healthcare'] },
      ]),
    }
    vi.mocked(getAdapter).mockReturnValue(mockAdapter as never)

    const report = await detectLiveDrift('plan-001', 'source')

    // The stored picklistValues '["Agriculture","Technology","Finance"]' must have
    // been deserialised correctly for the comparison to detect 'Healthcare' as new.
    const added = report.changes.filter((c) => c.type === 'PICKLIST_VALUE_ADDED')
    expect(added).toHaveLength(1)
    expect(added[0].after).toBe('Healthcare')
  })
})
