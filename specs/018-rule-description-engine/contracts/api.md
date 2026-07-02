# Contracts: Rule Description Engine

## Service Interface Contract

This feature exposes a **service function**, not an HTTP API route. It is consumed in-process by document generation features (019, 020). No Route Handler is created.

### Primary Entry Point

```typescript
// src/features/rule-descriptions/services/description-service.ts

/**
 * Generate human-readable descriptions for a batch of migration logic rules.
 *
 * - VALUE_EQUIVALENCE, INFORMATIONAL, ERROR: resolved locally via templates (no API call)
 * - PROMPT: sent to Claude API for natural language explanation
 * - If ANTHROPIC_API_KEY is not set, PROMPT rules fall back to raw prompt + "(necessite une verification)"
 *
 * @param input - Batch of rules to describe
 * @returns Descriptions in the same order as input rules, with generation stats
 */
async function generateDescriptions(input: DescriptionBatchInput): Promise<DescriptionBatch>
```

**Guarantees**:
1. Output `descriptions` array has the same length and order as `input.rules`.
2. No rule is omitted -- every input produces a description (FR-008, SC-004).
3. Template-based rules (VALUE_EQUIVALENCE, INFORMATIONAL, ERROR) never trigger external API calls (FR-002, FR-003, FR-004).
4. LLM failures are isolated per-rule -- one failure does not abort the batch.
5. All LLM calls are logged to the audit trail with planId, input, output, latency, and success/failure (FR-010).

### Template Generators

```typescript
// src/features/rule-descriptions/services/template-generators.ts

/** VALUE_EQUIVALENCE: lists up to MAX_EQUIVALENCES_SHOWN mappings, summarizes the rest. */
function describeValueEquivalence(input: DescriptionInput): string

/** INFORMATIONAL: returns the pre-defined message text as-is. */
function describeInformational(input: DescriptionInput): string

/** ERROR: explains incompatibility with types and CSV fallback. */
function describeError(input: DescriptionInput): string
```

### LLM Generator

```typescript
// src/features/rule-descriptions/services/llm-generator.ts

/**
 * Send a PROMPT classification prompt to the Claude API for natural language explanation.
 * Returns the LLM-generated description or falls back on failure.
 *
 * @param input - Single PROMPT rule to describe
 * @param planId - For audit trail context
 * @returns RuleDescription with source "llm" or "fallback"
 */
async function describePromptRule(input: DescriptionInput, planId: string): Promise<RuleDescription>
```

### Anthropic SDK Client

```typescript
// src/lib/anthropic.ts

import Anthropic from '@anthropic-ai/sdk'

/**
 * Returns an Anthropic SDK client instance, or null if ANTHROPIC_API_KEY is not set.
 * Singleton pattern -- reuses the same client across requests.
 */
function getAnthropicClient(): Anthropic | null
```

## Contract Verification

A unit test suite validates the service contract:

```typescript
// Verify: batch with all 4 types produces descriptions for all rules
// Verify: output order matches input order
// Verify: VALUE_EQUIVALENCE description source is "template"
// Verify: INFORMATIONAL description source is "template"
// Verify: ERROR description source is "template"
// Verify: PROMPT description source is "llm" (with mocked SDK) or "fallback" (without key)
// Verify: stats counts are accurate (templateCount + llmCount + fallbackCount = total)
// Verify: audit trail receives one entry per LLM call
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| ANTHROPIC_API_KEY not set | All PROMPT rules → fallback (raw prompt + suffix). No error thrown. |
| Claude API timeout (>15s) | Affected rule → fallback. Other rules unaffected. Error logged. |
| Claude API rate limit (429) | Affected rule → fallback. Other rules unaffected. Error logged. |
| Claude API server error (5xx) | Affected rule → fallback. Other rules unaffected. Error logged. |
| Empty LLM response | Affected rule → fallback. Error logged. |
| Unknown logicType | Description: "Type de logique de migration inconnu -- necessite une verification". Source: "fallback". |
| Empty promptText for PROMPT | Description: "Aucun prompt de classification defini". Source: "template". No API call. |
| VALUE_EQUIVALENCE with 0 mappings | Description: "Aucune equivalence de valeur definie". Source: "template". |
