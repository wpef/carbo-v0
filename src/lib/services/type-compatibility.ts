// 012-field-mapping — Type compatibility matrix between source and destination field types

import type { TypeCompatibility } from '@/lib/types/field-mapping'

// Normalise a raw dataType string to a canonical category for compatibility lookup.
// Unknown types default to 'text' (most permissive compatible group).
function normalise(dataType: string): string {
  const t = dataType.toLowerCase().trim()

  if (['string', 'text', 'email', 'url', 'phone', 'textarea', 'richtext', 'id'].includes(t)) return 'text'
  if (['number', 'integer', 'int', 'float', 'double', 'decimal', 'currency', 'percent'].includes(t)) return 'number'
  if (['date', 'datetime', 'time'].includes(t)) return 'date'
  if (['picklist', 'multipicklist', 'enum', 'select'].includes(t)) return 'picklist'
  if (['boolean', 'checkbox'].includes(t)) return 'boolean'

  // Fallback — treat as text (most compatible bucket)
  return 'text'
}

// 5×5 compatibility matrix: [source][destination] → TypeCompatibility
// Rows = source type, Cols = destination type
// Keys: text | number | date | picklist | boolean
const MATRIX: Record<string, Record<string, TypeCompatibility>> = {
  text: {
    text: 'COMPATIBLE',
    number: 'WARNING',
    date: 'WARNING',
    picklist: 'WARNING',
    boolean: 'INCOMPATIBLE',
  },
  number: {
    text: 'WARNING',
    number: 'COMPATIBLE',
    date: 'INCOMPATIBLE',
    picklist: 'WARNING',
    boolean: 'INCOMPATIBLE',
  },
  date: {
    text: 'WARNING',
    number: 'INCOMPATIBLE',
    date: 'COMPATIBLE',
    picklist: 'INCOMPATIBLE',
    boolean: 'INCOMPATIBLE',
  },
  picklist: {
    text: 'WARNING',
    number: 'INCOMPATIBLE',
    date: 'INCOMPATIBLE',
    picklist: 'COMPATIBLE',
    boolean: 'INCOMPATIBLE',
  },
  boolean: {
    text: 'WARNING',
    number: 'INCOMPATIBLE',
    date: 'INCOMPATIBLE',
    picklist: 'INCOMPATIBLE',
    boolean: 'COMPATIBLE',
  },
}

/**
 * Returns the type compatibility status between a source field type and a destination field type.
 * Pure function — no side effects.
 */
export function checkTypeCompatibility(sourceType: string, destType: string): TypeCompatibility {
  const src = normalise(sourceType)
  const dst = normalise(destType)
  return MATRIX[src]?.[dst] ?? 'WARNING'
}
