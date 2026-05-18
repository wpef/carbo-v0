# Data Model: Rule Description Engine

## Type Definitions

This feature does not introduce new Prisma models. It reads existing entities from feature 013 (MigrationLogic, ValueEquivalence, ClassificationPrompt) and produces in-memory output types. All types are defined in `src/features/rule-descriptions/types.ts`.

### Input Types

#### DescriptionInput

The input for describing a single migration logic rule. Built from the MigrationLogic entity and its relations.

```typescript
interface DescriptionInput {
  ruleId: string                          // MigrationLogic.id
  logicType: 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL'
  // VALUE_EQUIVALENCE data
  valueEquivalences?: {
    sourceValue: string
    destinationValue: string
  }[]
  unmappedSourceValues?: string[]         // Source values with no destination mapping
  // PROMPT data
  promptText?: string                     // ClassificationPrompt.promptText
  destinationPicklistValues?: string[]    // Target picklist values for context
  // ERROR data
  sourceFieldType?: string
  destinationFieldType?: string
  // INFORMATIONAL data
  informationalMessage?: string           // Pre-defined message text (from 013 D4)
}
```

#### DescriptionBatchInput

```typescript
interface DescriptionBatchInput {
  planId: string                          // For audit trail context
  rules: DescriptionInput[]
}
```

### Output Types

#### RuleDescription (FR: Key Entities)

```typescript
interface RuleDescription {
  ruleId: string                          // Matches input ruleId
  logicType: 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL'
  description: string                     // Human-readable natural language description
  source: 'template' | 'llm' | 'fallback'  // How the description was generated
  latencyMs: number | null                // LLM call latency (null for template/fallback)
}
```

#### DescriptionBatch (FR: Key Entities)

```typescript
interface DescriptionBatch {
  descriptions: RuleDescription[]         // Same order as input rules
  stats: DescriptionBatchStats
}

interface DescriptionBatchStats {
  templateCount: number                   // VALUE_EQUIVALENCE + INFORMATIONAL + ERROR
  llmCount: number                        // PROMPT rules resolved by LLM
  fallbackCount: number                   // PROMPT rules that fell back (no key, error, timeout)
  totalLatencyMs: number                  // Sum of all LLM call latencies
}
```

### Constants

```typescript
// src/features/rule-descriptions/lib/constants.ts

const DESCRIPTION_DEFAULTS = {
  /** Max value equivalences to list before summarizing */
  MAX_EQUIVALENCES_SHOWN: 5,
  /** LLM call timeout in milliseconds (FR-009) */
  LLM_TIMEOUT_MS: 15_000,
  /** Max concurrent LLM calls in a batch */
  LLM_CONCURRENCY: 5,
  /** Claude model for PROMPT descriptions */
  LLM_MODEL: 'claude-sonnet-4-20250514',
  /** Max tokens for LLM response */
  LLM_MAX_TOKENS: 300,
}
```

## Relationships

```
MigrationLogic (1) ──► (1) DescriptionInput     (read-time mapping, not persisted)
DescriptionInput (1) ──► (1) RuleDescription     (generated output)
DescriptionBatchInput (1) ──► (N) DescriptionInput
DescriptionBatch (1) ──► (N) RuleDescription
```

This feature is a pure function: `DescriptionBatchInput → DescriptionBatch`. No data is written to the database. Audit trail entries are the only side effect.
