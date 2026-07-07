// Unit tests for type-compatibility.ts and link-status.ts (port v4 → v5).
// Realistic Salesforce / HubSpot field types (Principle IV — no lorem ipsum).
// Covers: normalisation, compatibility matrix, getSectionType, computeLinkStatus (5 états).

import { describe, it, expect } from 'vitest'
import {
  normalizeType,
  checkTypeCompatibility,
  getSectionType,
  TYPE_NORMALIZATION,
} from '@/features/field-mapping/lib/type-compatibility'
import {
  computeLinkStatus,
} from '@/features/field-mapping/lib/link-status'

// ─── normalizeType ─────────────────────────────────────────────────────────────

describe('normalizeType', () => {
  it('normalises Salesforce string → text', () => {
    expect(normalizeType('string')).toBe('text')
  })
  it('normalises Salesforce email → text', () => {
    expect(normalizeType('email')).toBe('text')
  })
  it('normalises Salesforce url → text', () => {
    expect(normalizeType('url')).toBe('text')
  })
  it('normalises Salesforce reference → text', () => {
    expect(normalizeType('reference')).toBe('text')
  })
  it('normalises Salesforce encryptedstring → text', () => {
    expect(normalizeType('encryptedstring')).toBe('text')
  })
  it('normalises Salesforce double → number', () => {
    expect(normalizeType('double')).toBe('number')
  })
  it('normalises Salesforce currency → number', () => {
    expect(normalizeType('currency')).toBe('number')
  })
  it('normalises Salesforce percent → number', () => {
    expect(normalizeType('percent')).toBe('number')
  })
  it('normalises Salesforce int → number', () => {
    expect(normalizeType('int')).toBe('number')
  })
  it('normalises Salesforce date → date', () => {
    expect(normalizeType('date')).toBe('date')
  })
  it('normalises Salesforce datetime → date', () => {
    expect(normalizeType('datetime')).toBe('date')
  })
  it('normalises Salesforce picklist → picklist', () => {
    expect(normalizeType('picklist')).toBe('picklist')
  })
  it('normalises Salesforce multipicklist → picklist', () => {
    expect(normalizeType('multipicklist')).toBe('picklist')
  })
  it('normalises Salesforce boolean → boolean', () => {
    expect(normalizeType('boolean')).toBe('boolean')
  })
  it('normalises HubSpot number → number', () => {
    expect(normalizeType('number')).toBe('number')
  })
  it('normalises HubSpot enumeration → picklist', () => {
    expect(normalizeType('enumeration')).toBe('picklist')
  })
  it('normalises HubSpot bool → boolean', () => {
    expect(normalizeType('bool')).toBe('boolean')
  })
  it('normalises HubSpot text → text', () => {
    expect(normalizeType('text')).toBe('text')
  })
  it('normalises unknown types to text (fallback)', () => {
    expect(normalizeType('geolocation')).toBe('text')
    expect(normalizeType('complextype')).toBe('text')
    expect(normalizeType('')).toBe('text')
  })
  it('is case-insensitive (mixed-case raw type)', () => {
    expect(normalizeType('String')).toBe('text')
    expect(normalizeType('PICKLIST')).toBe('picklist')
    expect(normalizeType('Double')).toBe('number')
  })
})

// ─── checkTypeCompatibility ────────────────────────────────────────────────────
// SF/HS field type pairs from real Contact→Contact, Account→companies mappings.

