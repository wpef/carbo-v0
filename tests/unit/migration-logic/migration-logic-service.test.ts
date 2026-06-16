// Unit tests: migration-logic service — pure/deterministic functions
// Tests getInformationalMessage + stub classify deterministic fallback.
// Does NOT require DB (no Prisma calls in these functions).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getInformationalMessage } from '@/features/migration-logic/services/migration-logic-service'
import { classify } from '@/features/migration-logic/services/classify-service'

// ─── getInformationalMessage ───────────────────────────────────────────────────

describe('getInformationalMessage', () => {
  it('boolean→text returns "Vrai ou Faux"', () => {
    expect(getInformationalMessage('boolean', 'text')).toBe('Vrai ou Faux')
  })

  it('checkbox→text (synonym) returns "Vrai ou Faux"', () => {
    expect(getInformationalMessage('checkbox', 'text')).toBe('Vrai ou Faux')
  })

  it('bool→text (HubSpot synonym) returns "Vrai ou Faux"', () => {
    expect(getInformationalMessage('bool', 'text')).toBe('Vrai ou Faux')
  })

  it('boolean→number returns "Vrai=>1, Faux=>0"', () => {
    expect(getInformationalMessage('boolean', 'number')).toBe('Vrai=>1, Faux=>0')
  })

  it('checkbox→number returns "Vrai=>1, Faux=>0"', () => {
    expect(getInformationalMessage('checkbox', 'number')).toBe('Vrai=>1, Faux=>0')
  })

  it('text→text returns default copy message', () => {
    expect(getInformationalMessage('text', 'text')).toBe('La valeur sera copiée.')
  })

  it('picklist→text returns default copy message', () => {
    expect(getInformationalMessage('picklist', 'text')).toBe('La valeur sera copiée.')
  })

  it('number→number returns default copy message', () => {
    expect(getInformationalMessage('number', 'number')).toBe('La valeur sera copiée.')
  })

  it('date→text returns default copy message', () => {
    expect(getInformationalMessage('date', 'text')).toBe('La valeur sera copiée.')
  })
})

// ─── classify stub ─────────────────────────────────────────────────────────────

describe('classify (stub — no ANTHROPIC_API_KEY)', () => {
  // Ensure API key is not set during these tests
  const originalKey = process.env.ANTHROPIC_API_KEY
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY })
  afterEach(() => {
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey
  })

  it('returns one result per sample value', async () => {
    const results = await classify('', ['Sales', 'Support', 'Other'], ['Need help', 'Buy something'])
    expect(results).toHaveLength(2)
    expect(results[0].sourceValue).toBe('Need help')
    expect(results[1].sourceValue).toBe('Buy something')
  })

  it('classifiedValue is one of destValues (or null)', async () => {
    const destValues = ['Sales', 'Support', 'Other']
    const results = await classify('', destValues, ['help with product', 'want to buy'])
    for (const r of results) {
      if (r.classifiedValue !== null) {
        expect(destValues).toContain(r.classifiedValue)
      }
    }
  })

  it('falls back to first destValue when no substring match', async () => {
    const destValues = ['Alpha', 'Beta', 'Gamma']
    const results = await classify('', destValues, ['xyzzy'])
    // stub: falls back to destValues[0] when no inclusion match
    expect(results[0].classifiedValue).toBe('Alpha')
  })

  it('uses substring match: "support" source → Support dest', async () => {
    const results = await classify('', ['Sales', 'Support', 'Other'], ['I need support'])
    expect(results[0].classifiedValue).toBe('Support')
  })

  it('returns error note in stub mode', async () => {
    const results = await classify('', ['A'], ['val'])
    expect(results[0].error).toBeTruthy()
  })

  it('handles empty sampleValues gracefully', async () => {
    const results = await classify('', ['A', 'B'], [])
    expect(results).toHaveLength(0)
  })
})
