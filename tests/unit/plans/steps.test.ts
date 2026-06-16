// Unit tests — lane navigation (cluster 14)
// Covers steps.ts helpers: getStepIndex, isForwardStep, getNextStep, normalizeStep, STEP_LABELS.

import { describe, it, expect } from 'vitest'
import {
  PLAN_STEPS,
  STEP_LABELS,
  getStepIndex,
  getNextStep,
  isForwardStep,
  normalizeStep,
} from '@/features/plans/lib/steps'

describe('getStepIndex', () => {
  it('returns 0 for SOURCE', () => expect(getStepIndex('SOURCE')).toBe(0))
  it('returns 1 for DESTINATION', () => expect(getStepIndex('DESTINATION')).toBe(1))
  it('returns 2 for OBJECT_MAPPING', () => expect(getStepIndex('OBJECT_MAPPING')).toBe(2))
  it('returns 4 for DOCUMENTS (last)', () => expect(getStepIndex('DOCUMENTS')).toBe(4))
})

describe('isForwardStep', () => {
  it('SOURCE → DESTINATION is forward', () => expect(isForwardStep('SOURCE', 'DESTINATION')).toBe(true))
  it('DESTINATION → SOURCE is not forward (backward)', () => expect(isForwardStep('DESTINATION', 'SOURCE')).toBe(false))
  it('same step is not forward', () => expect(isForwardStep('SOURCE', 'SOURCE')).toBe(false))
  it('skip allowed: SOURCE → OBJECT_MAPPING is forward', () => expect(isForwardStep('SOURCE', 'OBJECT_MAPPING')).toBe(true))
  it('OBJECT_MAPPING → DOCUMENTS is forward', () => expect(isForwardStep('OBJECT_MAPPING', 'DOCUMENTS')).toBe(true))
})

describe('getNextStep', () => {
  it('SOURCE → DESTINATION', () => expect(getNextStep('SOURCE')).toBe('DESTINATION'))
  it('DESTINATION → OBJECT_MAPPING', () => expect(getNextStep('DESTINATION')).toBe('OBJECT_MAPPING'))
  it('DOCUMENTS has no next (last step)', () => expect(getNextStep('DOCUMENTS')).toBeNull())
})

describe('normalizeStep', () => {
  it('maps SOURCE_CONNECTION → SOURCE', () => expect(normalizeStep('SOURCE_CONNECTION')).toBe('SOURCE'))
  it('maps OBJECT_SELECTION → SOURCE', () => expect(normalizeStep('OBJECT_SELECTION')).toBe('SOURCE'))
  it('maps DESTINATION_CONNECTION → DESTINATION', () => expect(normalizeStep('DESTINATION_CONNECTION')).toBe('DESTINATION'))
  it('maps MAPPING → OBJECT_MAPPING', () => expect(normalizeStep('MAPPING')).toBe('OBJECT_MAPPING'))
  it('maps RUN → DOCUMENTS', () => expect(normalizeStep('RUN')).toBe('DOCUMENTS'))
  it('passes through current values unchanged', () => {
    for (const step of PLAN_STEPS) {
      expect(normalizeStep(step)).toBe(step)
    }
  })
})

describe('STEP_LABELS', () => {
  it('all 5 steps have French labels', () => {
    expect(STEP_LABELS.SOURCE).toBe('Source')
    expect(STEP_LABELS.DESTINATION).toBe('Destination')
    expect(STEP_LABELS.OBJECT_MAPPING).toBe('Objets')
    expect(STEP_LABELS.FIELD_MAPPING).toBe('Champs')
    expect(STEP_LABELS.DOCUMENTS).toBe('Documents')
  })
})
