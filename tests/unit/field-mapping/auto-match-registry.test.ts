import { describe, it, expect } from 'vitest'
import {
  getFieldAutoMatchPairs,
  computeAutoMatchPairs,
} from '@/features/field-mapping/lib/auto-match-registry'

// Realistic Salesforce Contact / HubSpot contacts field inventories (Principle IV).
const SF_CONTACT_FIELDS = ['FirstName', 'LastName', 'Email', 'Phone', 'Title', 'Department', 'OwnerId']
const HS_CONTACT_FIELDS = ['firstname', 'lastname', 'email', 'phone', 'jobtitle', 'department', 'hs_object_id']

describe('getFieldAutoMatchPairs', () => {
  it('returns the registry pairs for SF Contact → HS contacts', () => {
    const pairs = getFieldAutoMatchPairs('salesforce', 'hubspot', 'Contact', 'contacts')
    expect(pairs).toContainEqual({ sourceFieldApiName: 'Title', destFieldApiName: 'jobtitle' })
    expect(pairs).toContainEqual({ sourceFieldApiName: 'Email', destFieldApiName: 'email' })
  })

  it('returns an empty array for an unknown object combination', () => {
    expect(getFieldAutoMatchPairs('salesforce', 'hubspot', 'Case', 'tickets')).toEqual([])
  })
})

describe('computeAutoMatchPairs (registry ∪ name-based, spec 012)', () => {
  it('matches both registry pairs (Title→jobtitle) and name-based pairs (Email→email, Department→department)', () => {
    const result = computeAutoMatchPairs(
      'salesforce', 'hubspot', 'Contact', 'contacts',
      SF_CONTACT_FIELDS, HS_CONTACT_FIELDS,
    )
    // registry-only semantic rename
    expect(result).toContainEqual({ sourceFieldName: 'Title', destinationFieldName: 'jobtitle' })
    // case-insensitive name matches
    expect(result).toContainEqual({ sourceFieldName: 'FirstName', destinationFieldName: 'firstname' })
    expect(result).toContainEqual({ sourceFieldName: 'Email', destinationFieldName: 'email' })
    expect(result).toContainEqual({ sourceFieldName: 'Phone', destinationFieldName: 'phone' })
    // name-based union for a field NOT in the registry
    expect(result).toContainEqual({ sourceFieldName: 'Department', destinationFieldName: 'department' })
    // OwnerId has no destination equivalent → unmatched
    expect(result.find((p) => p.sourceFieldName === 'OwnerId')).toBeUndefined()
  })

  it('matches case-insensitively (Phone → phone)', () => {
    const result = computeAutoMatchPairs('salesforce', 'hubspot', 'Contact', 'contacts', ['Phone'], ['phone'])
    expect(result).toEqual([{ sourceFieldName: 'Phone', destinationFieldName: 'phone' }])
  })

  it('does not double-map a destination already taken by a registry pair', () => {
    // Title→jobtitle (registry). A hypothetical source "Jobtitle" must NOT also grab "jobtitle".
    const result = computeAutoMatchPairs(
      'salesforce', 'hubspot', 'Contact', 'contacts',
      ['Title', 'Jobtitle'], ['jobtitle'],
    )
    expect(result).toEqual([{ sourceFieldName: 'Title', destinationFieldName: 'jobtitle' }])
  })

  it('is idempotent: already-mapped source and destination fields are excluded', () => {
    const result = computeAutoMatchPairs(
      'salesforce', 'hubspot', 'Contact', 'contacts',
      SF_CONTACT_FIELDS, HS_CONTACT_FIELDS,
      ['Email'], ['firstname'],
    )
    expect(result.find((p) => p.sourceFieldName === 'Email')).toBeUndefined()
    expect(result.find((p) => p.destinationFieldName === 'firstname')).toBeUndefined()
    // unaffected pairs still present
    expect(result).toContainEqual({ sourceFieldName: 'Title', destinationFieldName: 'jobtitle' })
  })

  it('falls back to pure name matching when no registry exists for the object pair', () => {
    // Case→tickets has no registry entry; only same-name fields should match.
    const result = computeAutoMatchPairs(
      'salesforce', 'hubspot', 'Case', 'tickets',
      ['Subject', 'Priority', 'Status'], ['subject', 'priority', 'content'],
    )
    expect(result).toEqual([
      { sourceFieldName: 'Subject', destinationFieldName: 'subject' },
      { sourceFieldName: 'Priority', destinationFieldName: 'priority' },
    ])
  })
})