describe('checkTypeCompatibility', () => {
  // D4: COMPATIBLE — direct-copy pairs
  it('text → text: COMPATIBLE (SF Email string → HS email text)', () => {
    expect(checkTypeCompatibility('string', 'text')).toBe('COMPATIBLE')
  })
  it('number → number: COMPATIBLE (SF Amount double → HS amount number)', () => {
    expect(checkTypeCompatibility('double', 'number')).toBe('COMPATIBLE')
  })
  it('date → date: COMPATIBLE (SF CloseDate date → HS closedate date)', () => {
    expect(checkTypeCompatibility('date', 'date')).toBe('COMPATIBLE')
  })
  it('number → text: COMPATIBLE (SF AnnualRevenue currency → HS description text)', () => {
    expect(checkTypeCompatibility('currency', 'text')).toBe('COMPATIBLE')
  })
  it('date → text: COMPATIBLE (SF CreatedDate datetime → HS last_modified_date text)', () => {
    expect(checkTypeCompatibility('datetime', 'text')).toBe('COMPATIBLE')
  })
  it('picklist → text: COMPATIBLE (SF StageName picklist → HS dealstage text — pass-through)', () => {
    expect(checkTypeCompatibility('picklist', 'text')).toBe('COMPATIBLE')
  })
  it('boolean → text: COMPATIBLE (SF IsActive boolean → HS text)', () => {
    expect(checkTypeCompatibility('boolean', 'text')).toBe('COMPATIBLE')
  })
  it('boolean → number: COMPATIBLE (SF HasOptedOut boolean → HS number)', () => {
    expect(checkTypeCompatibility('boolean', 'number')).toBe('COMPATIBLE')
  })
  it('boolean → boolean: COMPATIBLE (SF IsActive boolean → HS is_customer bool)', () => {
    expect(checkTypeCompatibility('boolean', 'bool')).toBe('COMPATIBLE')
  })

  // D1: COMPATIBLE — value-equivalence pairs
  it('picklist → picklist: COMPATIBLE (SF LeadStatus picklist → HS lifecyclestage enumeration)', () => {
    expect(checkTypeCompatibility('picklist', 'enumeration')).toBe('COMPATIBLE')
  })
  it('picklist → boolean: COMPATIBLE (SF IsActive picklist → HS bool)', () => {
    expect(checkTypeCompatibility('picklist', 'bool')).toBe('COMPATIBLE')
  })
  it('boolean → picklist: COMPATIBLE (SF IsActive boolean → HS leadstage enumeration)', () => {
    expect(checkTypeCompatibility('boolean', 'enumeration')).toBe('COMPATIBLE')
  })

  // D2: WARNING — LLM prompt needed
  it('text → picklist: WARNING (SF FirstName string → HS salutation enumeration)', () => {
    expect(checkTypeCompatibility('string', 'enumeration')).toBe('WARNING')
  })
  it('number → picklist: WARNING (SF Rating double → HS hs_lead_status enumeration)', () => {
    expect(checkTypeCompatibility('double', 'enumeration')).toBe('WARNING')
  })
  it('date → picklist: WARNING (SF BirthDate date → HS hs_email_quarantined_reason enumeration)', () => {
    expect(checkTypeCompatibility('date', 'enumeration')).toBe('WARNING')
  })

  // D3: INCOMPATIBLE
  it('text → number: INCOMPATIBLE (SF Description textarea → HS numberofemployees number)', () => {
    expect(checkTypeCompatibility('textarea', 'number')).toBe('INCOMPATIBLE')
  })
  it('text → date: INCOMPATIBLE (SF Name string → HS closedate date)', () => {
    expect(checkTypeCompatibility('string', 'date')).toBe('INCOMPATIBLE')
  })
  it('number → date: INCOMPATIBLE (SF Amount double → HS closedate date)', () => {
    expect(checkTypeCompatibility('double', 'date')).toBe('INCOMPATIBLE')
  })
  it('text → boolean: INCOMPATIBLE (SF Title string → HS is_customer bool)', () => {
    expect(checkTypeCompatibility('string', 'bool')).toBe('INCOMPATIBLE')
  })
  it('number → boolean: INCOMPATIBLE (SF NumberOfEmployees integer → HS is_customer bool)', () => {
    expect(checkTypeCompatibility('int', 'bool')).toBe('INCOMPATIBLE')
  })
  it('date → number: INCOMPATIBLE (SF CreatedDate datetime → HS number)', () => {
    expect(checkTypeCompatibility('datetime', 'number')).toBe('INCOMPATIBLE')
  })
  it('date → boolean: INCOMPATIBLE (SF BirthDate date → HS is_customer bool)', () => {
    expect(checkTypeCompatibility('date', 'bool')).toBe('INCOMPATIBLE')
  })
  it('picklist → number: INCOMPATIBLE (SF StageName picklist → HS amount number)', () => {
    expect(checkTypeCompatibility('picklist', 'number')).toBe('INCOMPATIBLE')
  })
  it('picklist → date: INCOMPATIBLE', () => {
    expect(checkTypeCompatibility('picklist', 'date')).toBe('INCOMPATIBLE')
  })
  it('boolean → date: INCOMPATIBLE', () => {
    expect(checkTypeCompatibility('boolean', 'date')).toBe('INCOMPATIBLE')
  })
})

