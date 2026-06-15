// 012-field-mapping — Type normalisation + compatibility matrix + section-type derivation.
// Pure TypeScript — no DB, no Prisma, no React, no network calls.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NormalizedType = 'text' | 'number' | 'date' | 'picklist' | 'boolean'
export type CompatibilityStatus = 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'
export type SectionType = 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL'

export interface CompatibilityEntry {
  status: CompatibilityStatus
}

export type CompatibilityMatrix = Record<NormalizedType, Record<NormalizedType, CompatibilityEntry>>

// ─── TYPE_NORMALIZATION ─────────────────────────────────────────────────────────
// Spec 012 §Type Normalisation — maps raw connector dataType strings to one of 5 canonical buckets.
// Unknown types fall back to 'text' (most permissive).

export const TYPE_NORMALIZATION: Record<string, NormalizedType> = {
  // Salesforce text-like
  string: 'text',
  textarea: 'text',
  url: 'text',
  email: 'text',
  phone: 'text',
  id: 'text',
  reference: 'text',
  address: 'text',
  encryptedstring: 'text',
  richtext: 'text',
  // Salesforce numeric
  int: 'number',
  integer: 'number',
  double: 'number',
  float: 'number',
  decimal: 'number',
  currency: 'number',
  percent: 'number',
  long: 'number',
  // Salesforce date/time
  date: 'date',
  datetime: 'date',
  time: 'date',
  // Salesforce pick / multi-pick
  picklist: 'picklist',
  multipicklist: 'picklist',
  combobox: 'picklist',
  // Salesforce boolean
  boolean: 'boolean',
  checkbox: 'boolean',

  // HubSpot
  text: 'text',
  number: 'number',
  enumeration: 'picklist',
  enum: 'picklist',
  select: 'picklist',
  bool: 'boolean',
}

/**
 * Normalise a raw connector dataType string to a canonical NormalizedType.
 * Unknown types fall back to 'text' (most permissive, spec 012 §Fallback).
 */
export function normalizeType(dataType: string): NormalizedType {
  return TYPE_NORMALIZATION[dataType.toLowerCase().trim()] ?? 'text'
}

// ─── COMPATIBILITY MATRIX ───────────────────────────────────────────────────────
// Spec 012 §CompatibilityMatrix — 5×5, rows = source, cols = destination.
// COMPATIBLE = D4 (informational) or D1 (value equivalence)
// WARNING    = D2 (LLM prompt needed)
// INCOMPATIBLE = D3 (error — cannot be linked)

const COMPATIBILITY_MATRIX: CompatibilityMatrix = {
  text: {
    text:     { status: 'COMPATIBLE' },   // D4: direct copy
    number:   { status: 'INCOMPATIBLE' }, // D3: error
    date:     { status: 'INCOMPATIBLE' }, // D3: error
    picklist: { status: 'WARNING' },      // D2: LLM prompt
    boolean:  { status: 'INCOMPATIBLE' }, // D3: error
  },
  number: {
    text:     { status: 'COMPATIBLE' },   // D4: direct copy
    number:   { status: 'COMPATIBLE' },   // D4: direct copy
    date:     { status: 'INCOMPATIBLE' }, // D3: error
    picklist: { status: 'WARNING' },      // D2: LLM prompt
    boolean:  { status: 'INCOMPATIBLE' }, // D3: error
  },
  date: {
    text:     { status: 'COMPATIBLE' },   // D4: direct copy
    number:   { status: 'INCOMPATIBLE' }, // D3: error
    date:     { status: 'COMPATIBLE' },   // D4: direct copy
    picklist: { status: 'WARNING' },      // D2: LLM prompt
    boolean:  { status: 'INCOMPATIBLE' }, // D3: error
  },
  picklist: {
    text:     { status: 'COMPATIBLE' },   // D4: direct copy
    number:   { status: 'INCOMPATIBLE' }, // D3: error
    date:     { status: 'INCOMPATIBLE' }, // D3: error
    picklist: { status: 'COMPATIBLE' },   // D1: value equivalence
    boolean:  { status: 'COMPATIBLE' },   // D1: value equivalence
  },
  boolean: {
    text:     { status: 'COMPATIBLE' },   // D4: "Vrai ou Faux"
    number:   { status: 'COMPATIBLE' },   // D4: "Vrai=>1, Faux=>0"
    date:     { status: 'INCOMPATIBLE' }, // D3: error
    picklist: { status: 'COMPATIBLE' },   // D1: value equivalence
    boolean:  { status: 'COMPATIBLE' },   // D4: direct copy
  },
}

/**
 * Returns the compatibility status between a source and a destination field type.
 * Pure function — no side effects.
 */
export function checkTypeCompatibility(sourceType: string, destType: string): CompatibilityStatus {
  const src = normalizeType(sourceType)
  const dst = normalizeType(destType)
  return COMPATIBILITY_MATRIX[src][dst].status
}

// ─── SECTION TYPE DERIVATION ────────────────────────────────────────────────────
// Spec 013 §getSectionType — derives the migration-logic modal section (D1/D2/D3/D4)
// from the pair of normalised field types. Logic proven in v3 recette.

/**
 * Derive the migration logic section type from source + destination field types.
 *
 * D1 VALUE_EQUIVALENCE — picklist/boolean → picklist/boolean combinations
 * D2 PROMPT           — any → picklist (when D1 doesn't apply)
 * D4 INFORMATIONAL    — same type or compatible text-like conversions
 * D3 ERROR            — everything else (incompatible conversion)
 */
export function getSectionType(sourceType: string, destType: string): SectionType {
  const src = normalizeType(sourceType)
  const dst = normalizeType(destType)

  // D1 — Value Equivalence
  if (src === 'picklist' && (dst === 'picklist' || dst === 'boolean')) return 'VALUE_EQUIVALENCE'
  if (src === 'boolean' && dst === 'picklist') return 'VALUE_EQUIVALENCE'

  // D2 — LLM Prompt: text/number/date → picklist (non-D1)
  if (dst === 'picklist') return 'PROMPT'

  // D4 — Informational (direct copy, no logic needed)
  if (src === dst) return 'INFORMATIONAL'
  if (src === 'picklist' && dst === 'text') return 'INFORMATIONAL'
  if (src === 'boolean' && (dst === 'text' || dst === 'number' || dst === 'boolean')) return 'INFORMATIONAL'
  if (src === 'number' && dst === 'text') return 'INFORMATIONAL'
  if (src === 'date' && dst === 'text') return 'INFORMATIONAL'

  // D3 — Error (incompatible)
  return 'ERROR'
}
