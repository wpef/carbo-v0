// Tests unitaires — 018-rule-description-engine
// Données réalistes Salesforce/HubSpot (Constitution Principe IV)

import { describe, it, expect } from 'vitest'
import {
  describeDirectCopy,
  describeValueEquivalence,
  describeInformational,
  describeError,
  describeIncompatible,
  describePromptFallback,
  describeUnknown,
  describeRule,
  type ValueEquivalencePair,
  type RuleDescriptionInput,
} from '@/features/documents/lib/rule-description'

// ---------------------------------------------------------------------------
// describeDirectCopy
// ---------------------------------------------------------------------------

describe('describeDirectCopy', () => {
  it('same type → copie directe', () => {
    expect(describeDirectCopy('text', 'text')).toBe('Copie directe (text → text)')
  })

  it('different types → conversion', () => {
    // SF Phone (phone) → HubSpot phonenumber (string) — types differ
    expect(describeDirectCopy('phone', 'string')).toBe('Copie avec conversion de type (phone → string)')
  })

  it('textarea → text (common SF→HS widening)', () => {
    expect(describeDirectCopy('textarea', 'text')).toBe('Copie avec conversion de type (textarea → text)')
  })

  it('unknown source type falls back to "unknown"', () => {
    expect(describeDirectCopy(null, 'text')).toBe('Copie avec conversion de type (unknown → text)')
  })

  it('unknown dest type falls back to "unknown"', () => {
    expect(describeDirectCopy('text', undefined)).toBe('Copie avec conversion de type (text → unknown)')
  })

  it('both null/undefined → Copie directe (unknown → unknown)', () => {
    expect(describeDirectCopy(null, null)).toBe('Copie directe (unknown → unknown)')
  })
})

// ---------------------------------------------------------------------------
// describeValueEquivalence
// ---------------------------------------------------------------------------

describe('describeValueEquivalence', () => {
  it('empty list → no equivalences defined', () => {
    expect(describeValueEquivalence([])).toBe('No value equivalences have been defined.')
  })

  it('3 fully-mapped pairs (SF LeadSource → HS hs_lead_source)', () => {
    const pairs: ValueEquivalencePair[] = [
      { sourceValue: 'Web', destinationValue: 'ONLINE' },
      { sourceValue: 'Phone Inquiry', destinationValue: 'PHONE' },
      { sourceValue: 'Partner Referral', destinationValue: 'PARTNER' },
    ]
    const result = describeValueEquivalence(pairs)
    expect(result).toContain("'Web' becomes 'ONLINE'")
    expect(result).toContain("'Phone Inquiry' becomes 'PHONE'")
    expect(result).toContain("'Partner Referral' becomes 'PARTNER'")
    // No "and N more"
    expect(result).not.toContain('more equivalence')
  })

  it('exactly 5 pairs (MAX_LISTED) — no "and N more"', () => {
    const pairs: ValueEquivalencePair[] = [
      { sourceValue: 'Cold', destinationValue: 'COLD' },
      { sourceValue: 'Warm', destinationValue: 'WARM' },
      { sourceValue: 'Hot', destinationValue: 'HOT' },
      { sourceValue: 'Qualified', destinationValue: 'QUALIFIED' },
      { sourceValue: 'Unqualified', destinationValue: 'UNQUALIFIED' },
    ]
    const result = describeValueEquivalence(pairs)
    expect(result).not.toContain('more equivalence')
  })

  it('12 pairs → first 5 listed + "and 7 more equivalences"', () => {
    const pairs: ValueEquivalencePair[] = Array.from({ length: 12 }, (_, i) => ({
      sourceValue: `Source${i + 1}`,
      destinationValue: `Dest${i + 1}`,
    }))
    const result = describeValueEquivalence(pairs)
    expect(result).toContain('and 7 more equivalences.')
    expect(result).toContain("'Source1' becomes 'Dest1'")
    expect(result).not.toContain("'Source6'")
  })

  it('1 unmapped source value → singular grammar', () => {
    const pairs: ValueEquivalencePair[] = [
      { sourceValue: 'Active', destinationValue: 'ACTIVE' },
      { sourceValue: 'Legacy', destinationValue: '' }, // no dest mapping
    ]
    const result = describeValueEquivalence(pairs)
    expect(result).toContain('1 source value has no destination equivalent.')
  })

  it('3 unmapped source values → plural grammar', () => {
    const pairs: ValueEquivalencePair[] = [
      { sourceValue: 'A', destinationValue: 'a' },
      { sourceValue: 'B', destinationValue: '' },
      { sourceValue: 'C', destinationValue: '' },
      { sourceValue: 'D', destinationValue: '' },
    ]
    const result = describeValueEquivalence(pairs)
    expect(result).toContain('3 source values have no destination equivalent.')
  })

  it('all unmapped → only the unmapped note (no "becomes" clauses)', () => {
    const pairs: ValueEquivalencePair[] = [
      { sourceValue: 'X', destinationValue: '' },
      { sourceValue: 'Y', destinationValue: '' },
    ]
    const result = describeValueEquivalence(pairs)
    // No mapped pairs listed
    expect(result).not.toContain('becomes')
    expect(result).toContain('2 source values have no destination equivalent.')
  })
})

