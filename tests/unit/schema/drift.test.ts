// 003-source-schema-retrieval — Unit tests for drift detection (FR-012 … FR-016)
// Principle IV: realistic Salesforce / HubSpot apiNames and dataTypes throughout.
// No lorem ipsum, no single-letter fixtures, no toy schemas.

import { describe, it, expect } from 'vitest'
import {
  computeDrift,
  buildUnavailableReport,
  DRIFT_MODIFICATION_TYPES,
  type SnapshotObject,
  type MappingContext,
  type DriftReport,
  type DriftChange,
} from '@/features/schema/lib/drift'

// ---------------------------------------------------------------------------
// Shared realistic fixtures
// ---------------------------------------------------------------------------

/** Standard Salesforce Account object fields as stored in snapshot */
const SF_ACCOUNT_STORED: SnapshotObject = {
  apiName: 'Account',
  label: 'Account',
  fields: [
    { apiName: 'Name',            label: 'Account Name',   dataType: 'string',   isRequired: true,  isReadOnly: false, isUnique: false },
    { apiName: 'BillingCountry',  label: 'Billing Country',dataType: 'string',   isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'AnnualRevenue',   label: 'Annual Revenue', dataType: 'currency', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'Industry',        label: 'Industry',       dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false,
      picklistValues: ['Agriculture', 'Energy', 'Finance', 'Healthcare', 'Technology'] },
    { apiName: 'AccountNumber',   label: 'Account Number', dataType: 'string',   isRequired: false, isReadOnly: true,  isUnique: true  },
    { apiName: 'LastModifiedDate',label: 'Last Modified',  dataType: 'datetime', isRequired: true,  isReadOnly: true,  isUnique: false },
  ],
}

/** Same Account — no changes (used for "no drift" tests) */
const SF_ACCOUNT_LIVE_UNCHANGED: SnapshotObject = structuredClone(SF_ACCOUNT_STORED)

/** HubSpot companies object stored in snapshot */
const HS_COMPANIES_STORED: SnapshotObject = {
  apiName: 'companies',
  label: 'Companies',
  fields: [
    { apiName: 'name',         label: 'Company name',  dataType: 'single_line_text', isRequired: true,  isReadOnly: false, isUnique: false },
    { apiName: 'domain',       label: 'Domain name',   dataType: 'single_line_text', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'annualrevenue',label: 'Annual Revenue', dataType: 'number',          isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'industry',     label: 'Industry',       dataType: 'enumeration',     isRequired: false, isReadOnly: false, isUnique: false,
      picklistValues: ['AGRICULTURE', 'ENERGY', 'FINANCE', 'HEALTHCARE', 'TECHNOLOGY'] },
  ],
}

/** A full mapping context covering Account ↔ companies */
function makeCtx(
  mappedObjects: string[] = ['Account', 'companies'],
  mappedFields: Record<string, string[]> = {
    Account: ['Name', 'BillingCountry', 'AnnualRevenue', 'Industry', 'AccountNumber'],
    companies: ['name', 'domain', 'annualrevenue', 'industry'],
  },
): MappingContext {
  return {
    mappedObjectApiNames: new Set(mappedObjects),
    mappedFieldsByObject: new Map(
      Object.entries(mappedFields).map(([obj, fields]) => [obj, new Set(fields)]),
    ),
  }
}

