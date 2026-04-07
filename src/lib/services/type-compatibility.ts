// 012-field-mapping — Type compatibility matrix between source and destination field types

import type { TypeCompatibility } from '@/lib/types/field-mapping'

// Normalise a raw dataType string to a canonical category for compatibility lookup.
// Unknown types default to 'text' (most permissive compatible group).
function normalise(dataType: string): string {
  const t = dataType.toLowerCase().trim()

  if (['string', 'text', 'email', 'url', 'phone', 'textarea', 'richtext', 'id'].includes(t)) return 'text'
  if (['number', 'integer', 'int', 'float', 'double', 'decimal', 'currency', 'percent'].includes(t)) return 'number'
  if (['date', 'datetime', 'time'].includes(t)) return 'date'
  if (['picklist', 'multipicklist', 'enum', 'enumeration', 'select'].includes(t)) return 'picklist'
  if (['boolean', 'bool', 'checkbox'].includes(t)) return 'boolean'

  // Fallback — treat as text (most compatible bucket)
  return 'text'
}

// 5×5 compatibility matrix: [source][destination] → TypeCompatibility
// Rows = source type, Cols = destination type
// Keys: text | number | date | picklist | boolean
// Aligned with spec 013-transformation-rules Type Compatibility Matrix:
// D1 (VALUE_EQUIVALENCE) = COMPATIBLE, D2 (PROMPT) = WARNING,
// D3 (ERROR) = INCOMPATIBLE, D4 (INFORMATIONAL) = COMPATIBLE
const MATRIX: Record<string, Record<string, TypeCompatibility>> = {
  text: {
    text: 'COMPATIBLE',       // D4: "La valeur sera copiée"
    number: 'INCOMPATIBLE',   // D3: Error
    date: 'INCOMPATIBLE',     // D3: Error
    picklist: 'WARNING',      // D2: Prompt
    boolean: 'INCOMPATIBLE',  // D3: Error
  },
  number: {
    text: 'COMPATIBLE',       // D4: "La valeur sera copiée"
    number: 'COMPATIBLE',     // D4: "La valeur sera copiée"
    date: 'INCOMPATIBLE',     // D3: Error
    picklist: 'WARNING',      // D2: Prompt
    boolean: 'INCOMPATIBLE',  // D3: Error
  },
  date: {
    text: 'COMPATIBLE',       // D4: "La valeur sera copiée"
    number: 'INCOMPATIBLE',   // D3: Error
    date: 'COMPATIBLE',       // D4: "La valeur sera copiée"
    picklist: 'WARNING',      // D2: Prompt
    boolean: 'INCOMPATIBLE',  // D3: Error
  },
  picklist: {
    text: 'COMPATIBLE',       // D4: "La valeur sera copiée"
    number: 'INCOMPATIBLE',   // D3: Error
    date: 'INCOMPATIBLE',     // D3: Error
    picklist: 'COMPATIBLE',   // D1: Value Equivalence
    boolean: 'COMPATIBLE',    // D1: Value Equivalence
  },
  boolean: {
    text: 'COMPATIBLE',       // D4: "Vrai ou Faux"
    number: 'COMPATIBLE',     // D4: "Vrai=>1, Faux=>0"
    date: 'INCOMPATIBLE',     // D3: Error
    picklist: 'COMPATIBLE',   // D1: Value Equivalence
    boolean: 'COMPATIBLE',    // D4: "La valeur sera copiée"
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
