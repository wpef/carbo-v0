# Tasks: Rule Description Engine

**Input**: `specs/018-rule-description-engine/`
**Prerequisites**: 013-migration-logic (MigrationLogic, ValueEquivalence, ClassificationPrompt entities)

---

## Phase 1: Infrastructure

**Purpose**: SDK client singleton, types, and constants required by all generators.

- [ ] T001 Create `src/lib/anthropic.ts`: Anthropic SDK client singleton. Export `getAnthropicClient(): Anthropic | null`. If `process.env.ANTHROPIC_API_KEY` is not set, return `null`. Use `globalThis` caching pattern (same as Prisma singleton) to avoid re-instantiation on hot reload. Console.log on first instantiation: "Anthropic client initialized" or "Anthropic client skipped: no API key" (Principle VII).
- [ ] T002 [P] Create `src/features/rule-descriptions/types.ts`: export `DescriptionInput`, `DescriptionBatchInput`, `RuleDescription`, `DescriptionBatch`, `DescriptionBatchStats` per data-model.md.
- [ ] T003 [P] Create `src/features/rule-descriptions/lib/constants.ts`: export `DESCRIPTION_DEFAULTS` with `MAX_EQUIVALENCES_SHOWN` (5), `LLM_TIMEOUT_MS` (15000), `LLM_CONCURRENCY` (5), `LLM_MODEL` ('claude-sonnet-4-20250514'), `LLM_MAX_TOKENS` (300).
- [ ] T004 [P] Create `src/features/rule-descriptions/lib/prompts.ts`: export `RULE_DESCRIPTION_SYSTEM_PROMPT` (French, instructs Claude to produce a 1-3 sentence description of a classification prompt, mentioning target categories). Export `buildUserMessage(promptText: string, picklistValues: string[]): string` that formats the user message with the raw prompt and destination values.

**Checkpoint**: Types compile, SDK client returns null without API key, constants and prompts are importable.

---

## Phase 2: Template Generators

**Purpose**: Local description generators for VALUE_EQUIVALENCE, INFORMATIONAL, and ERROR rules. No external API calls.

- [ ] T005 Create `src/features/rule-descriptions/services/template-generators.ts`. Implement `describeValueEquivalence(input)`: list up to `MAX_EQUIVALENCES_SHOWN` mappings as "'source' devient 'destination'", then "et N autres equivalences" if more. Append "N valeur(s) source sans equivalence" if `unmappedSourceValues` is non-empty. Return "Aucune equivalence de valeur definie" if valueEquivalences is empty.
- [ ] T006 [P] In the same file, implement `describeInformational(input)`: return `input.informationalMessage` as-is. Return "Aucun message defini" if informationalMessage is empty/undefined.
- [ ] T007 [P] In the same file, implement `describeError(input)`: return template "Types incompatibles ({sourceFieldType} vers {destinationFieldType}). Les valeurs du champ source seront exportees dans un fichier CSV avec les identifiants destination pour mise a jour manuelle apres la migration." Interpolate actual types.

**Checkpoint**: All three template generators produce correct French descriptions for all inputs including edge cases.

---

## Phase 3: LLM Generator

**Purpose**: Claude API-powered description generator for PROMPT rules, with fallback and audit logging.

- [ ] T008 Create `src/features/rule-descriptions/services/llm-generator.ts`. Implement `describePromptRule(input, planId)`: if `getAnthropicClient()` returns null, return fallback immediately (FR-006). If `promptText` is empty, return "Aucun prompt de classification defini" with source "template" (no API call). Otherwise: call `client.messages.create()` with system prompt, user message, model from constants, max_tokens from constants. Apply timeout via `AbortController` with `LLM_TIMEOUT_MS`. On success: extract text, build RuleDescription with source "llm" and measured latency. On failure (timeout, rate limit, server error, empty response): return fallback with raw prompt + "(necessite une verification)" and source "fallback". Log error to console (Principle VII). Call `logAudit()` with action "LLM_DESCRIPTION_GENERATED" or "LLM_DESCRIPTION_FAILED", including input prompt, output text, latency, and error if any (FR-010).

**Checkpoint**: LLM generator works with a real API key (manual test) and falls back correctly without one.

---

## Phase 4: Batch Orchestrator

