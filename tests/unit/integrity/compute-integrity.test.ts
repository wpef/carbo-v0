// Unit tests for compute-integrity.ts — the PURE core of the integrity check
// (02-domain-rules rule 8). No DB, no I/O. Covers the 3 ERROR issue types
// (BROKEN_REFERENCE, INCOMPATIBLE_TYPE, INVALID_FILTER) and computePlanStatus.
//
// Realistic Salesforce → HubSpot schemas (Principle IV — real apiNames/types).

import { describe, it, expect } from 'vitest'
import {
  computeIntegrityIssues,
  computePlanStatus,
} from '@/features/integrity/lib/compute-integrity'
import type {
  IntegrityObjectSchema,
  IntegrityObjectMapping,
} from '@/features/integrity/lib/compute-integrity'

// ---------------------------------------------------------------------------
// Baseline CURRENT schemas: SF Contact source, HS contacts destination.
// ---------------------------------------------------------------------------
const SOURCE_OBJECTS: IntegrityObjectSchema[] = [
  {
    apiName: 'Contact',
    fields: [
      { apiName: 'FirstName', dataType: 'string' },
      { apiName: 'LastName',  dataType: 'string' },
      { apiName: 'Email',     dataType: 'email' },
      { apiName: 'NumberOfEmployees', dataType: 'int' },
      { apiName: 'CreatedDate', dataType: 'datetime' },
    ],
  },
]

const DEST_OBJECTS: IntegrityObjectSchema[] = [
  {
    apiName: 'contacts',
    fields: [
      { apiName: 'firstname', dataType: 'string' },
      { apiName: 'lastname',  dataType: 'string' },
      { apiName: 'email',     dataType: 'string' },
      { apiName: 'num_employees', dataType: 'number' },
      { apiName: 'createdate', dataType: 'datetime' },
    ],
  },
]

// A healthy mapping: every object/field exists, types are compatible,
// the filter references an existing source field.
function healthyMapping(): IntegrityObjectMapping {
  return {
    id: 'om-1',
    sourceObjectName: 'Contact',
    destinationObjectName: 'contacts',
    fieldMappings: [
      { id: 'fm-1', sourceFieldName: 'FirstName', destinationFieldName: 'firstname', sourceFieldType: 'string', destinationFieldType: 'string' },
      { id: 'fm-2', sourceFieldName: 'LastName',  destinationFieldName: 'lastname',  sourceFieldType: 'string', destinationFieldType: 'string' },
      { id: 'fm-3', sourceFieldName: 'Email',     destinationFieldName: 'email',     sourceFieldType: 'email',  destinationFieldType: 'string' },
    ],
    filters: [
      { id: 'flt-1', fieldApiName: 'LastName' },
    ],
  }
}

// ===========================================================================
// computeIntegrityIssues
// ===========================================================================