/** Empty mapping context (no objects mapped) */
const NO_MAPPING: MappingContext = {
  mappedObjectApiNames: new Set(),
  mappedFieldsByObject: new Map(),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findChange(report: DriftReport, type: string, field?: string): DriftChange | undefined {
  return report.changes.find((c) => c.type === type && (!field || c.fieldApiName === field))
}

// ---------------------------------------------------------------------------
// 1. Status: ok — no drift
// ---------------------------------------------------------------------------

describe('computeDrift — status ok', () => {
  it('returns status=ok with empty changes when stored and live are identical', () => {
    const report = computeDrift(
      'conn-sf-001', 'source',
      [SF_ACCOUNT_STORED],
      [SF_ACCOUNT_LIVE_UNCHANGED],
      makeCtx(),
    )
    expect(report.status).toBe('ok')
    expect(report.changes).toHaveLength(0)
    expect(report.severitySummary).toEqual({ critical: 0, warning: 0, info: 0 })
  })

  it('returns status=ok when there are no objects at all (empty schema)', () => {
    const report = computeDrift('conn-hs-001', 'destination', [], [], NO_MAPPING)
    expect(report.status).toBe('ok')
    expect(report.changes).toHaveLength(0)
  })

  it('always populates connectionId, role, and checkedAt in ISO format', () => {
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [SF_ACCOUNT_LIVE_UNCHANGED], makeCtx())
    expect(report.connectionId).toBe('conn-sf-001')
    expect(report.role).toBe('source')
    expect(report.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

// ---------------------------------------------------------------------------
// 2. OBJECT_ADDED / OBJECT_REMOVED
// ---------------------------------------------------------------------------

describe('computeDrift — object-level changes', () => {
  it('emits OBJECT_ADDED (info) when a new object appears in live schema', () => {
    const newObj: SnapshotObject = { apiName: 'Lead', label: 'Lead', fields: [] }
    const report = computeDrift('conn-sf-001', 'source',
      [SF_ACCOUNT_STORED],
      [SF_ACCOUNT_LIVE_UNCHANGED, newObj],
      makeCtx(),
    )
    const change = findChange(report, 'OBJECT_ADDED')
    expect(change).toBeDefined()
    expect(change!.objectApiName).toBe('Lead')
    expect(change!.severity).toBe('info')
    expect(change!.affectsMapping).toBe(false) // newly added → not in mapping
  })

  it('emits OBJECT_REMOVED (critical) when an object disappears from live schema', () => {
    const report = computeDrift('conn-sf-001', 'source',
      [SF_ACCOUNT_STORED, { apiName: 'Contact', label: 'Contact', fields: [] }],
      [SF_ACCOUNT_LIVE_UNCHANGED],
      makeCtx(['Account', 'Contact']),
    )
    const change = findChange(report, 'OBJECT_REMOVED')
    expect(change).toBeDefined()
    expect(change!.objectApiName).toBe('Contact')
    expect(change!.severity).toBe('critical')
    expect(change!.affectsMapping).toBe(true) // Contact was mapped
  })

  it('affectsMapping=false for OBJECT_REMOVED when removed object was not mapped', () => {
    const report = computeDrift('conn-sf-001', 'source',
      [SF_ACCOUNT_STORED, { apiName: 'ContentDocument', label: 'Content', fields: [] }],
      [SF_ACCOUNT_LIVE_UNCHANGED],
      makeCtx(['Account']), // ContentDocument not in mapping context
    )
    const change = findChange(report, 'OBJECT_REMOVED')
    expect(change!.objectApiName).toBe('ContentDocument')
    expect(change!.affectsMapping).toBe(false)
  })

  it('status=drift when there is at least one change', () => {
    const report = computeDrift('conn-sf-001', 'source',
      [SF_ACCOUNT_STORED],
      [], // Account removed
      makeCtx(),
    )
    expect(report.status).toBe('drift')
    expect(report.severitySummary.critical).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 3. FIELD_ADDED / FIELD_REMOVED
// ---------------------------------------------------------------------------

describe('computeDrift — field additions and removals (mapped objects only)', () => {
  it('emits FIELD_ADDED (info) when a new field appears on a mapped object', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: [
        ...SF_ACCOUNT_LIVE_UNCHANGED.fields,
        { apiName: 'Description__c', label: 'Description', dataType: 'textarea', isRequired: false, isReadOnly: false, isUnique: false },
      ],
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_ADDED', 'Description__c')
    expect(change).toBeDefined()
    expect(change!.severity).toBe('info')
    expect(change!.affectsMapping).toBe(false) // new field not yet in mapping
  })

  it('emits FIELD_REMOVED (critical) when a mapped field disappears', () => {
    const liveWithoutBillingCountry: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.filter((f) => f.apiName !== 'BillingCountry'),
    }
    const report = computeDrift('conn-sf-001', 'source',
      [SF_ACCOUNT_STORED],
      [liveWithoutBillingCountry],
      makeCtx(['Account'], { Account: ['Name', 'BillingCountry', 'AnnualRevenue'] }),
    )
    const change = findChange(report, 'FIELD_REMOVED', 'BillingCountry')
    expect(change).toBeDefined()
    expect(change!.severity).toBe('critical')
    expect(change!.affectsMapping).toBe(true) // BillingCountry was field-mapped
  })

  it('FIELD_REMOVED affectsMapping=false when removed field was not field-mapped', () => {
    const liveWithoutLastModified: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.filter((f) => f.apiName !== 'LastModifiedDate'),
    }
    const report = computeDrift('conn-sf-001', 'source',
      [SF_ACCOUNT_STORED],
      [liveWithoutLastModified],
      makeCtx(['Account'], { Account: ['Name', 'AnnualRevenue'] }), // LastModifiedDate not mapped
    )
    const change = findChange(report, 'FIELD_REMOVED', 'LastModifiedDate')
    expect(change!.affectsMapping).toBe(false)
  })

  it('does NOT emit field-level changes for unmapped objects (FR-016)', () => {
    const liveWithNewField: SnapshotObject = {
      apiName: 'Task',
      label: 'Task',
      fields: [
        { apiName: 'Subject', label: 'Subject', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
        { apiName: 'NewField__c', label: 'New', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
      ],
    }
    const storedTask: SnapshotObject = {
      apiName: 'Task',
      label: 'Task',
      fields: [
        { apiName: 'Subject', label: 'Subject', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
      ],
    }
    const report = computeDrift('conn-sf-001', 'source',
      [SF_ACCOUNT_STORED, storedTask],
      [SF_ACCOUNT_LIVE_UNCHANGED, liveWithNewField],
      makeCtx(['Account']), // Task is NOT mapped
    )
    // No field-level changes for Task (unmapped)
    expect(report.changes.every((c) => c.objectApiName !== 'Task')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. FIELD_TYPE_CHANGED
// ---------------------------------------------------------------------------

describe('computeDrift — FIELD_TYPE_CHANGED', () => {
  it('emits FIELD_TYPE_CHANGED (critical) for an incompatible type change', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'AnnualRevenue' ? { ...f, dataType: 'string' } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_TYPE_CHANGED', 'AnnualRevenue')
    expect(change).toBeDefined()
    expect(change!.before).toBe('currency')
    expect(change!.after).toBe('string')
    expect(change!.severity).toBe('critical')
  })

  it('downgrades FIELD_TYPE_CHANGED to info for compatible widening (string→textarea)', () => {
    // Salesforce: Name field widens from string to textarea
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'Name' ? { ...f, dataType: 'textarea' } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_TYPE_CHANGED', 'Name')
    expect(change!.severity).toBe('info')
  })

  it('downgrades FIELD_TYPE_CHANGED to info for HubSpot compatible widening (single_line_text→multi_line_text)', () => {
    const liveCompanies: SnapshotObject = {
      ...HS_COMPANIES_STORED,
      fields: HS_COMPANIES_STORED.fields.map((f) =>
        f.apiName === 'name' ? { ...f, dataType: 'multi_line_text' } : f,
      ),
    }
    const report = computeDrift('conn-hs-001', 'destination',
      [HS_COMPANIES_STORED],
      [liveCompanies],
      makeCtx(['companies'], { companies: ['name', 'domain'] }),
    )
    const change = findChange(report, 'FIELD_TYPE_CHANGED', 'name')
    expect(change!.severity).toBe('info')
  })
})

// ---------------------------------------------------------------------------
// 5. FIELD_BECAME_REQUIRED / FIELD_BECAME_OPTIONAL
// ---------------------------------------------------------------------------

describe('computeDrift — required flag changes', () => {
  it('emits FIELD_BECAME_REQUIRED (warning) when isRequired flips to true', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'BillingCountry' ? { ...f, isRequired: true } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_BECAME_REQUIRED', 'BillingCountry')
    expect(change).toBeDefined()
    expect(change!.before).toBe(false)
    expect(change!.after).toBe(true)
    expect(change!.severity).toBe('warning')
  })

  it('emits FIELD_BECAME_OPTIONAL (info) when isRequired flips to false', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'Name' ? { ...f, isRequired: false } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_BECAME_OPTIONAL', 'Name')
    expect(change!.severity).toBe('info')
  })
})

// ---------------------------------------------------------------------------
// 6. FIELD_LABEL_CHANGED
// ---------------------------------------------------------------------------

describe('computeDrift — FIELD_LABEL_CHANGED', () => {
  it('emits FIELD_LABEL_CHANGED (info) when a field label is renamed', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'BillingCountry' ? { ...f, label: 'Country (Billing)' } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_LABEL_CHANGED', 'BillingCountry')
    expect(change).toBeDefined()
    expect(change!.before).toBe('Billing Country')
    expect(change!.after).toBe('Country (Billing)')
    expect(change!.severity).toBe('info')
  })
})

// ---------------------------------------------------------------------------
// 7. FIELD_READONLY_CHANGED / FIELD_UNIQUE_CHANGED
// ---------------------------------------------------------------------------

describe('computeDrift — readonly and unique flag changes', () => {
  it('emits FIELD_READONLY_CHANGED (warning) when isReadOnly flips', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'AnnualRevenue' ? { ...f, isReadOnly: true } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_READONLY_CHANGED', 'AnnualRevenue')
    expect(change!.before).toBe(false)
    expect(change!.after).toBe(true)
    expect(change!.severity).toBe('warning')
  })

  it('emits FIELD_UNIQUE_CHANGED (warning) when isUnique flips', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'AnnualRevenue' ? { ...f, isUnique: true } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_UNIQUE_CHANGED', 'AnnualRevenue')
    expect(change!.severity).toBe('warning')
  })

  it('emits FIELD_READONLY_CHANGED when previously read-only field becomes writable', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'AccountNumber' ? { ...f, isReadOnly: false } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const change = findChange(report, 'FIELD_READONLY_CHANGED', 'AccountNumber')
    expect(change!.before).toBe(true)
    expect(change!.after).toBe(false)
    expect(change!.severity).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// 8. PICKLIST_VALUE_ADDED / PICKLIST_VALUE_REMOVED
// ---------------------------------------------------------------------------

describe('computeDrift — picklist value changes', () => {
  it('emits PICKLIST_VALUE_ADDED (warning) for each new picklist value', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'Industry'
          ? { ...f, picklistValues: [...(f.picklistValues ?? []), 'Biotechnology', 'Consulting'] }
          : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const added = report.changes.filter((c) => c.type === 'PICKLIST_VALUE_ADDED' && c.fieldApiName === 'Industry')
    expect(added).toHaveLength(2)
    expect(added.map((c) => c.after)).toEqual(expect.arrayContaining(['Biotechnology', 'Consulting']))
    expect(added.every((c) => c.severity === 'warning')).toBe(true)
  })

  it('emits PICKLIST_VALUE_REMOVED (warning) for each removed picklist value', () => {
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'Industry'
          ? { ...f, picklistValues: ['Agriculture', 'Energy', 'Finance'] } // Healthcare + Technology removed
          : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    const removed = report.changes.filter((c) => c.type === 'PICKLIST_VALUE_REMOVED' && c.fieldApiName === 'Industry')
    expect(removed).toHaveLength(2)
    expect(removed.map((c) => c.before)).toEqual(expect.arrayContaining(['Healthcare', 'Technology']))
  })

  it('does not emit picklist changes when either side lacks picklistValues metadata', () => {
    // Live field has no picklistValues (metadata not returned by adapter)
    const liveAccount: SnapshotObject = {
      ...SF_ACCOUNT_LIVE_UNCHANGED,
      fields: SF_ACCOUNT_LIVE_UNCHANGED.fields.map((f) =>
        f.apiName === 'Industry' ? { ...f, picklistValues: undefined } : f,
      ),
    }
    const report = computeDrift('conn-sf-001', 'source', [SF_ACCOUNT_STORED], [liveAccount], makeCtx())
    expect(report.changes.filter((c) => c.type === 'PICKLIST_VALUE_ADDED' || c.type === 'PICKLIST_VALUE_REMOVED')).toHaveLength(0)
  })

  it('handles HubSpot enumeration fields with uppercase picklist values', () => {
    const liveCompanies: SnapshotObject = {
      ...HS_COMPANIES_STORED,
      fields: HS_COMPANIES_STORED.fields.map((f) =>
        f.apiName === 'industry'
          ? { ...f, picklistValues: ['AGRICULTURE', 'ENERGY', 'FINANCE', 'HEALTHCARE', 'TECHNOLOGY', 'BIOTECH'] }
          : f,
      ),
    }
    const report = computeDrift('conn-hs-001', 'destination',
      [HS_COMPANIES_STORED],
      [liveCompanies],
      makeCtx(['companies'], { companies: ['name', 'domain', 'industry'] }),
    )
    const added = report.changes.filter((c) => c.type === 'PICKLIST_VALUE_ADDED')
    expect(added).toHaveLength(1)
    expect(added[0].after).toBe('BIOTECH')
  })
})

// ---------------------------------------------------------------------------
// 9. severitySummary aggregation
// ---------------------------------------------------------------------------

describe('computeDrift — severitySummary', () => {
  it('correctly counts each severity bucket', () => {
    // Setup: FIELD_REMOVED (critical) + FIELD_BECAME_REQUIRED (warning) + FIELD_ADDED (info)
    const stored: SnapshotObject = {
      apiName: 'Contact',
      label: 'Contact',
      fields: [
        { apiName: 'Email',     label: 'Email',      dataType: 'email',   isRequired: false, isReadOnly: false, isUnique: true  },
        { apiName: 'FirstName', label: 'First Name', dataType: 'string',  isRequired: false, isReadOnly: false, isUnique: false },
        { apiName: 'Phone',     label: 'Phone',      dataType: 'phone',   isRequired: false, isReadOnly: false, isUnique: false },
      ],
    }
    const live: SnapshotObject = {
      apiName: 'Contact',
      label: 'Contact',
      fields: [
        { apiName: 'Email',       label: 'Email',         dataType: 'email',  isRequired: true,  isReadOnly: false, isUnique: true  }, // FIELD_BECAME_REQUIRED
        { apiName: 'FirstName',   label: 'First Name',    dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
        // Phone removed → FIELD_REMOVED (critical)
        { apiName: 'MobilePhone', label: 'Mobile Phone',  dataType: 'phone',  isRequired: false, isReadOnly: false, isUnique: false }, // FIELD_ADDED
      ],
    }
    const ctx: MappingContext = {
      mappedObjectApiNames: new Set(['Contact']),
      mappedFieldsByObject: new Map([['Contact', new Set(['Email', 'FirstName', 'Phone'])]]),
    }
    const report = computeDrift('conn-sf-001', 'source', [stored], [live], ctx)
    expect(report.severitySummary.critical).toBe(1) // FIELD_REMOVED
    expect(report.severitySummary.warning).toBe(1)  // FIELD_BECAME_REQUIRED
    expect(report.severitySummary.info).toBe(1)     // FIELD_ADDED
    expect(report.status).toBe('drift')
  })
})

// ---------------------------------------------------------------------------
// 10. FR-015 — buildUnavailableReport (graceful failure)
// ---------------------------------------------------------------------------

describe('buildUnavailableReport', () => {
  it('returns status=unavailable with reason and empty changes', () => {
    const report = buildUnavailableReport('conn-sf-001', 'source', 'Token expired — HTTP 401')
    expect(report.status).toBe('unavailable')
    expect(report.reason).toBe('Token expired — HTTP 401')
    expect(report.changes).toHaveLength(0)
    expect(report.severitySummary).toEqual({ critical: 0, warning: 0, info: 0 })
    expect(report.connectionId).toBe('conn-sf-001')
    expect(report.role).toBe('source')
    expect(report.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('reason is preserved verbatim (network-level error messages)', () => {
    const reason = 'ETIMEDOUT: connect ETIMEDOUT 104.154.101.10:443'
    const report = buildUnavailableReport('conn-hs-001', 'destination', reason)
    expect(report.reason).toBe(reason)
  })
})

// ---------------------------------------------------------------------------
// 11. FR-014 — Idempotence (pure function, no side effects)
// ---------------------------------------------------------------------------

describe('computeDrift — idempotence (FR-014)', () => {
  it('returns the same structural result when called twice with the same inputs', () => {
    const stored = [SF_ACCOUNT_STORED, HS_COMPANIES_STORED]
    const live   = [SF_ACCOUNT_LIVE_UNCHANGED, HS_COMPANIES_STORED]
    const ctx    = makeCtx()
    const r1 = computeDrift('conn-sf-001', 'source', stored, live, ctx)
    const r2 = computeDrift('conn-sf-001', 'source', stored, live, ctx)
    expect(r1.status).toBe(r2.status)
    expect(r1.changes).toHaveLength(r2.changes.length)
    expect(r1.severitySummary).toEqual(r2.severitySummary)
  })
})

// ---------------------------------------------------------------------------
// 12. Taxonomy contract — all 12 types present in DRIFT_MODIFICATION_TYPES
// ---------------------------------------------------------------------------

describe('DRIFT_MODIFICATION_TYPES taxonomy', () => {
  const EXPECTED_TYPES = [
    'OBJECT_ADDED', 'OBJECT_REMOVED',
    'FIELD_ADDED', 'FIELD_REMOVED',
    'FIELD_TYPE_CHANGED',
    'FIELD_BECAME_REQUIRED', 'FIELD_BECAME_OPTIONAL',
    'FIELD_LABEL_CHANGED',
    'PICKLIST_VALUE_ADDED', 'PICKLIST_VALUE_REMOVED',
    'FIELD_READONLY_CHANGED',
    'FIELD_UNIQUE_CHANGED',
  ]

  it('contains all 12 canonical modification types', () => {
    expect(Object.keys(DRIFT_MODIFICATION_TYPES)).toHaveLength(12)
    for (const t of EXPECTED_TYPES) {
      expect(DRIFT_MODIFICATION_TYPES).toHaveProperty(t)
    }
  })

  it('each type has a severity of info, warning, or critical', () => {
    const valid = new Set(['info', 'warning', 'critical'])
    for (const [, val] of Object.entries(DRIFT_MODIFICATION_TYPES)) {
      expect(valid.has(val.severity)).toBe(true)
    }
  })

  it('critical types are exactly: OBJECT_REMOVED, FIELD_REMOVED, FIELD_TYPE_CHANGED', () => {
    const criticalTypes = Object.entries(DRIFT_MODIFICATION_TYPES)
      .filter(([, v]) => v.severity === 'critical')
      .map(([k]) => k)
    expect(criticalTypes.sort()).toEqual(['FIELD_REMOVED', 'FIELD_TYPE_CHANGED', 'OBJECT_REMOVED'].sort())
  })
})

// ---------------------------------------------------------------------------
// 13. Regression #4 — connector reload / schema change scenario
// ---------------------------------------------------------------------------

describe('Regression recette #4 — connector reload / schema change', () => {
  it('detects the full set of changes after a Salesforce schema evolution', () => {
    // Simulates: SF admin renamed a label, added a new required field, removed a deprecated field,
    // and changed a picklist on Account — the most common real-world "connector reload" scenario.

    const storedAccount: SnapshotObject = {
      apiName: 'Account',
      label: 'Account',
      fields: [
        { apiName: 'Name',           label: 'Account Name',    dataType: 'string',   isRequired: true,  isReadOnly: false, isUnique: false },
        { apiName: 'Phone',          label: 'Account Phone',   dataType: 'phone',    isRequired: false, isReadOnly: false, isUnique: false },
        { apiName: 'Old_Status__c',  label: 'Status (Legacy)', dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false,
          picklistValues: ['Active', 'Inactive'] },
        { apiName: 'Rating',         label: 'Rating',          dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false,
          picklistValues: ['Hot', 'Warm', 'Cold'] },
      ],
    }

    const liveAccount: SnapshotObject = {
      apiName: 'Account',
      label: 'Account',
      fields: [
        { apiName: 'Name',             label: 'Account Name',    dataType: 'string',  isRequired: true,  isReadOnly: false, isUnique: false },
        { apiName: 'Phone',            label: 'Business Phone',  dataType: 'phone',   isRequired: false, isReadOnly: false, isUnique: false }, // label changed
        // Old_Status__c removed
        { apiName: 'New_Segment__c',   label: 'Segment',         dataType: 'string',  isRequired: true,  isReadOnly: false, isUnique: false }, // new required field
        { apiName: 'Rating',           label: 'Rating',          dataType: 'picklist', isRequired: false, isReadOnly: false, isUnique: false,
          picklistValues: ['Hot', 'Warm', 'Cold', 'Frozen'] }, // Frozen added
      ],
    }

    const ctx: MappingContext = {
      mappedObjectApiNames: new Set(['Account']),
      mappedFieldsByObject: new Map([['Account', new Set(['Name', 'Phone', 'Old_Status__c', 'Rating'])]]),
    }

    const report = computeDrift('conn-sf-prod', 'source', [storedAccount], [liveAccount], ctx)

    expect(report.status).toBe('drift')

    // FIELD_LABEL_CHANGED: Phone label
    expect(findChange(report, 'FIELD_LABEL_CHANGED', 'Phone')).toBeDefined()

    // FIELD_REMOVED: Old_Status__c (mapped → affectsMapping=true)
    const removedChange = findChange(report, 'FIELD_REMOVED', 'Old_Status__c')
    expect(removedChange!.severity).toBe('critical')
    expect(removedChange!.affectsMapping).toBe(true)

    // FIELD_ADDED: New_Segment__c (not yet mapped → affectsMapping=false)
    const addedChange = findChange(report, 'FIELD_ADDED', 'New_Segment__c')
    expect(addedChange!.severity).toBe('info')
    expect(addedChange!.affectsMapping).toBe(false)

    // PICKLIST_VALUE_ADDED: 'Frozen' on Rating
    const plAdded = report.changes.filter((c) => c.type === 'PICKLIST_VALUE_ADDED' && c.fieldApiName === 'Rating')
    expect(plAdded).toHaveLength(1)
    expect(plAdded[0].after).toBe('Frozen')

    // severitySummary: at least 1 critical (FIELD_REMOVED)
    expect(report.severitySummary.critical).toBeGreaterThanOrEqual(1)
  })
})