// ─── getSectionType ─────────────────────────────────────────────────────────────

describe('getSectionType', () => {
  // D1 — VALUE_EQUIVALENCE
  it('D1: SF StageName (picklist) → HS dealstage (enumeration)', () => {
    expect(getSectionType('picklist', 'enumeration')).toBe('VALUE_EQUIVALENCE')
  })
  it('D1: SF LeadStatus (picklist) → HS lifecyclestage (enumeration)', () => {
    expect(getSectionType('picklist', 'enumeration')).toBe('VALUE_EQUIVALENCE')
  })
  it('D1: SF HasOptedOut (boolean) → HS hs_email_optout (enumeration)', () => {
    expect(getSectionType('boolean', 'enumeration')).toBe('VALUE_EQUIVALENCE')
  })
  it('D1: SF picklist → HubSpot bool (value mapping needed)', () => {
    expect(getSectionType('picklist', 'bool')).toBe('VALUE_EQUIVALENCE')
  })
  it('D1: HubSpot enumeration → Salesforce picklist', () => {
    expect(getSectionType('enumeration', 'picklist')).toBe('VALUE_EQUIVALENCE')
  })
  it('D1: HubSpot enumeration → HubSpot bool', () => {
    expect(getSectionType('enumeration', 'bool')).toBe('VALUE_EQUIVALENCE')
  })

  // D2 — PROMPT
  it('D2: SF Name (string) → HS hs_lead_status (enumeration)', () => {
    expect(getSectionType('string', 'enumeration')).toBe('PROMPT')
  })
  it('D2: SF AnnualRevenue (double) → HS hs_lead_status (enumeration)', () => {
    expect(getSectionType('double', 'enumeration')).toBe('PROMPT')
  })
  it('D2: SF CloseDate (date) → HS hs_email_quarantined_reason (enumeration)', () => {
    expect(getSectionType('date', 'enumeration')).toBe('PROMPT')
  })
  it('D2: SF textarea → HS enumeration', () => {
    expect(getSectionType('textarea', 'enumeration')).toBe('PROMPT')
  })

  // D4 — INFORMATIONAL
  it('D4: SF FirstName (string) → HS firstname (text) — identical canonical', () => {
    expect(getSectionType('string', 'text')).toBe('INFORMATIONAL')
  })
  it('D4: SF Amount (double) → HS amount (number)', () => {
    expect(getSectionType('double', 'number')).toBe('INFORMATIONAL')
  })
  it('D4: SF CloseDate (date) → HS closedate (date)', () => {
    expect(getSectionType('date', 'date')).toBe('INFORMATIONAL')
  })
  it('D4: SF StageName (picklist) → HS dealstage (text) — pass-through copy', () => {
    expect(getSectionType('picklist', 'text')).toBe('INFORMATIONAL')
  })
  it('D4: SF IsActive (boolean) → HS text (Vrai ou Faux)', () => {
    expect(getSectionType('boolean', 'text')).toBe('INFORMATIONAL')
  })
  it('D4: SF HasOptedOut (boolean) → HS number (Vrai=>1, Faux=>0)', () => {
    expect(getSectionType('boolean', 'number')).toBe('INFORMATIONAL')
  })
  it('D4: SF IsActive (boolean) → HS is_customer (bool)', () => {
    expect(getSectionType('boolean', 'bool')).toBe('INFORMATIONAL')
  })
  it('D4: SF AnnualRevenue (currency) → HS description (text)', () => {
    expect(getSectionType('currency', 'text')).toBe('INFORMATIONAL')
  })
  it('D4: SF datetime → HS text', () => {
    expect(getSectionType('datetime', 'text')).toBe('INFORMATIONAL')
  })

  // D3 — ERROR
  it('D3: SF Description (textarea) → HS numberofemployees (number)', () => {
    expect(getSectionType('textarea', 'number')).toBe('ERROR')
  })
  it('D3: SF Name (string) → HS closedate (date)', () => {
    expect(getSectionType('string', 'date')).toBe('ERROR')
  })
  it('D3: SF Amount (double) → HS closedate (date)', () => {
    expect(getSectionType('double', 'date')).toBe('ERROR')
  })
  it('D3: SF FirstName (string) → HS is_customer (bool)', () => {
    expect(getSectionType('string', 'bool')).toBe('ERROR')
  })
  it('D3: SF NumberOfEmployees (int) → HS is_customer (bool)', () => {
    expect(getSectionType('int', 'bool')).toBe('ERROR')
  })
  it('D3: SF CloseDate (date) → HS is_customer (bool)', () => {
    expect(getSectionType('date', 'bool')).toBe('ERROR')
  })
  it('D3: SF StageName (picklist) → HS amount (number)', () => {
    expect(getSectionType('picklist', 'number')).toBe('ERROR')
  })
  it('D3: SF StageName (picklist) → HS closedate (date)', () => {
    expect(getSectionType('picklist', 'date')).toBe('ERROR')
  })
  it('D3: SF HasOptedOut (boolean) → HS closedate (date)', () => {
    expect(getSectionType('boolean', 'date')).toBe('ERROR')
  })
})