describe('computeIntegrityIssues', () => {

  // -------------------------------------------------------------------------
  it('healthy plan (all exists, compatible types, valid filters) → no issues', () => {
    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [healthyMapping()])
    expect(issues).toEqual([])
  })

  // ─── BROKEN_REFERENCE — object level ───────────────────────────────────────

  it('missing source object → 1 BROKEN_REFERENCE (OBJECT_MAPPING), no field checks', () => {
    const om = healthyMapping()
    om.sourceObjectName = 'Ghost' // absent from source schema
    // Add a filter + a doomed field mapping that would otherwise raise issues —
    // they must be SKIPPED because we `continue` on the object break.
    om.fieldMappings.push({ id: 'fm-x', sourceFieldName: 'Nope', destinationFieldName: 'nope', sourceFieldType: 'string', destinationFieldType: 'string' })
    om.filters.push({ id: 'flt-x', fieldApiName: 'AlsoNope' })

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      entityType: 'OBJECT_MAPPING',
      entityId: 'om-1',
      issueType: 'BROKEN_REFERENCE',
      severity: 'ERROR',
    })
    // No FIELD_MAPPING / MIGRATION_FILTER issues emitted for this mapping.
    expect(issues.some((i) => i.entityType === 'FIELD_MAPPING')).toBe(false)
    expect(issues.some((i) => i.entityType === 'MIGRATION_FILTER')).toBe(false)
  })

  it('missing destination object → 1 BROKEN_REFERENCE (OBJECT_MAPPING), no field checks', () => {
    const om = healthyMapping()
    om.destinationObjectName = 'phantom' // absent from dest schema
    om.fieldMappings.push({ id: 'fm-x', sourceFieldName: 'Nope', destinationFieldName: 'nope', sourceFieldType: 'string', destinationFieldType: 'string' })

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      entityType: 'OBJECT_MAPPING',
      entityId: 'om-1',
      issueType: 'BROKEN_REFERENCE',
      severity: 'ERROR',
    })
    expect(issues.some((i) => i.entityType === 'FIELD_MAPPING')).toBe(false)
  })

  // ─── BROKEN_REFERENCE — field level ─────────────────────────────────────────

  it('missing source field → BROKEN_REFERENCE (FIELD_MAPPING)', () => {
    const om = healthyMapping()
    om.fieldMappings = [
      { id: 'fm-gone', sourceFieldName: 'Phone', destinationFieldName: 'firstname', sourceFieldType: 'phone', destinationFieldType: 'string' },
    ]
    om.filters = []

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      entityType: 'FIELD_MAPPING',
      entityId: 'fm-gone',
      issueType: 'BROKEN_REFERENCE',
      severity: 'ERROR',
    })
  })

  it('missing destination field → BROKEN_REFERENCE (FIELD_MAPPING)', () => {
    const om = healthyMapping()
    om.fieldMappings = [
      { id: 'fm-gone', sourceFieldName: 'FirstName', destinationFieldName: 'nickname', sourceFieldType: 'string', destinationFieldType: 'string' },
    ]
    om.filters = []

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      entityType: 'FIELD_MAPPING',
      entityId: 'fm-gone',
      issueType: 'BROKEN_REFERENCE',
      severity: 'ERROR',
    })
  })

  it('both source AND destination field missing → two BROKEN_REFERENCE (one per side)', () => {
    const om = healthyMapping()
    om.fieldMappings = [
      { id: 'fm-both', sourceFieldName: 'Ghost', destinationFieldName: 'phantom', sourceFieldType: 'string', destinationFieldType: 'string' },
    ]
    om.filters = []

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    const brokenFieldIssues = issues.filter(
      (i) => i.entityType === 'FIELD_MAPPING' && i.issueType === 'BROKEN_REFERENCE',
    )
    expect(brokenFieldIssues).toHaveLength(2)
    expect(brokenFieldIssues.every((i) => i.entityId === 'fm-both')).toBe(true)
    // No INCOMPATIBLE_TYPE emitted when a side is missing (guarded by srcExists && dstExists).
    expect(issues.some((i) => i.issueType === 'INCOMPATIBLE_TYPE')).toBe(false)
  })

  // ─── INCOMPATIBLE_TYPE ──────────────────────────────────────────────────────

  it('incompatible types (text → number) → INCOMPATIBLE_TYPE', () => {
    // Map a string source field onto the number dest field num_employees.
    const om = healthyMapping()
    om.fieldMappings = [
      { id: 'fm-bad', sourceFieldName: 'FirstName', destinationFieldName: 'num_employees', sourceFieldType: 'string', destinationFieldType: 'number' },
    ]
    om.filters = []

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      entityType: 'FIELD_MAPPING',
      entityId: 'fm-bad',
      issueType: 'INCOMPATIBLE_TYPE',
      severity: 'ERROR',
    })
  })

  it('compatible types (number → number, string → string) → no INCOMPATIBLE_TYPE', () => {
    const om = healthyMapping()
    om.fieldMappings = [
      { id: 'fm-num', sourceFieldName: 'NumberOfEmployees', destinationFieldName: 'num_employees', sourceFieldType: 'int', destinationFieldType: 'number' },
      { id: 'fm-str', sourceFieldName: 'FirstName',         destinationFieldName: 'firstname',     sourceFieldType: 'string', destinationFieldType: 'string' },
    ]
    om.filters = []

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])
    expect(issues).toEqual([])
  })

  it('type incompatibility uses the CURRENT snapshot types, not the stored fieldMapping types', () => {
    // Stored types claim string→string (compatible), but the CURRENT source schema
    // says NumberOfEmployees is `int` and dest num_employees is not text-compatible.
    // int (number) → number is COMPATIBLE, so pick a genuinely incompatible current pair:
    // current source Email is `email` (→ text), current dest num_employees is `number`.
    const om = healthyMapping()
    om.fieldMappings = [
      { id: 'fm-drift', sourceFieldName: 'Email', destinationFieldName: 'num_employees', sourceFieldType: 'number', destinationFieldType: 'number' },
    ]
    om.filters = []

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    // Despite stored types being number→number (compatible), CURRENT is text→number → INCOMPATIBLE.
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ issueType: 'INCOMPATIBLE_TYPE', entityId: 'fm-drift' })
  })

  it('picklist → picklist is COMPATIBLE → no issue', () => {
    const src: IntegrityObjectSchema[] = [
      { apiName: 'Lead', fields: [{ apiName: 'Status', dataType: 'picklist' }] },
    ]
    const dst: IntegrityObjectSchema[] = [
      { apiName: 'leads', fields: [{ apiName: 'hs_lead_status', dataType: 'enumeration' }] },
    ]
    const om: IntegrityObjectMapping = {
      id: 'om-lead',
      sourceObjectName: 'Lead',
      destinationObjectName: 'leads',
      fieldMappings: [
        { id: 'fm-pick', sourceFieldName: 'Status', destinationFieldName: 'hs_lead_status', sourceFieldType: 'picklist', destinationFieldType: 'enumeration' },
      ],
      filters: [],
    }

    const issues = computeIntegrityIssues(src, dst, [om])
    expect(issues).toEqual([])
  })

  // ─── INVALID_FILTER ─────────────────────────────────────────────────────────

  it('filter referencing a vanished source field → INVALID_FILTER', () => {
    const om = healthyMapping()
    om.filters = [{ id: 'flt-bad', fieldApiName: 'MiddleName' }] // not in Contact schema

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])

    const filterIssues = issues.filter((i) => i.entityType === 'MIGRATION_FILTER')
    expect(filterIssues).toHaveLength(1)
    expect(filterIssues[0]).toMatchObject({
      entityType: 'MIGRATION_FILTER',
      entityId: 'flt-bad',
      issueType: 'INVALID_FILTER',
      severity: 'ERROR',
    })
  })

  it('filter on an existing source field → no INVALID_FILTER', () => {
    const om = healthyMapping()
    om.filters = [{ id: 'flt-ok', fieldApiName: 'Email' }] // exists in Contact schema

    const issues = computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [om])
    expect(issues.some((i) => i.entityType === 'MIGRATION_FILTER')).toBe(false)
    expect(issues).toEqual([])
  })

  // -------------------------------------------------------------------------
  it('empty mappings → no issues', () => {
    expect(computeIntegrityIssues(SOURCE_OBJECTS, DEST_OBJECTS, [])).toEqual([])
  })
})