**Purpose**: Main entry point that orchestrates template and LLM generators for a batch of rules.

- [ ] T009 Create `src/features/rule-descriptions/services/description-service.ts`. Implement `generateDescriptions(input)`: iterate over `input.rules`. For each rule, dispatch to the appropriate generator based on `logicType`: VALUE_EQUIVALENCE → `describeValueEquivalence`, INFORMATIONAL → `describeInformational`, ERROR → `describeError`, PROMPT → `describePromptRule`. Unknown types → fallback description "Type de logique de migration inconnu -- necessite une verification". Template rules are resolved synchronously. PROMPT rules are collected and executed concurrently with a concurrency window of `LLM_CONCURRENCY` using `Promise.allSettled`. Assemble results in input order. Compute stats (templateCount, llmCount, fallbackCount, totalLatencyMs). Console.log batch summary: "Generated N descriptions: N template, N LLM, N fallback in Nms" (Principle VII).

**Checkpoint**: Batch of mixed rule types returns correct descriptions in order with accurate stats.

---

## Phase 5: Tests

**Purpose**: Validate all generators and the batch orchestrator with realistic fixtures.

- [ ] T010 Create `tests/fixtures/rule-descriptions/migration-logic-fixtures.ts`: export realistic DescriptionInput arrays covering all 4 types + edge cases (50+ value equivalences, empty prompt, unknown type, unmapped source values).
- [ ] T011 [P] Create `tests/unit/rule-descriptions/template-generators.test.ts`: test VALUE_EQUIVALENCE (3 mappings, 10+ mappings with truncation, 0 mappings, unmapped values), INFORMATIONAL (normal, empty message), ERROR (with types, without types). Verify no async operations (pure sync functions).
- [ ] T012 [P] Create `tests/unit/rule-descriptions/llm-generator.test.ts`: mock `getAnthropicClient()` to return a mock Anthropic instance. Test: successful LLM call (verify source "llm", latency recorded), empty prompt (no API call), null client / missing key (fallback), API timeout (fallback), API error (fallback), empty response (fallback). Verify `logAudit()` is called for every LLM attempt.
- [ ] T013 Create `tests/unit/rule-descriptions/description-service.test.ts`: test batch with all 4 types (verify order preserved, stats accurate), batch with only templates (verify llmCount=0, totalLatencyMs=0), batch with unknown type (verify fallback), empty batch (verify empty result). Mock LLM generator.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately
- **T002, T003, T004**: Depend on nothing. Parallel-safe with T001.
- **T005, T006, T007**: Depend on T002 (types) + T003 (constants). Parallel-safe after T002/T003.
- **T008**: Depends on T001 (SDK client) + T002 (types) + T003 (constants) + T004 (prompts)
- **T009**: Depends on T005-T007 (template generators) + T008 (LLM generator)
- **T010**: Depends on T002 (types). Can start early.
- **T011**: Depends on T005-T007 (template generators) + T010 (fixtures)
- **T012**: Depends on T008 (LLM generator) + T010 (fixtures)
- **T013**: Depends on T009 (description service) + T010 (fixtures)

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003 | T004] parallel
Phase 2: T005 first, then [T006 | T007] parallel
Phase 3: T008 (sequential after Phase 1)
Phase 4: T009 (sequential after Phase 2 + Phase 3)
Phase 5: T010 first, then [T011 | T012] parallel, then T013
```

### FR Coverage

| FR | Task(s) | Phase |
|----|---------|-------|
| FR-001 (All 4 types) | T005, T006, T007, T008, T009 | 2, 3, 4 |
| FR-002 (VALUE_EQUIVALENCE template) | T005 | 2 |
| FR-003 (INFORMATIONAL template) | T006 | 2 |
| FR-004 (ERROR template) | T007 | 2 |
| FR-005 (PROMPT via Claude API) | T008 | 3 |
| FR-006 (No API key fallback) | T001, T008 | 1, 3 |
| FR-007 (LLM failure fallback) | T008 | 3 |
| FR-008 (Batch processing) | T009 | 4 |
| FR-009 (Configurable timeout) | T003, T008 | 1, 3 |
| FR-010 (Audit trail for LLM) | T008 | 3 |
| FR-011 (Pure service, no UI) | All | All |