// ─── computeLinkStatus ─────────────────────────────────────────────────────────
// Tests all 5 states + precedence, using realistic SF↔HS field type pairs.

describe('computeLinkStatus', () => {
  // ── BROKEN ──────────────────────────────────────────────────────────────────
  describe('BROKEN (field absent from current schema — spec 017)', () => {
    it('both source and destination missing → BROKEN', () => {
      const result = computeLinkStatus('string', 'text', null, false, false)
      expect(result.linkStatus).toBe('BROKEN')
      expect(result.statusDetail).toMatch(/source et destination/)
    })
    it('source field missing → BROKEN', () => {
      const result = computeLinkStatus('picklist', 'enumeration', null, false, true)
      expect(result.linkStatus).toBe('BROKEN')
      expect(result.statusDetail).toMatch(/source/)
    })
    it('destination field missing → BROKEN', () => {
      const result = computeLinkStatus('string', 'text', null, true, false)
      expect(result.linkStatus).toBe('BROKEN')
      expect(result.statusDetail).toMatch(/destination/)
    })
    it('BROKEN takes precedence over D3 (ERROR section type + dest missing)', () => {
      // Incompatible types AND missing destination → BROKEN wins (highest precedence)
      const result = computeLinkStatus('string', 'bool', null, true, false)
      expect(result.linkStatus).toBe('BROKEN')
    })
    it('BROKEN takes precedence over D4 (INFORMATIONAL + source missing)', () => {
      const result = computeLinkStatus('string', 'text', null, false, true)
      expect(result.linkStatus).toBe('BROKEN')
    })
  })

  // ── RED_DASHED ───────────────────────────────────────────────────────────────
  describe('RED_DASHED (D3 — incompatible types)', () => {
    it('SF Description (textarea) → HS number: RED_DASHED', () => {
      expect(computeLinkStatus('textarea', 'number', null).linkStatus).toBe('RED_DASHED')
    })
    it('SF Name (string) → HS closedate (date): RED_DASHED', () => {
      expect(computeLinkStatus('string', 'date', null).linkStatus).toBe('RED_DASHED')
    })
    it('SF picklist → HS date: RED_DASHED even with a VALIDATED logic', () => {
      // D3 always returns RED_DASHED — no logic can fix incompatibility
      const logic = { status: 'VALIDATED' as const }
      expect(computeLinkStatus('picklist', 'date', logic).linkStatus).toBe('RED_DASHED')
    })
    it('SF string → HS bool: RED_DASHED', () => {
      expect(computeLinkStatus('string', 'bool', null).linkStatus).toBe('RED_DASHED')
    })
  })

  // ── RED_SOLID ────────────────────────────────────────────────────────────────
  describe('RED_SOLID (D1/D2 — config required, not started)', () => {
    it('SF StageName (picklist) → HS dealstage (enumeration) with no logic → RED_SOLID', () => {
      expect(computeLinkStatus('picklist', 'enumeration', null).linkStatus).toBe('RED_SOLID')
    })
    it('SF LeadSource (string) → HS lead_source (enumeration) with no logic → RED_SOLID', () => {
      expect(computeLinkStatus('string', 'enumeration', null).linkStatus).toBe('RED_SOLID')
    })
    it('DRAFT logic → RED_SOLID (same as no logic)', () => {
      const draftLogic = { status: 'DRAFT' as const }
      expect(computeLinkStatus('picklist', 'enumeration', draftLogic).linkStatus).toBe('RED_SOLID')
    })
    it('D2: text → enumeration, no logic → RED_SOLID', () => {
      expect(computeLinkStatus('string', 'enumeration', null).linkStatus).toBe('RED_SOLID')
    })
  })

  // ── ORANGE ───────────────────────────────────────────────────────────────────
  describe('ORANGE (D1/D2 — logic DEFINED, not yet validated)', () => {
    it('D2 PROMPT — DEFINED logic → ORANGE (SF Description → HS lead_source enumeration)', () => {
      const logic = { status: 'DEFINED' as const }
      expect(computeLinkStatus('string', 'enumeration', logic).linkStatus).toBe('ORANGE')
    })
    it('D1 VALUE_EQUIVALENCE — DEFINED, all values mapped → ORANGE (not yet VALIDATED)', () => {
      const logic = {
        status: 'DEFINED' as const,
        sourceValues: ['Open', 'Closed', 'Pending'],
        destValues: ['new', 'closed', 'in_progress'],
        mappedSourceValues: ['Open', 'Closed', 'Pending'],
      }
      expect(computeLinkStatus('picklist', 'enumeration', logic).linkStatus).toBe('ORANGE')
    })
    it('D1 VALUE_EQUIVALENCE — DEFINED with 1 source value unmapped → ORANGE', () => {
      // SF StageName picklist has Prospecting/Qualification/Closed Won; only 2 mapped
      const logic = {
        status: 'DEFINED' as const,
        sourceValues: ['Prospecting', 'Qualification', 'Closed Won'],
        destValues: ['appointmentscheduled', 'qualifiedtobuy', 'closedwon'],
        mappedSourceValues: ['Prospecting', 'Qualification'],
      }
      const result = computeLinkStatus('picklist', 'enumeration', logic)
      expect(result.linkStatus).toBe('ORANGE')
      expect(result.statusDetail).toMatch(/1 valeur source/)
    })
    it('D1 VALUE_EQUIVALENCE — DEFINED with multiple source values unmapped → ORANGE with detail', () => {
      const logic = {
        status: 'DEFINED' as const,
        sourceValues: ['Open', 'Pending', 'Closed', 'Lost'],
        destValues: ['new', 'closed'],
        mappedSourceValues: ['Open'],
      }
      const result = computeLinkStatus('picklist', 'enumeration', logic)
      expect(result.linkStatus).toBe('ORANGE')
      expect(result.statusDetail).toMatch(/3 valeurs source/)
    })
  })

  // ── GREEN ─────────────────────────────────────────────────────────────────────
  describe('GREEN (validated or D4 auto-validated)', () => {
    it('D4 INFORMATIONAL — no logic needed → GREEN (SF FirstName string → HS firstname text)', () => {
      expect(computeLinkStatus('string', 'text', null).linkStatus).toBe('GREEN')
    })
    it('D4 INFORMATIONAL — SF Amount (double) → HS amount (number)', () => {
      expect(computeLinkStatus('double', 'number', null).linkStatus).toBe('GREEN')
    })
    it('D4 INFORMATIONAL — SF HasOptedOut (boolean) → HS is_customer (bool)', () => {
      expect(computeLinkStatus('boolean', 'bool', null).linkStatus).toBe('GREEN')
    })
    it('D4 INFORMATIONAL — picklist → text pass-through', () => {
      expect(computeLinkStatus('picklist', 'text', null).linkStatus).toBe('GREEN')
    })
    it('D2 PROMPT — VALIDATED → GREEN (SF Description → HS lead_source enumeration)', () => {
      const logic = { status: 'VALIDATED' as const }
      expect(computeLinkStatus('string', 'enumeration', logic).linkStatus).toBe('GREEN')
    })
    it('D1 VALUE_EQUIVALENCE — VALIDATED, all source values mapped → GREEN', () => {
      // SF StageName → HS dealstage fully mapped and VALIDATED
      const logic = {
        status: 'VALIDATED' as const,
        sourceValues: ['Prospecting', 'Qualification', 'Closed Won'],
        destValues: ['appointmentscheduled', 'qualifiedtobuy', 'closedwon'],
        mappedSourceValues: ['Prospecting', 'Qualification', 'Closed Won'],
      }
      expect(computeLinkStatus('picklist', 'enumeration', logic).linkStatus).toBe('GREEN')
    })
    it('D1 VALUE_EQUIVALENCE — VALIDATED without completeness data → GREEN (trust the status)', () => {
      const logic = { status: 'VALIDATED' as const }
      expect(computeLinkStatus('picklist', 'enumeration', logic).linkStatus).toBe('GREEN')
    })
  })

  // ── Precedence regression (spec 012 §Precedence) ─────────────────────────────
  describe('Precedence: BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN', () => {
    it('BROKEN > RED_DASHED: missing field + incompatible types → BROKEN', () => {
      const result = computeLinkStatus('textarea', 'number', null, false, true)
      expect(result.linkStatus).toBe('BROKEN')
    })
    it('BROKEN > RED_SOLID: missing field + no logic (D1) → BROKEN', () => {
      const result = computeLinkStatus('picklist', 'enumeration', null, false, true)
      expect(result.linkStatus).toBe('BROKEN')
    })
    it('BROKEN > GREEN: missing field + D4 informational → BROKEN', () => {
      const result = computeLinkStatus('string', 'text', null, true, false)
      expect(result.linkStatus).toBe('BROKEN')
    })
    it('RED_DASHED always returned for D3 regardless of logic status', () => {
      const logic = { status: 'VALIDATED' as const }
      expect(computeLinkStatus('int', 'bool', logic).linkStatus).toBe('RED_DASHED')
    })
  })
})

// ─── TYPE_NORMALIZATION coverage ───────────────────────────────────────────────
// Quick snapshot to catch any accidental deletions from the map.

describe('TYPE_NORMALIZATION exhaustiveness', () => {
  const SF_TYPES = ['string', 'textarea', 'url', 'email', 'phone', 'id', 'reference',
    'address', 'encryptedstring', 'int', 'double', 'currency', 'percent', 'long',
    'date', 'datetime', 'time', 'picklist', 'multipicklist', 'combobox', 'boolean']
  const HS_TYPES = ['text', 'number', 'enumeration', 'bool']

  for (const t of SF_TYPES) {
    it(`SF type "${t}" is present in TYPE_NORMALIZATION`, () => {
      expect(TYPE_NORMALIZATION).toHaveProperty(t)
    })
  }

  for (const t of HS_TYPES) {
    it(`HS type "${t}" is present in TYPE_NORMALIZATION`, () => {
      expect(TYPE_NORMALIZATION).toHaveProperty(t)
    })
  }
})