// ===========================================================================
// computePlanStatus
// ===========================================================================

describe('computePlanStatus', () => {

  it('errorCount > 0 → BROKEN', () => {
    expect(computePlanStatus({ errorCount: 1, currentStep: 'MAPPING', hasMappedPair: true })).toBe('BROKEN')
  })

  it('errorCount > 0 primes even at DOCUMENTS with a mapped pair → BROKEN', () => {
    expect(computePlanStatus({ errorCount: 3, currentStep: 'DOCUMENTS', hasMappedPair: true })).toBe('BROKEN')
  })

  it('no errors + DOCUMENTS + hasMappedPair → READY', () => {
    expect(computePlanStatus({ errorCount: 0, currentStep: 'DOCUMENTS', hasMappedPair: true })).toBe('READY')
  })

  it('DOCUMENTS but no mapped pair → DRAFT', () => {
    expect(computePlanStatus({ errorCount: 0, currentStep: 'DOCUMENTS', hasMappedPair: false })).toBe('DRAFT')
  })

  it('non-DOCUMENTS step (with mapped pair, no errors) → DRAFT', () => {
    expect(computePlanStatus({ errorCount: 0, currentStep: 'MAPPING', hasMappedPair: true })).toBe('DRAFT')
  })

  it('non-DOCUMENTS step without mapped pair → DRAFT', () => {
    expect(computePlanStatus({ errorCount: 0, currentStep: 'CONNECT', hasMappedPair: false })).toBe('DRAFT')
  })
})
