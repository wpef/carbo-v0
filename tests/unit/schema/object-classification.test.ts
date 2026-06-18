// Acceptance guard for the recette requirement: "custom + common business objects are
// pre-selected, system/internal objects are hidden". These pure-function tests run against
// REALISTIC Salesforce object names (a real org exposes 1000+ objects, mostly Feed/History/
// Share internals) so the classification + default-selection can't silently regress again.

import { describe, it, expect } from 'vitest'
import { categorise } from '@/features/schema/services/object-selection-service'
import { getAdapterMetadata } from '@/lib/adapters/metadata'
import { isDefaultSelected, DEFAULT_CRM_OBJECTS } from '@/lib/adapters/salesforce/salesforce-constants'

const sf = getAdapterMetadata('salesforce')
const cat = (apiName: string, isCustom = false) =>
  categorise(apiName, isCustom, sf.commonBusinessObjects, sf.systemObjectPrefixes, sf.systemObjectSuffixes)

describe('SF object classification (categorise)', () => {
  it('classifies core CRM objects as business', () => {
    for (const name of ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign']) {
      expect(cat(name)).toBe('business')
    }
  })

  it('classifies real SF internal objects (by suffix) as system', () => {
    for (const name of ['AccountFeed', 'ContactHistory', 'OpportunityShare', 'CaseChangeEvent', 'LeadTag']) {
      expect(cat(name)).toBe('system')
    }
  })

  it('classifies system objects (by prefix) as system', () => {
    for (const name of ['ApexClass', 'AuthSession', 'ContentVersion', 'FlowRecord', 'SetupAuditTrail']) {
      expect(cat(name)).toBe('system')
    }
  })

  it('classifies custom objects as custom (never system) regardless of name', () => {
    expect(cat('noodle__c', true)).toBe('custom')
    expect(cat('AccountFeed__c', true)).toBe('custom') // custom flag wins over the Feed suffix
  })

  it('a known business object beats the system heuristics', () => {
    // Campaign would otherwise risk misclassification; the common-objects list must win.
    expect(cat('Campaign')).toBe('business')
  })
})

describe('SF default selection (isDefaultSelected)', () => {
  it('pre-selects every common CRM object', () => {
    for (const name of ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign']) {
      expect(isDefaultSelected(name, false)).toBe(true)
    }
  })

  it('pre-selects custom (__c) objects', () => {
    expect(isDefaultSelected('noodle__c', true)).toBe(true)
  })

  it('does NOT pre-select internal/system objects', () => {
    for (const name of ['AccountFeed', 'ContactHistory', 'ApexClass']) {
      expect(isDefaultSelected(name, false)).toBe(false)
    }
  })
})

describe('default-selection lists are a single source of truth', () => {
  // The original bug: the schema layer (isDefaultSelected → DEFAULT_CRM_OBJECTS, 12) and the
  // selection layer (metadata.commonBusinessObjects, 6) diverged, so common objects like Contact
  // were classified but not pre-selected. This guards them as identical sets forever.
  it('metadata.commonBusinessObjects(salesforce) === DEFAULT_CRM_OBJECTS', () => {
    expect(new Set(sf.commonBusinessObjects)).toEqual(new Set(DEFAULT_CRM_OBJECTS))
  })

  it('every default-selected common object is also classified business', () => {
    for (const name of sf.commonBusinessObjects) {
      expect(cat(name)).toBe('business')
      expect(isDefaultSelected(name, false)).toBe(true)
    }
  })
})