// ---------------------------------------------------------------------------
// describeInformational
// ---------------------------------------------------------------------------

describe('describeInformational', () => {
  it('message present → returned verbatim', () => {
    const msg = 'The value of SF Stage will be set to "Imported" in HubSpot deal stage.'
    expect(describeInformational(msg)).toBe(msg)
  })

  it('null → default fallback', () => {
    expect(describeInformational(null)).toBe('The value will be copied directly.')
  })

  it('empty string → default fallback', () => {
    expect(describeInformational('')).toBe('The value will be copied directly.')
  })

  it('whitespace-only → default fallback', () => {
    expect(describeInformational('   ')).toBe('The value will be copied directly.')
  })

  it('message with leading/trailing whitespace is trimmed', () => {
    expect(describeInformational('  Notes are copied as-is.  ')).toBe('Notes are copied as-is.')
  })
})

// ---------------------------------------------------------------------------
// describeError / describeIncompatible
// ---------------------------------------------------------------------------

describe('describeError', () => {
  it('with both types → includes type pair in the message', () => {
    // SF Currency → HubSpot number (incompatible in strict mode)
    const result = describeError('currency', 'number')
    expect(result).toContain('currency → number')
    expect(result).toContain('WARNING')
    expect(result).toContain('CSV')
  })

  it('without types → generic warning', () => {
    const result = describeError(null, null)
    expect(result).toContain('WARNING')
    expect(result).not.toContain('undefined')
    expect(result).not.toContain('null')
  })

  it('source type only, dest null → generic warning', () => {
    const result = describeError('multipicklist', null)
    expect(result).not.toContain('multipicklist →')
    expect(result).toContain('WARNING')
  })
})

describe('describeIncompatible', () => {
  it('delegates to describeError — same output', () => {
    expect(describeIncompatible('picklist', 'text')).toBe(describeError('picklist', 'text'))
  })

  it('null inputs — same as describeError(null, null)', () => {
    expect(describeIncompatible(null, null)).toBe(describeError(null, null))
  })
})

// ---------------------------------------------------------------------------
// describePromptFallback
// ---------------------------------------------------------------------------

describe('describePromptFallback', () => {
  it('prompt present → appends "(requires review)"', () => {
    const prompt = 'Classify the HubSpot lifecycle stage based on the SF lead status value.'
    const result = describePromptFallback(prompt)
    expect(result).toBe(`${prompt} (requires review)`)
  })

  it('empty prompt → no API call + specific fallback message', () => {
    expect(describePromptFallback('')).toBe('No classification prompt defined. (requires review)')
  })

  it('null → fallback message', () => {
    expect(describePromptFallback(null)).toBe('No classification prompt defined. (requires review)')
  })

  it('prompt with surrounding whitespace is trimmed', () => {
    const result = describePromptFallback('  Map deal type to opportunity type.  ')
    expect(result).toBe('Map deal type to opportunity type. (requires review)')
  })
})

// ---------------------------------------------------------------------------
// describeUnknown
// ---------------------------------------------------------------------------

describe('describeUnknown', () => {
  it('returns the canonical fallback string', () => {
    expect(describeUnknown()).toBe('Unknown migration logic type — requires review.')
  })
})

// ---------------------------------------------------------------------------
// describeRule — dispatcher unifié
// ---------------------------------------------------------------------------

