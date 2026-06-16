// Unit tests for filter-operators.ts (T017)
// 015-migration-filters

import { describe, it, expect } from 'vitest'
import {
  FILTER_OPERATORS,
  isValidOperator,
  getOperatorMeta,
  DATE_OPERATORS,
  TEXT_OPERATORS,
} from '@/features/filters/lib/filter-operators'

const ALL_OPERATOR_VALUES = [
  'EQUALS',
  'NOT_EQUALS',
  'CONTAINS',
  'NOT_CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
  'GREATER_THAN',
  'LESS_THAN',
  'IS_NULL',
  'DATE_AFTER',
  'DATE_BEFORE',
] as const

describe('FILTER_OPERATORS metadata', () => {
  it('exports all 11 operators', () => {
    expect(FILTER_OPERATORS).toHaveLength(11)
  })

  it('every operator has a non-empty French label', () => {
    for (const op of FILTER_OPERATORS) {
      expect(op.label.length).toBeGreaterThan(0)
    }
  })

  it('every operator has at least one applicable type', () => {
    for (const op of FILTER_OPERATORS) {
      expect(op.applicableTypes.length).toBeGreaterThan(0)
    }
  })

  it('IS_NULL does not need a value', () => {
    const meta = FILTER_OPERATORS.find((op) => op.value === 'IS_NULL')
    expect(meta?.needsValue).toBe(false)
  })

  it('EQUALS needs a value', () => {
    const meta = FILTER_OPERATORS.find((op) => op.value === 'EQUALS')
    expect(meta?.needsValue).toBe(true)
  })

  it('DATE_AFTER and DATE_BEFORE are marked as date-type operators', () => {
    for (const op of ['DATE_AFTER', 'DATE_BEFORE'] as const) {
      const meta = FILTER_OPERATORS.find((m) => m.value === op)
      expect(meta?.applicableTypes).toContain('date')
      expect(meta?.applicableTypes).toContain('datetime')
    }
  })

  it('all operators have valid values from the accepted list', () => {
    const values = FILTER_OPERATORS.map((op) => op.value)
    const expected = new Set(ALL_OPERATOR_VALUES)
    for (const v of values) {
      expect(expected.has(v)).toBe(true)
    }
  })
})

describe('isValidOperator', () => {
  it('returns true for every valid operator', () => {
    for (const op of ALL_OPERATOR_VALUES) {
      expect(isValidOperator(op)).toBe(true)
    }
  })

  it('returns false for unknown operators', () => {
    expect(isValidOperator('BETWEEN')).toBe(false)
    expect(isValidOperator('')).toBe(false)
    expect(isValidOperator('NOT_IN')).toBe(false)  // not in v4 schema
    expect(isValidOperator('IN')).toBe(false)        // not in v4 schema
  })

  it('is case-sensitive (lowercase rejected)', () => {
    expect(isValidOperator('equals')).toBe(false)
    expect(isValidOperator('date_after')).toBe(false)
  })
})

describe('getOperatorMeta', () => {
  it('returns metadata for a known operator', () => {
    const meta = getOperatorMeta('CONTAINS')
    expect(meta?.label).toBe('Contient')
    expect(meta?.needsValue).toBe(true)
  })

  it('returns undefined for an unknown operator (TypeScript guard)', () => {
    // @ts-expect-error testing unknown value
    expect(getOperatorMeta('UNKNOWN')).toBeUndefined()
  })
})

describe('DATE_OPERATORS set', () => {
  it('contains exactly DATE_AFTER and DATE_BEFORE', () => {
    expect(DATE_OPERATORS.has('DATE_AFTER')).toBe(true)
    expect(DATE_OPERATORS.has('DATE_BEFORE')).toBe(true)
    expect(DATE_OPERATORS.size).toBe(2)
  })
})

describe('TEXT_OPERATORS set', () => {
  it('contains exactly the substring/prefix/suffix operators', () => {
    expect(TEXT_OPERATORS.has('CONTAINS')).toBe(true)
    expect(TEXT_OPERATORS.has('NOT_CONTAINS')).toBe(true)
    expect(TEXT_OPERATORS.has('STARTS_WITH')).toBe(true)
    expect(TEXT_OPERATORS.has('ENDS_WITH')).toBe(true)
    expect(TEXT_OPERATORS.size).toBe(4)
  })

  it('does not contain date or comparison operators', () => {
    expect(TEXT_OPERATORS.has('DATE_AFTER')).toBe(false)
    expect(TEXT_OPERATORS.has('GREATER_THAN')).toBe(false)
  })
})
