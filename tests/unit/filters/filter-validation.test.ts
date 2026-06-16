// Unit tests for filter-validation.ts (T018)
// 015-migration-filters — Realistic Salesforce Contact field data (Principle IV)

import { describe, it, expect } from 'vitest'
import { validateFilter } from '@/features/filters/lib/filter-validation'
import type { ConnectorField } from '@/lib/types/connector'

// Realistic Salesforce Contact fields
const SF_CONTACT_FIELDS: ConnectorField[] = [
  { apiName: 'Id', label: 'Contact ID', dataType: 'id', isRequired: true, isReadOnly: true, isUnique: true },
  { apiName: 'FirstName', label: 'First Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
  { apiName: 'LastName', label: 'Last Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
  { apiName: 'Email', label: 'Email', dataType: 'email', isRequired: false, isReadOnly: false, isUnique: true },
  { apiName: 'Phone', label: 'Phone', dataType: 'phone', isRequired: false, isReadOnly: false, isUnique: false },
  { apiName: 'CreatedDate', label: 'Created Date', dataType: 'datetime', isRequired: true, isReadOnly: true, isUnique: false },
  { apiName: 'AnnualRevenue', label: 'Annual Revenue', dataType: 'currency', isRequired: false, isReadOnly: false, isUnique: false },
  { apiName: 'IsActive', label: 'Active', dataType: 'boolean', isRequired: false, isReadOnly: false, isUnique: false },
]

describe('validateFilter — hard errors', () => {
  it('returns error when fieldApiName is empty', () => {
    const result = validateFilter({ fieldApiName: '', operator: 'EQUALS', value: 'test' }, SF_CONTACT_FIELDS)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/champ source/)
  })

  it('returns error when operator is empty', () => {
    const result = validateFilter({ fieldApiName: 'Email', operator: '', value: 'test' }, SF_CONTACT_FIELDS)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/opérateur/i)
  })

  it('returns error when operator is invalid (FR-002)', () => {
    const result = validateFilter({ fieldApiName: 'Email', operator: 'BETWEEN', value: 'x' }, SF_CONTACT_FIELDS)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/invalide/)
  })

  it('returns error when source field does not exist (FR-005)', () => {
    const result = validateFilter(
      { fieldApiName: 'NonExistentField__c', operator: 'EQUALS', value: 'test' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/NonExistentField__c/)
  })

  it('returns 422-style error for missing custom field on Contact', () => {
    const result = validateFilter(
      { fieldApiName: 'CustomScore__c', operator: 'GREATER_THAN', value: '100' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain("CustomScore__c")
  })
})

describe('validateFilter — valid cases', () => {
  it('accepts EQUALS on an email field', () => {
    const result = validateFilter(
      { fieldApiName: 'Email', operator: 'EQUALS', value: '' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts NOT_EQUALS on a text field', () => {
    const result = validateFilter(
      { fieldApiName: 'LastName', operator: 'NOT_EQUALS', value: '' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
  })

  it('accepts IS_NULL on any field (no value required)', () => {
    const result = validateFilter(
      { fieldApiName: 'Phone', operator: 'IS_NULL' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeUndefined()
  })

  it('accepts DATE_AFTER on a datetime field with valid ISO date', () => {
    const result = validateFilter(
      { fieldApiName: 'CreatedDate', operator: 'DATE_AFTER', value: '2020-01-01' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeUndefined()
  })

  it('accepts DATE_BEFORE on a datetime field with valid ISO date', () => {
    const result = validateFilter(
      { fieldApiName: 'CreatedDate', operator: 'DATE_BEFORE', value: '2024-12-31' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
  })

  it('accepts GREATER_THAN on a currency field', () => {
    const result = validateFilter(
      { fieldApiName: 'AnnualRevenue', operator: 'GREATER_THAN', value: '10000' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateFilter — soft warnings', () => {
  it('warns when DATE_AFTER is used on a non-date text field', () => {
    const result = validateFilter(
      { fieldApiName: 'LastName', operator: 'DATE_AFTER', value: '2020-01-01' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeDefined()
    expect(result.warning).toMatch(/DATE_AFTER/)
  })

  it('warns when DATE_BEFORE is used on an email field', () => {
    const result = validateFilter(
      { fieldApiName: 'Email', operator: 'DATE_BEFORE', value: '2024-01-01' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeDefined()
  })

  it('warns when CONTAINS is used on a boolean field (not text-compatible)', () => {
    const result = validateFilter(
      { fieldApiName: 'IsActive', operator: 'CONTAINS', value: 'true' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeDefined()
    expect(result.warning).toMatch(/CONTAINS/)
  })

  it('warns when DATE_AFTER value is not ISO 8601 format', () => {
    const result = validateFilter(
      { fieldApiName: 'CreatedDate', operator: 'DATE_AFTER', value: '01/01/2020' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeDefined()
    expect(result.warning).toMatch(/ISO 8601/)
  })

  it('warns when DATE_BEFORE value is plain year (not ISO 8601)', () => {
    const result = validateFilter(
      { fieldApiName: 'CreatedDate', operator: 'DATE_BEFORE', value: '2024' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeDefined()
  })
})

describe('validateFilter — edge cases', () => {
  it('accepts STARTS_WITH on an email field (email is text-compatible)', () => {
    const result = validateFilter(
      { fieldApiName: 'Email', operator: 'STARTS_WITH', value: 'admin@' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.warning).toBeUndefined()
  })

  it('accepts ENDS_WITH on a phone field', () => {
    const result = validateFilter(
      { fieldApiName: 'Phone', operator: 'ENDS_WITH', value: '0000' },
      SF_CONTACT_FIELDS,
    )
    expect(result.valid).toBe(true)
  })

  it('handles empty source fields array — field not found triggers error', () => {
    const result = validateFilter(
      { fieldApiName: 'Email', operator: 'EQUALS', value: 'test@example.com' },
      [],
    )
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/Email/)
  })
})
