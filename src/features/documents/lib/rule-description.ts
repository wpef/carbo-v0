// 018-rule-description-engine — Pure template-based description generators
//
// Covers all migration rule kinds:
//   DIRECT_COPY        — same or compatible types, no logic override
//   VALUE_EQUIVALENCE  — explicit source→destination value mapping table
//   PROMPT             — LLM classification stub (pure fallback; real LLM wired later)
//   INFORMATIONAL      — free-text message stored on the rule
//   ERROR / INCOMPATIBLE — type incompatibility; field excluded from migration
//
// All functions are PURE: no DB access, no network calls, no React, no Prisma.
// Types are self-contained in this module.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RuleType =
  | 'DIRECT_COPY'
  | 'VALUE_EQUIVALENCE'
  | 'PROMPT'
  | 'INFORMATIONAL'
  | 'ERROR'
  | 'INCOMPATIBLE' // alias kept for v4 service compatibility

export type DescriptionSource = 'template' | 'fallback'

export interface ValueEquivalencePair {
  sourceValue: string
  destinationValue: string
}

/** Input for a single rule description request (pure, no DB ids required). */
export interface RuleDescriptionInput {
  ruleType: RuleType
  /** VALUE_EQUIVALENCE — list of source→destination value pairs */
  valueEquivalences?: ValueEquivalencePair[]
  /** INFORMATIONAL — pre-authored message text */
  informationalMessage?: string | null
  /** ERROR / INCOMPATIBLE — source field data type */
  sourceType?: string | null
  /** ERROR / INCOMPATIBLE — destination field data type */
  destType?: string | null
  /** PROMPT — raw classification prompt text (LLM call stubbed; returns fallback) */
  promptText?: string | null
  /** DIRECT_COPY — source data type label */
  sourceDataType?: string | null
  /** DIRECT_COPY — destination data type label */
  destDataType?: string | null
}

/** Output for a single rule description. */
export interface RuleDescriptionOutput {
  description: string
  source: DescriptionSource
}

// ---------------------------------------------------------------------------
// Per-type pure generators
// ---------------------------------------------------------------------------

/** Maximum equivalences listed before summarising with "and N more". */
const MAX_LISTED = 5

/**
 * DIRECT_COPY — same-type or compatible-type copy.
 *
 * Examples:
 *   'text' === 'text'     → "Copie directe (text → text)"
 *   'text' !== 'textarea' → "Copie avec conversion de type (text → textarea)"
 */
export function describeDirectCopy(sourceType: string | null | undefined, destType: string | null | undefined): string {
  const src = sourceType ?? 'unknown'
  const dst = destType ?? 'unknown'
  if (src === dst) {
    return `Copie directe (${src} → ${dst})`
  }
  return `Copie avec conversion de type (${src} → ${dst})`
}

/**
 * VALUE_EQUIVALENCE — lists the first MAX_LISTED mappings, then summarises the remainder.
 *
 * Examples:
 *   0 pairs            → "No value equivalences have been defined."
 *   5 pairs            → "'Web' becomes 'Online', 'Referral' becomes 'Partner', ..."
 *   12 pairs           → "... (first 5 listed), and 7 more equivalences."
 *   unmapped sources   → appends "N source values have no destination equivalent."
 */
export function describeValueEquivalence(equivalences: ValueEquivalencePair[]): string {
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
    const suffix =
      `${unmapped.length} source value${unmapped.length === 1 ? '' : 's'} ` +
      `${unmapped.length === 1 ? 'has' : 'have'} no destination equivalent.`
    description += (description.endsWith('.') ? ' ' : '. ') + suffix
  }

  return description
}

/**
 * INFORMATIONAL — returns the pre-authored message verbatim.
 * Falls back to a default when the message is empty.
 */
export function describeInformational(message: string | null | undefined): string {
  if (!message || message.trim() === '') {
    return 'The value will be copied directly.'
  }
  return message.trim()
}

/**
 * ERROR / INCOMPATIBLE — type incompatibility; field excluded from automated migration.
 *
 * Two forms:
 *   with types   → "WARNING: … (text → picklist). …"
 *   without types → generic warning
 */
export function describeError(
  sourceType: string | null | undefined,
  destType: string | null | undefined,
): string {
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
 * INCOMPATIBLE (v4 alias) — delegates to describeError.
 * Also used by the v4 contractual document service.
 */
export function describeIncompatible(
  sourceType: string | null | undefined,
  destType: string | null | undefined,
): string {
  return describeError(sourceType, destType)
}

/**
 * PROMPT — LLM call stubbed for pure layer.
 *
 * When ANTHROPIC_API_KEY is absent (always the case in a pure/test context)
 * the engine returns the raw prompt text with "(requires review)".
 * The real LLM wiring lives in the service layer (wired later).
 */
export function describePromptFallback(promptText: string | null | undefined): string {
  if (!promptText || promptText.trim() === '') {
    return 'No classification prompt defined. (requires review)'
  }
  return `${promptText.trim()} (requires review)`
}

/**
 * Unknown / unsupported rule type — catch-all fallback.
 */
export function describeUnknown(): string {
  return 'Unknown migration logic type — requires review.'
}

// ---------------------------------------------------------------------------
// Unified dispatcher
// ---------------------------------------------------------------------------

/**
 * Classify a rule and return its plain-language description.
 *
 * This is the single entry point consumed by document generators.
 * PROMPT rules receive the pure fallback (LLM wired later in the service layer).
 */
export function describeRule(input: RuleDescriptionInput): RuleDescriptionOutput {
  switch (input.ruleType) {
    case 'DIRECT_COPY':
      return {
        description: describeDirectCopy(input.sourceDataType, input.destDataType),
        source: 'template',
      }

    case 'VALUE_EQUIVALENCE':
      return {
        description: describeValueEquivalence(input.valueEquivalences ?? []),
        source: 'template',
      }

    case 'INFORMATIONAL':
      return {
        description: describeInformational(input.informationalMessage),
        source: 'template',
      }

    case 'ERROR':
    case 'INCOMPATIBLE':
      return {
        description: describeError(input.sourceType, input.destType),
        source: 'template',
      }

    case 'PROMPT':
      return {
        description: describePromptFallback(input.promptText),
        source: 'fallback',
      }

    default:
      return {
        description: describeUnknown(),
        source: 'fallback',
      }
  }
}
