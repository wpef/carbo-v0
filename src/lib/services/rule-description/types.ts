// 018-rule-description-engine — Types for the rule description service

import type { SectionType } from '@/lib/types/mapping'

// --- Input ---

export interface ValueEquivalenceInput {
  sourceValue: string
  destinationValue: string
}

/**
 * Input for a single rule description request.
 * Carries ruleId + logicType + associated data, dispatched to the right template or LLM client.
 */
export interface DescriptionRequest {
  /** The MigrationLogic id */
  ruleId: string
  logicType: SectionType
  /** Present when logicType === 'VALUE_EQUIVALENCE' */
  valueEquivalences?: ValueEquivalenceInput[]
  /** Present when logicType === 'INFORMATIONAL' */
  informationalMessage?: string
  /** Present when logicType === 'ERROR' */
  sourceType?: string
  destType?: string
  /** Present when logicType === 'PROMPT' */
  promptText?: string
  /** Picklist values of the destination field, used to enrich PROMPT descriptions */
  destPicklistValues?: string[]
}

// --- Output ---

export type DescriptionSource = 'template' | 'llm' | 'fallback'

/**
 * The description for a single migration logic rule.
 */
export interface RuleDescription {
  ruleId: string
  logicType: SectionType
  description: string
  /** Where the description came from */
  source: DescriptionSource
  /** Populated only for LLM calls (milliseconds) */
  latencyMs?: number
}

/**
 * Batch response: all descriptions + aggregate stats.
 */
export interface DescriptionBatch {
  descriptions: RuleDescription[]
  stats: {
    templateCount: number
    llmCount: number
    fallbackCount: number
    totalLatencyMs: number
  }
}