describe('describeRule', () => {
  it('DIRECT_COPY same type → template source', () => {
    const out = describeRule({ ruleType: 'DIRECT_COPY', sourceDataType: 'text', destDataType: 'text' })
    expect(out.source).toBe('template')
    expect(out.description).toContain('Copie directe')
  })

  it('DIRECT_COPY different type → template source', () => {
    // SF datetime → HubSpot date (common in deal close date migration)
    const out = describeRule({ ruleType: 'DIRECT_COPY', sourceDataType: 'datetime', destDataType: 'date' })
    expect(out.source).toBe('template')
    expect(out.description).toContain('conversion')
  })

  it('VALUE_EQUIVALENCE with SF StageName → HubSpot dealstage pairs', () => {
    const input: RuleDescriptionInput = {
      ruleType: 'VALUE_EQUIVALENCE',
      valueEquivalences: [
        { sourceValue: 'Prospecting', destinationValue: 'appointmentscheduled' },
        { sourceValue: 'Qualification', destinationValue: 'qualifiedtobuy' },
        { sourceValue: 'Needs Analysis', destinationValue: 'presentationscheduled' },
        { sourceValue: 'Proposal/Price Quote', destinationValue: 'decisionmakerboughtin' },
        { sourceValue: 'Closed Won', destinationValue: 'closedwon' },
        { sourceValue: 'Closed Lost', destinationValue: 'closedlost' },
      ],
    }
    const out = describeRule(input)
    expect(out.source).toBe('template')
    expect(out.description).toContain("'Prospecting' becomes 'appointmentscheduled'")
    expect(out.description).toContain('and 1 more equivalence.')
  })

  it('INFORMATIONAL with hs_lead_status note', () => {
    const out = describeRule({
      ruleType: 'INFORMATIONAL',
      informationalMessage: 'The contact lead status is reset to "New" upon import into HubSpot.',
    })
    expect(out.source).toBe('template')
    expect(out.description).toContain('reset to "New"')
  })

  it('INFORMATIONAL with null message → default fallback', () => {
    const out = describeRule({ ruleType: 'INFORMATIONAL', informationalMessage: null })
    expect(out.source).toBe('template')
    expect(out.description).toBe('The value will be copied directly.')
  })

  it('ERROR with SF multipicklist → HubSpot enumeration', () => {
    const out = describeRule({
      ruleType: 'ERROR',
      sourceType: 'multipicklist',
      destType: 'enumeration',
    })
    expect(out.source).toBe('template')
    expect(out.description).toContain('multipicklist → enumeration')
    expect(out.description).toContain('WARNING')
  })

  it('INCOMPATIBLE alias → same as ERROR', () => {
    const out = describeRule({ ruleType: 'INCOMPATIBLE', sourceType: 'currency', destType: 'number' })
    expect(out.source).toBe('template')
    expect(out.description).toContain('currency → number')
  })

  it('PROMPT — pure fallback (no LLM in this layer)', () => {
    const out = describeRule({
      ruleType: 'PROMPT',
      promptText: 'Classify the Account industry into HubSpot industry property.',
    })
    expect(out.source).toBe('fallback')
    expect(out.description).toContain('(requires review)')
  })

  it('PROMPT with empty prompt → specific no-prompt message', () => {
    const out = describeRule({ ruleType: 'PROMPT', promptText: '' })
    expect(out.source).toBe('fallback')
    expect(out.description).toBe('No classification prompt defined. (requires review)')
  })

  it('unknown ruleType → fallback', () => {
    const out = describeRule({ ruleType: 'UNKNOWN_TYPE' as never })
    expect(out.source).toBe('fallback')
    expect(out.description).toBe('Unknown migration logic type — requires review.')
  })

  it('VALUE_EQUIVALENCE with empty array → no equivalences defined', () => {
    const out = describeRule({ ruleType: 'VALUE_EQUIVALENCE', valueEquivalences: [] })
    expect(out.source).toBe('template')
    expect(out.description).toBe('No value equivalences have been defined.')
  })

  it('ERROR without types → generic warning (no undefined in output)', () => {
    const out = describeRule({ ruleType: 'ERROR' })
    expect(out.source).toBe('template')
    expect(out.description).not.toContain('undefined')
    expect(out.description).toContain('WARNING')
  })
})
