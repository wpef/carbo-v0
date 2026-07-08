// Unit tests for compute-unmapped.ts (port v4 → v5).
// Realistic Salesforce / HubSpot fields (Principle IV — real apiNames/types).
//
// v5 shape adaptations vs v4:
//   - input fields are UnmappedInputField { apiName, label, dataType, isRequired, isReadOnly }
//     (v4 used ConnectorField). Added isReadOnly:false everywhere except where
//     testing the required-readonly refinement explicitly.
//   - exclusions are FieldExclusionInfo { id, sourceFieldName, reason } (no createdAt in v5).
//   - v5 REFINEMENT: required dest fields counted are `isRequired && !isReadOnly`
//     (v4 did not filter isReadOnly). A required readonly dest field is NOT a
//     field-to-map. Covered by a dedicated test below.

import { describe, it, expect } from 'vitest'
import { computeUnmappedFields } from '@/features/unmapped/lib/compute-unmapped'
import type {
  UnmappedInputField,
  FieldExclusionInfo,
} from '@/features/unmapped/lib/compute-unmapped'

// ---------------------------------------------------------------------------
// Realistic Salesforce Contact source fields
// ---------------------------------------------------------------------------
const SF_CONTACT_FIELDS: UnmappedInputField[] = [
  { apiName: 'Id',            label: 'Record ID',       dataType: 'id',        isRequired: true,  isReadOnly: false },
  { apiName: 'FirstName',     label: 'First Name',      dataType: 'string',    isRequired: false, isReadOnly: false },
  { apiName: 'LastName',      label: 'Last Name',       dataType: 'string',    isRequired: true,  isReadOnly: false },
  { apiName: 'Email',         label: 'Email',           dataType: 'email',     isRequired: false, isReadOnly: false },
  { apiName: 'Phone',         label: 'Phone',           dataType: 'phone',     isRequired: false, isReadOnly: false },
  { apiName: 'Title',         label: 'Title',           dataType: 'string',    isRequired: false, isReadOnly: false },
  { apiName: 'Department',    label: 'Department',      dataType: 'string',    isRequired: false, isReadOnly: false },
  { apiName: 'OwnerId',       label: 'Owner ID',        dataType: 'reference', isRequired: true,  isReadOnly: false },
  { apiName: 'CreatedDate',   label: 'Created Date',    dataType: 'datetime',  isRequired: false, isReadOnly: true  },
  { apiName: 'SystemModstamp',label: 'System Modstamp', dataType: 'datetime',  isRequired: false, isReadOnly: true  },
]

// ---------------------------------------------------------------------------
// Realistic HubSpot contacts destination fields
// Required (isRequired && !isReadOnly) in v5: lastname, hs_lead_status.
// hs_object_id is required BUT readonly → NOT counted in v5 (was counted in v4).
// ---------------------------------------------------------------------------
const HS_CONTACT_FIELDS: UnmappedInputField[] = [
  { apiName: 'hs_object_id', label: 'Record ID',    dataType: 'number',      isRequired: true,  isReadOnly: true  },
  { apiName: 'firstname',    label: 'First Name',   dataType: 'string',      isRequired: false, isReadOnly: false },
  { apiName: 'lastname',     label: 'Last Name',    dataType: 'string',      isRequired: true,  isReadOnly: false },
  { apiName: 'email',        label: 'Email',        dataType: 'string',      isRequired: false, isReadOnly: false },
  { apiName: 'phone',        label: 'Phone Number', dataType: 'string',      isRequired: false, isReadOnly: false },
  { apiName: 'jobtitle',     label: 'Job Title',    dataType: 'string',      isRequired: false, isReadOnly: false },
  { apiName: 'department',   label: 'Department',   dataType: 'string',      isRequired: false, isReadOnly: false },
  { apiName: 'createdate',   label: 'Create Date',  dataType: 'datetime',    isRequired: false, isReadOnly: true  },
  { apiName: 'hs_lead_status',label: 'Lead Status', dataType: 'enumeration', isRequired: true,  isReadOnly: false },
]

