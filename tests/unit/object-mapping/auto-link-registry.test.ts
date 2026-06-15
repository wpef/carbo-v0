import { describe, it, expect } from 'vitest'
import {
  getAutoLinkPairs,
  computeAutoLinkPairs,
} from '@/features/object-mapping/lib/auto-link-registry'

// Realistic object inventories (Principle IV — no toy fixtures).
const SF_OBJECTS = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Custom_Project__c']
const HS_OBJECTS = ['companies', 'contacts', 'deals', 'tickets', 'line_items']

describe('getAutoLinkPairs', () => {
  it('returns the Salesforce→HubSpot predictable pairs', () => {
    const pairs = getAutoLinkPairs('salesforce', 'hubspot')
    expect(pairs).toContainEqual({ sourceApiName: 'Account', destApiName: 'companies' })
    expect(pairs).toContainEqual({ sourceApiName: 'Contact', destApiName: 'contacts' })
    expect(pairs).toContainEqual({ sourceApiName: 'Opportunity', destApiName: 'deals' })
    expect(pairs).toContainEqual({ sourceApiName: 'Lead', destApiName: 'contacts' })
  })

  it('returns an empty array for an unknown adapter combination', () => {
    expect(getAutoLinkPairs('salesforce', 'salesforce')).toEqual([])
    expect(getAutoLinkPairs('zoho', 'pipedrive')).toEqual([])
  })
})

describe('computeAutoLinkPairs (registry-only, spec 011)', () => {
  it('creates every predictable pair whose objects exist on both sides', () => {
    const result = computeAutoLinkPairs('salesforce', 'hubspot', SF_OBJECTS, HS_OBJECTS)
    expect(result).toEqual([
      { sourceObjectName: 'Account', destinationObjectName: 'companies' },
      { sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
      { sourceObjectName: 'Opportunity', destinationObjectName: 'deals' },
      { sourceObjectName: 'Lead', destinationObjectName: 'contacts' },
    ])
  })

  it('regression #1: Contact→contacts is created (naive case-folded equality would miss it: "contact" !== "contacts")', () => {
    const result = computeAutoLinkPairs('salesforce', 'hubspot', ['Contact'], ['contacts'])
    expect(result).toEqual([{ sourceObjectName: 'Contact', destinationObjectName: 'contacts' }])
  })

  it('allows two distinct sources to target the same destination (Contact + Lead → contacts)', () => {
    const result = computeAutoLinkPairs('salesforce', 'hubspot', ['Contact', 'Lead'], ['contacts'])
    expect(result).toEqual([
      { sourceObjectName: 'Contact', destinationObjectName: 'contacts' },
      { sourceObjectName: 'Lead', destinationObjectName: 'contacts' },
    ])
  })

  it('skips a pair when the destination object is absent from the snapshot', () => {
    const result = computeAutoLinkPairs('salesforce', 'hubspot', ['Account'], ['contacts', 'deals'])
    expect(result).toEqual([])
  })

  it('is idempotent: already-mapped source objects are skipped', () => {
    const result = computeAutoLinkPairs('salesforce', 'hubspot', SF_OBJECTS, HS_OBJECTS, ['Account', 'Contact'])
    expect(result).toEqual([
      { sourceObjectName: 'Opportunity', destinationObjectName: 'deals' },
      { sourceObjectName: 'Lead', destinationObjectName: 'contacts' },
    ])
  })

  it('creates nothing for two systems with no predictable pairs (spec 011 edge case)', () => {
    expect(computeAutoLinkPairs('zoho', 'pipedrive', SF_OBJECTS, HS_OBJECTS)).toEqual([])
  })
})
