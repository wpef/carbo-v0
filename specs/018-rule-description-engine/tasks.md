# Tasks: Rule Description Engine

**Input**: Design documents from `specs/018-rule-description-engine/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, contracts/

## Phase 1: Setup

- [ ] T001 [P] [US1] Create service types in `src/lib/services/rule-description/types.ts`: `RuleDescription`, `DescriptionBatch`, `DescriptionRequest` (input type carrying ruleId + logicType + associated data)
- [ ] T002 [P] [US1] Create barrel export `src/lib/services/rule-description/index.ts`

---

## Phase 2: Template Descriptions (US1 -- template rules)

**Goal**: Generate descriptions for VALUE_EQUIVALENCE, INFORMATIONAL, and ERROR without any external call.

**Independent Test**: Call `describeValueEquivalence()` with 5 mappings, `describeInformational()` with a message, `describeError()` with type pair -- all return correct strings.

- [ ] T003 [US1] Implement template functions in `src/lib/services/rule-description/templates.ts`: `describeValueEquivalence(equivalences)`, `describeInformational(message)`, `describeError(sourceType, destType)`. VALUE_EQUIVALENCE summarizes first 5 if >10 mappings. Handle edge case of unmapped source values.
- [ ] T004 [US1] Write unit tests in `tests/unit/services/rule-description/templates.test.ts`: test each template function with normal input, edge cases (50+ mappings, empty prompt, unknown type)

**Checkpoint**: Template descriptions work in isolation.

---

## Phase 3: LLM Client (US1 -- PROMPT rules)

**Goal**: Call Claude API to describe classification prompts, with timeout and fallback.

**Independent Test**: Mock the Anthropic SDK; verify call is made with correct prompt, timeout fires at 15s, missing key returns fallback.

- [ ] T005 [US1] Implement LLM client in `src/lib/services/rule-description/llm-client.ts`: `describePROMPT(promptText, destPicklistValues)` wrapping `@anthropic-ai/sdk`. Apply `AbortController` timeout (default 15s from env or constant). Return fallback on missing key, empty prompt, API error, or timeout.
- [ ] T006 [US1] Write unit tests in `tests/unit/services/rule-description/llm-client.test.ts`: test successful call (mocked), timeout fallback, missing API key fallback, empty prompt fallback, API error fallback. Verify audit-trail-compatible log output.

**Checkpoint**: LLM client works in isolation with proper fallback.

---

## Phase 4: Batch Service (US1 -- orchestration)

**Goal**: Orchestrate template + LLM descriptions for a list of rules, return ordered results with stats.

**Independent Test**: Provide 15 rules (mix of all types), get 15 descriptions back in order with correct stats.

- [ ] T007 [US1] Implement batch service in `src/lib/services/rule-description/rule-description.service.ts`: `generateDescriptions(rules: DescriptionRequest[]): Promise<DescriptionBatch>`. Dispatch to template functions or LLM client by logicType. Use `Promise.allSettled` for concurrent LLM calls. Compute stats. Log batch summary to console.
- [ ] T008 [US1] Write unit tests in `tests/unit/services/rule-description/service.test.ts`: test batch of 15 mixed rules, verify ordering preserved, stats correct, LLM failures produce fallback entries without failing the batch.

**Checkpoint**: Full service works end-to-end with mocked LLM.

---

## Phase 5: API Route

**Goal**: Expose the service via an API route for document generation features to consume.

- [ ] T009 [US1] Implement API route `src/app/api/plans/[planId]/rule-descriptions/route.ts`: POST handler that loads all MigrationLogic + associated ValueEquivalence/ClassificationPrompt for the plan, calls `generateDescriptions()`, returns `DescriptionBatch` as JSON. Log to audit trail.
- [ ] T010 [US1] Write integration test in `tests/integration/rule-descriptions.test.ts`: seed a plan with mixed migration logic types, call the API route, verify response structure and completeness.

**Checkpoint**: API route returns descriptions for a seeded plan.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): No dependencies, start immediately
- **Phase 2** (T003-T004): Depends on T001 (types)
- **Phase 3** (T005-T006): Depends on T001 (types); parallel with Phase 2
- **Phase 4** (T007-T008): Depends on T003, T005 (templates + LLM client)
- **Phase 5** (T009-T010): Depends on T007 (service); requires 013 entities in DB

### Parallel Opportunities

- T001 and T002 can run in parallel
- Phase 2 (T003-T004) and Phase 3 (T005-T006) can run in parallel
- T004 and T006 (test files) can run in parallel with their implementation tasks if TDD