// ---------------------------------------------------------------------------
// A minimal but complete set of mappings: SF Contact → HS contacts
// ---------------------------------------------------------------------------
const BASE_FIELD_MAPPINGS = [
  { sourceFieldName: 'FirstName',   destinationFieldName: 'firstname' },
  { sourceFieldName: 'LastName',    destinationFieldName: 'lastname' },
  { sourceFieldName: 'Email',       destinationFieldName: 'email' },
  { sourceFieldName: 'Phone',       destinationFieldName: 'phone' },
  { sourceFieldName: 'Title',       destinationFieldName: 'jobtitle' },
  { sourceFieldName: 'Department',  destinationFieldName: 'department' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeExclusion(sourceFieldName: string, reason: string | null = null): FieldExclusionInfo {
  return {
    id: `excl-${sourceFieldName.toLowerCase()}`,
    sourceFieldName,
    reason,
  }
}

// ===========================================================================
// Test suite
// ===========================================================================

describe('computeUnmappedFields — SF Contact → HS contacts', () => {

  // -------------------------------------------------------------------------
  it('empty state: no mappings, no exclusions — all source fields unmapped', () => {
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, [], [])

    expect(report.totalSourceFields).toBe(SF_CONTACT_FIELDS.length)
    expect(report.mappedSourceFields).toBe(0)
    expect(report.unmappedSourceFields.length).toBe(SF_CONTACT_FIELDS.length)
    expect(report.sourceCoverage).toBe(0)
    expect(report.isComplete).toBe(false)

    // Required AND modifiable dest fields (v5): lastname, hs_lead_status.
    // hs_object_id is required-readonly → excluded.
    expect(report.totalRequiredDestFields).toBe(2)
    expect(report.unmappedRequiredDestFields.length).toBe(2)
    expect(report.destinationRequiredCoverage).toBe(0)

    expect(report.fieldsRemainingToValidate).toBe(
      report.unmappedSourceFields.length + report.unmappedRequiredDestFields.length,
    )
    expect(report.excludedSourceFields).toEqual([])
  })

  // -------------------------------------------------------------------------
  it('v5 refinement: a required-readonly dest field is NOT counted as required-to-map', () => {
    // hs_object_id { isRequired:true, isReadOnly:true } must NOT appear in
    // unmappedRequiredDestFields and must NOT weigh on destinationRequiredCoverage.
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, [], [])

    expect(report.unmappedRequiredDestFields.map((f) => f.apiName)).not.toContain('hs_object_id')
    // Only lastname + hs_lead_status are the modifiable-required fields.
    expect(report.totalRequiredDestFields).toBe(2)

    // A dest set with ONLY a required-readonly field → 0 modifiable-required → coverage 100.
    const onlyReadonlyRequired: UnmappedInputField[] = [
      { apiName: 'hs_object_id', label: 'Record ID', dataType: 'number', isRequired: true, isReadOnly: true },
    ]
    const report2 = computeUnmappedFields(SF_CONTACT_FIELDS, onlyReadonlyRequired, [], [])
    expect(report2.totalRequiredDestFields).toBe(0)
    expect(report2.unmappedRequiredDestFields).toEqual([])
    expect(report2.destinationRequiredCoverage).toBe(100)
  })

  // -------------------------------------------------------------------------
  it('partial mappings — source coverage and unmapped source fields correct', () => {
    // Map 6 out of 10 source fields (FirstName, LastName, Email, Phone, Title, Department)
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, BASE_FIELD_MAPPINGS, [])

    expect(report.mappedSourceFields).toBe(6)
    expect(report.totalSourceFields).toBe(10)
    // sourceCoverage = 6/10 * 100 = 60
    expect(report.sourceCoverage).toBe(60)

    // Unmapped source: Id, OwnerId, CreatedDate, SystemModstamp (4 fields)
    expect(report.unmappedSourceFields.length).toBe(4)
    expect(report.unmappedSourceFields.map((f) => f.apiName)).toEqual(
      expect.arrayContaining(['Id', 'OwnerId', 'CreatedDate', 'SystemModstamp']),
    )

    // Required-and-modifiable dest: lastname, hs_lead_status (2 total).
    // lastname IS mapped; hs_lead_status is not.
    expect(report.mappedRequiredDestFields).toBe(1)
    expect(report.unmappedRequiredDestFields.length).toBe(1)
    expect(report.unmappedRequiredDestFields.map((f) => f.apiName)).toEqual(
      expect.arrayContaining(['hs_lead_status']),
    )
    expect(report.isComplete).toBe(false)
  })

  // -------------------------------------------------------------------------
  it('exclusions reduce sourceCoverage and remove fields from unmappedSourceFields', () => {
    // Map 6, exclude 2 system/audit fields → 8/10 = 80%
    const exclusions = [
      makeExclusion('CreatedDate', 'System field, not relevant for migration'),
      makeExclusion('SystemModstamp', 'System audit field'),
    ]
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, BASE_FIELD_MAPPINGS, exclusions)

    // (6 mapped + 2 excluded) / 10 = 80%
    expect(report.sourceCoverage).toBe(80)
    expect(report.excludedSourceFields.length).toBe(2)

    // Id and OwnerId remain unmapped (not excluded, not mapped)
    expect(report.unmappedSourceFields.length).toBe(2)
    expect(report.unmappedSourceFields.map((f) => f.apiName)).toEqual(
      expect.arrayContaining(['Id', 'OwnerId']),
    )

    // Excluded fields must NOT appear in unmappedSourceFields
    const unmappedApiNames = report.unmappedSourceFields.map((f) => f.apiName)
    expect(unmappedApiNames).not.toContain('CreatedDate')
    expect(unmappedApiNames).not.toContain('SystemModstamp')

    expect(report.isComplete).toBe(false)
  })

  // -------------------------------------------------------------------------
  it('isComplete = true when all source handled AND all required dest mapped', () => {
    // Map/exclude all source fields + map all required-modifiable dest fields.
    const fullMappings = [
      ...BASE_FIELD_MAPPINGS,
      // Map remaining source fields
      { sourceFieldName: 'Id',      destinationFieldName: 'hs_object_id' },
      { sourceFieldName: 'OwnerId', destinationFieldName: 'hs_lead_status' },
    ]
    const exclusions = [
      makeExclusion('CreatedDate'),
      makeExclusion('SystemModstamp'),
    ]
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, fullMappings, exclusions)

    expect(report.sourceCoverage).toBe(100)
    expect(report.destinationRequiredCoverage).toBe(100)
    expect(report.isComplete).toBe(true)
    expect(report.unmappedSourceFields).toEqual([])
    expect(report.unmappedRequiredDestFields).toEqual([])
    expect(report.fieldsRemainingToValidate).toBe(0)
  })

  // -------------------------------------------------------------------------
  it('exclusion pass-through: excludedSourceFields retains id, sourceFieldName, reason', () => {
    const exclusions: FieldExclusionInfo[] = [
      { id: 'excl-abc123', sourceFieldName: 'CreatedDate', reason: 'Read-only system field' },
    ]
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, [], exclusions)

    expect(report.excludedSourceFields).toEqual([
      { id: 'excl-abc123', sourceFieldName: 'CreatedDate', reason: 'Read-only system field' },
    ])
  })

  // -------------------------------------------------------------------------
  it('empty source fields → sourceCoverage defaults to 100 and unmappedSource is empty', () => {
    const report = computeUnmappedFields([], HS_CONTACT_FIELDS, [], [])

    expect(report.totalSourceFields).toBe(0)
    expect(report.sourceCoverage).toBe(100)
    expect(report.unmappedSourceFields).toEqual([])
  })

  // -------------------------------------------------------------------------
  it('empty dest fields → destinationRequiredCoverage defaults to 100', () => {
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, [], [], [])

    expect(report.totalRequiredDestFields).toBe(0)
    expect(report.destinationRequiredCoverage).toBe(100)
    expect(report.unmappedRequiredDestFields).toEqual([])
  })

  // -------------------------------------------------------------------------
  it('both empty → isComplete = true, all counters zero', () => {
    const report = computeUnmappedFields([], [], [], [])

    expect(report.isComplete).toBe(true)
    expect(report.sourceCoverage).toBe(100)
    expect(report.destinationRequiredCoverage).toBe(100)
    expect(report.totalSourceFields).toBe(0)
    expect(report.totalRequiredDestFields).toBe(0)
    expect(report.fieldsRemainingToValidate).toBe(0)
  })

  // -------------------------------------------------------------------------
  it('non-required (or readonly) dest fields do NOT appear in unmappedRequiredDestFields', () => {
    // Map nothing — but only required-modifiable dest fields should show up.
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, [], [])

    const unmappedDestApiNames = report.unmappedRequiredDestFields.map((f) => f.apiName)
    // Optional fields like firstname, phone, jobtitle, department must not appear
    expect(unmappedDestApiNames).not.toContain('firstname')
    expect(unmappedDestApiNames).not.toContain('phone')
    expect(unmappedDestApiNames).not.toContain('jobtitle')
    // Required-readonly (hs_object_id) must not appear either (v5 refinement)
    expect(unmappedDestApiNames).not.toContain('hs_object_id')
    // Required-modifiable ones must appear
    expect(unmappedDestApiNames).toContain('lastname')
    expect(unmappedDestApiNames).toContain('hs_lead_status')
  })

  // -------------------------------------------------------------------------
  it('fieldsRemainingToValidate = unmappedSource.length + unmappedRequiredDest.length', () => {
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, BASE_FIELD_MAPPINGS, [])

    expect(report.fieldsRemainingToValidate).toBe(
      report.unmappedSourceFields.length + report.unmappedRequiredDestFields.length,
    )
  })

  // -------------------------------------------------------------------------
  it('FieldInfo shape is correct (apiName, label, dataType, isRequired)', () => {
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, [], [])
    const ownerField = report.unmappedSourceFields.find((f) => f.apiName === 'OwnerId')
    expect(ownerField).toMatchObject({
      apiName: 'OwnerId',
      label: 'Owner ID',
      dataType: 'reference',
      isRequired: true,
    })
    // FieldInfo does NOT carry isReadOnly (dropped by toFieldInfo).
    expect(ownerField).not.toHaveProperty('isReadOnly')
  })

  // -------------------------------------------------------------------------
  it('an excluded field that is also mapped does not appear as unmapped (mapped wins in the filter)', () => {
    // Edge case where both mapped + excluded are present — the field must not
    // appear as unmapped; the exclusion is still passed through.
    const exclusions = [makeExclusion('Email', 'Excluded by mistake')]
    const mappings = [{ sourceFieldName: 'Email', destinationFieldName: 'email' }]
    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, mappings, exclusions)

    // Email is mapped → it should not appear as unmapped
    expect(report.unmappedSourceFields.map((f) => f.apiName)).not.toContain('Email')
    // mappedSourceCount must include Email
    expect(report.mappedSourceFields).toBeGreaterThanOrEqual(1)
    // Exclusion still passed through (the service layer is responsible for auto-clear)
    expect(report.excludedSourceFields.map((e) => e.sourceFieldName)).toContain('Email')
    expect(report.isComplete).toBe(false) // other fields still unmapped
  })

  // -------------------------------------------------------------------------
  describe('coverage rounding (Salesforce Opportunity → HubSpot deals)', () => {
    // 3 required-modifiable dest fields, 1 mapped → 33.33...% rounds to 33.
    // (Deal ID hs_object_id is required-readonly → NOT counted in v5.)
    const HS_DEAL_FIELDS: UnmappedInputField[] = [
      { apiName: 'hs_object_id', label: 'Deal ID',    dataType: 'number', isRequired: true,  isReadOnly: true  },
      { apiName: 'dealname',     label: 'Deal Name',  dataType: 'string', isRequired: true,  isReadOnly: false },
      { apiName: 'amount',       label: 'Amount',     dataType: 'number', isRequired: true,  isReadOnly: false },
      { apiName: 'stage',        label: 'Deal Stage', dataType: 'enumeration', isRequired: true, isReadOnly: false },
      { apiName: 'closedate',    label: 'Close Date', dataType: 'date',   isRequired: false, isReadOnly: false },
      { apiName: 'pipeline',     label: 'Pipeline',   dataType: 'string', isRequired: false, isReadOnly: false },
    ]
    const SF_OPP_FIELDS: UnmappedInputField[] = [
      { apiName: 'Id',     label: 'Record ID',        dataType: 'id',       isRequired: true,  isReadOnly: false },
      { apiName: 'Name',   label: 'Opportunity Name', dataType: 'string',   isRequired: true,  isReadOnly: false },
      { apiName: 'Amount', label: 'Amount',           dataType: 'currency', isRequired: false, isReadOnly: false },
    ]

    it('rounds destinationRequiredCoverage: 1/3 → 33', () => {
      const mappings = [{ sourceFieldName: 'Name', destinationFieldName: 'dealname' }]
      const report = computeUnmappedFields(SF_OPP_FIELDS, HS_DEAL_FIELDS, mappings, [])

      // dealname, amount, stage are required-modifiable → 3.
      expect(report.totalRequiredDestFields).toBe(3)
      expect(report.mappedRequiredDestFields).toBe(1)
      expect(report.destinationRequiredCoverage).toBe(33)
    })

    it('rounds sourceCoverage: 1/3 source fields mapped → 33', () => {
      const mappings = [{ sourceFieldName: 'Name', destinationFieldName: 'dealname' }]
      const report = computeUnmappedFields(SF_OPP_FIELDS, HS_DEAL_FIELDS, mappings, [])

      expect(report.totalSourceFields).toBe(3)
      expect(report.mappedSourceFields).toBe(1)
      expect(report.sourceCoverage).toBe(33)
    })

    it('2/3 source mapped → sourceCoverage rounds to 67', () => {
      const mappings = [
        { sourceFieldName: 'Name',   destinationFieldName: 'dealname' },
        { sourceFieldName: 'Amount', destinationFieldName: 'amount' },
      ]
      const report = computeUnmappedFields(SF_OPP_FIELDS, HS_DEAL_FIELDS, mappings, [])

      expect(report.sourceCoverage).toBe(67)
    })
  })
})
