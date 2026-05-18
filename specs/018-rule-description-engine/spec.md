# Feature Specification: Rule Description Engine

**Feature**: 018-rule-description-engine
**Created**: 2026-03-25
**Updated**: 2026-04-01
**Status**: Draft
**Depends on**: 013-migration-logic

## User Scenarios & Testing

### User Story 1 - Generate descriptions for migration logic (Priority: P1)

As a consultant, I get human-readable descriptions of all migration logic rules for my clients, so that the generated documents explain in plain language what happens to each field during migration. The descriptions are generated based on the migration logic type: value equivalences produce a summary of the mappings, classification prompts produce an explanation of the LLM-based classification, informational sections produce the pre-defined message, and error sections produce the incompatibility explanation.

**Why this priority**: Human-readable descriptions are required for client-facing documents (features 019 and 020). Without them, the documents cannot be generated.

**Independent Test**: Given a migration plan with 10 field mappings -- 3 with value equivalences, 2 with classification prompts, 3 with informational logic, and 2 with error logic -- the engine produces a description for each. Value equivalence descriptions list the mappings (e.g., "Web becomes Online, Referral becomes Partner"). Classification prompts produce an explanation of the prompt. Informational logic produces the pre-defined message. Error logic produces the incompatibility explanation.

**Acceptance Scenarios**:

1. **Given** a migration logic of type VALUE_EQUIVALENCE with 5 value mappings, **When** the engine generates a description, **Then** the output summarizes the equivalences in plain language (e.g., "'Web' becomes 'Online', 'Referral' becomes 'Partner', ...") and no LLM API call is made.
2. **Given** a migration logic of type PROMPT with a classification prompt, **When** the engine generates a description, **Then** the Claude API is called to produce a plain language explanation of what the classification does (e.g., "Free-text values are classified into categories using AI: Support, Sales, or Other").
3. **Given** a migration logic of type INFORMATIONAL with message "The value will be copied as-is", **When** the engine generates a description, **Then** the output is "The value will be copied as-is" and no LLM API call is made.
4. **Given** a migration logic of type ERROR, **When** the engine generates a description, **Then** the output explains the incompatibility and the CSV fallback, and no LLM API call is made.
5. **Given** no ANTHROPIC_API_KEY configured, **When** the engine encounters a PROMPT rule, **Then** the output is the raw prompt text followed by "(requires review)" and no API call is attempted.
6. **Given** a batch of 15 rules across an entire migration plan, **When** the engine generates descriptions for all, **Then** it returns a complete list in the same order, with template rules resolved locally and PROMPT rules batched to minimize API calls.

---

### Edge Cases

- A VALUE_EQUIVALENCE has 50+ mappings: the description summarizes the first few and adds "and N more equivalences".
- A PROMPT classification prompt is empty: the engine returns "No classification prompt defined" without calling the API.
- The Claude API returns an empty or nonsensical description: the engine falls back to the raw prompt with "(requires review)".
- The Claude API is slow (>10 seconds): the engine applies a timeout and falls back for that specific rule.
- A migration logic type is unknown: the engine returns "Unknown migration logic type -- requires review".
- A VALUE_EQUIVALENCE has source values with no destination mapping: the description notes "N source values have no destination equivalent".

## Requirements

### Functional Requirements

- **FR-001**: The engine MUST generate human-readable descriptions for migration logic of all four types: VALUE_EQUIVALENCE, PROMPT, ERROR, and INFORMATIONAL.
- **FR-002**: VALUE_EQUIVALENCE descriptions MUST be generated from templates listing the source-to-destination value mappings. These MUST NOT trigger any external API call.
- **FR-003**: INFORMATIONAL descriptions MUST reproduce the pre-defined message text. These MUST NOT trigger any external API call.
- **FR-004**: ERROR descriptions MUST explain the type incompatibility and the CSV fallback procedure. These MUST NOT trigger any external API call.
- **FR-005**: PROMPT descriptions MUST be sent to the Claude API for natural language explanation of the classification logic.
- **FR-006**: If the ANTHROPIC_API_KEY environment variable is not set, the engine MUST NOT attempt any API call. PROMPT rules MUST fall back to raw prompt text with "(requires review)".
- **FR-007**: If the Claude API call fails (timeout, rate limit, server error), the engine MUST fall back to raw prompt text with "(requires review)" and log the error.
- **FR-008**: The engine MUST accept a list of rules and return descriptions for all of them in a single call, batching LLM requests to minimize API round-trips.
- **FR-009**: The engine MUST apply a configurable timeout (default: 15 seconds) per LLM API call.
- **FR-010**: The engine MUST log every LLM API call (input, output, latency, success/failure) to the audit trail (Constitution Principle VI).
- **FR-011**: The engine MUST be a pure service with no UI -- it is consumed by document generation features (019, 020).

### Key Entities

- **RuleDescription**: The output of the engine for a single migration logic rule. Contains: ruleId, logicType, description (string), source ("template" | "llm" | "fallback"), latencyMs (for LLM calls).
- **DescriptionBatch**: A batch request/response for multiple rules. Contains: descriptions (array of RuleDescription), stats (templateCount, llmCount, fallbackCount, totalLatencyMs).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Template-based descriptions (VALUE_EQUIVALENCE, INFORMATIONAL, ERROR) are produced in under 1ms with zero external calls.
- **SC-002**: LLM-generated descriptions (PROMPT) are returned in under 15 seconds per call.
- **SC-003**: When the API key is missing, 100% of PROMPT rules fall back gracefully with no errors thrown.
- **SC-004**: A batch of 50 rules produces descriptions for all 50 with no omissions.
- **SC-005**: All LLM API calls are traceable in the audit trail with input, output, and latency.

## Assumptions

- The Claude API is used for LLM-powered descriptions via the @anthropic-ai/sdk package.
- The ANTHROPIC_API_KEY environment variable controls LLM availability.
- The engine is stateless -- it does not cache descriptions.
- The engine works with the new MigrationLogic entities from feature 013, not the old TransformationRule/ValidationRule model.
- For VALUE_EQUIVALENCE with many mappings (>10), the description summarizes rather than listing every mapping.
