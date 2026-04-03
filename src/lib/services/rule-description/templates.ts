// 018-rule-description-engine — Template-based description generators (no LLM, no I/O)

import type { ValueEquivalenceInput } from './types'

/** Maximum equivalences to list before summarising. */
const MAX_LISTED = 5

/**
 * Describe a VALUE_EQUIVALENCE migration logic rule.
 *
 * Examples:
 *   • 5 mappings   → "'Web' becomes 'Online', 'Referral' becomes 'Partner', ..."
 *   • 12 mappings  → "... (first 5 listed) and 7 more equivalences."
 *   • 0 mappings   → "No value equivalences have been defined."
 *   • unmapped     → Notes at end: "2 source values have no destination equivalent."
 */
export function describeValueEquivalence(equivalences: ValueEquivalenceInput[]): string {
  if (equivalences.length === 0) {
    return 'No value equivalences have been defined.'
  }

  const unmapped = equivalences.filter((e) => !e.destinationValue || e.destinationValue.trim() === '')
  const mapped = equivalences.filter((e) => e.destinationValue && e.destinationValue.trim() !== '')

  const listed = mapped.slice(0, MAX_LISTED)
  const listStr = listed.map((e) => `'${e.sourceValue}' becomes '${e.destinationValue}'`).join(', ')

  let description = listStr

  const remaining = mapped.length - listed.length
  if (remaining > 0) {
    description += `, and ${remaining} more equivalence${remaining === 1 ? '' : 's'}.`
  }

  if (unmapped.length > 0) {
    description +=
      (description.endsWith('.') ? ' ' : '. ') +
      `${unmapped.length} source value${unmapped.length === 1 ? '' : 's'} ${unmapped.length === 1 ? 'has' : 'have'} no destination equivalent.`
  }

  return description
}

/**
 * Describe an INFORMATIONAL migration logic rule.
 *
 * The message is used verbatim. If empty or missing, returns a default.
 */
export function describeInformational(message: string | undefined | null): string {
  if (!message || message.trim() === '') {
    return 'The value will be copied directly.'
  }
  return message.trim()
}

/**
 * Describe an ERROR migration logic rule (type incompatibility).
 *
 * When either type is unknown / empty we produce a generic message.
 */
export function describeError(sourceType: string | undefined | null, destType: string | undefined | null): string {
  if (sourceType && destType) {
    return (
      `WARNING: This field cannot be migrated due to a type incompatibility ` +
      `(${sourceType} → ${destType}). ` +
      `The unmapped values will be exported to a CSV file for manual review.`
    )
  }
  return (
    'WARNING: This field cannot be migrated due to a type incompatibility. ' +
    'The unmapped values will be exported to a CSV file for manual review.'
  )
}

/**
 * Fallback description for an unknown SectionType.
 */
export function describeUnknown(): string {
  return 'Unknown migration logic type — requires review.'
}
