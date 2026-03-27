# Feature Specification: Rule Description Engine

**Feature**: 018-rule-description-engine
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 013-transformation-rules, 014-validation-rules

## User Story (atomic)

As a consultant, I get human-readable descriptions of all mapping rules for my clients, so that transformation and validation rules can be included in generated documents as plain language that non-technical stakeholders understand.

**Independent Test**: Given a mapping plan with 5 transformation rules (FIXED_VALUE, FIELD_REFERENCE, JS_FUNCTION, TYPE_CHECK, REGEX) and 3 validation rules, the engine produces a human-readable description for each rule. Template-based rules (FIXED_VALUE, FIELD_REFERENCE, TYPE_CHECK) produce descriptions without any external API call. Complex rules (JS_FUNCTION, complex REGEX) produce descriptions via the Claude API. If the API key is missing, complex rules fall back to showing raw code with a "requires developer review" note.

**Acceptance Scenarios**:

1. **Given** a transformation rule of type FIXED_VALUE with value "FR", **When** the engine generates a description, **Then** the output is "This field is set to 'FR'" and no LLM API call is made.
2. **Given** a transformation rule of type FIELD_REFERENCE with value "MailingCountry", **When** the engine generates a description, **Then** the output is "This field takes its value from 'MailingCountry'" and no LLM API call is made.
3. **Given** a validation rule of type TYPE_CHECK with value "number", **When** the engine generates a description, **Then** the output is "Must be of type 'number'" and no LLM API call is made.
4. **Given** a transformation rule of type JS_FUNCTION with code `value.trim().toUpperCase()`, **When** the engine generates a description, **Then** the Claude API is called and the output is a plain language sentence (e.g., "The value is trimmed of leading and trailing spaces, then converted to uppercase").
5. **Given** a validation rule of type REGEX with a complex pattern `^[A-Z]{2}\d{3}-[A-Z]$`, **When** the engine generates a description, **Then** the Claude API is called and the output is a plain language sentence (e.g., "Must match the format: two uppercase letters, three digits, a hyphen, and one uppercase letter").
6. **Given** a validation rule of type REGEX with a simple pattern `^\d+$`, **When** the engine generates a description using a template, **Then** no LLM API call is made and the output describes the pattern (e.g., "Must contain only digits").
7. **Given** no ANTHROPIC_API_KEY configured, **When** the engine encounters a JS_FUNCTION rule, **Then** the output is the raw code followed by "(requires developer review)" and no API call is attempted.
8. **Given** a valid API key but the Claude API returns an error (timeout, rate limit, server error), **When** the engine encounters a JS_FUNCTION rule, **Then** the output falls back to the raw code followed by "(requires developer review)" and the error is logged.
9. **Given** a batch of 20 rules across an entire mapping plan, **When** the engine generates descriptions for all, **Then** it returns a complete list of descriptions in the same order, with template rules resolved locally and complex rules batched to minimize API calls.

## Edge Cases

- A JS_FUNCTION rule contains an empty string: the engine returns "No transformation defined" without calling the API.
- A REGEX pattern is null or empty: the engine returns "No validation pattern defined" without calling the API.
- A rule type is unknown or unsupported: the engine returns the raw rule definition with a note "Unknown rule type — requires developer review".
- The Claude API returns an empty or nonsensical description: the engine falls back to raw code with "(requires developer review)" and logs the anomaly.
- Multiple rules on the same field mapping: each rule gets its own independent description.
- The Claude API is slow (>10 seconds): the engine applies a timeout and falls back to raw code for that specific rule without blocking other descriptions.
- A REGEX pattern contains special characters that could confuse template matching: the engine classifies it as complex and delegates to the Claude API.

## Functional Requirements

- **FR-001**: The engine MUST generate human-readable descriptions for transformation rules of types FIXED_VALUE, FIELD_REFERENCE, and JS_FUNCTION.
- **FR-002**: The engine MUST generate human-readable descriptions for validation rules of types TYPE_CHECK and REGEX.
- **FR-003**: Template-based descriptions MUST be used for FIXED_VALUE ("This field is set to '{value}'"), FIELD_REFERENCE ("This field takes its value from '{value}'"), and TYPE_CHECK ("Must be of type '{value}'") rules. These MUST NOT trigger any external API call.
- **FR-004**: Simple REGEX patterns (common patterns like `^\d+$`, `^[A-Za-z]+$`, `^.+@.+\..+$`) SHOULD be matched to predefined templates without an API call. The set of recognized simple patterns MUST be documented.
- **FR-005**: Complex rules (JS_FUNCTION, unrecognized REGEX) MUST be sent to the Claude API (@anthropic-ai/sdk) for natural language description.
- **FR-006**: If the ANTHROPIC_API_KEY environment variable is not set, the engine MUST NOT attempt any API call. Complex rules MUST fall back to raw code with "(requires developer review)".
- **FR-007**: If the Claude API call fails (timeout, rate limit, server error), the engine MUST fall back to raw code with "(requires developer review)" and log the error (Constitution Principle VII).
- **FR-008**: The engine MUST accept a list of rules and return descriptions for all of them in a single call, batching LLM requests to minimize API round-trips.
- **FR-009**: The engine MUST apply a configurable timeout (default: 15 seconds) per LLM API call. Timed-out rules fall back to raw code.
- **FR-010**: The engine MUST log every LLM API call (input, output, latency, success/failure) to the audit trail (Constitution Principle VI).
- **FR-011**: The engine MUST be a pure service with no UI — it is consumed by document generation features (017, 018).

## Key Entities

- **RuleDescription**: The output of the engine for a single rule. Contains: ruleId, ruleType, description (string), source ("template" | "llm" | "fallback"), latencyMs (for LLM calls).
- **DescriptionBatch**: A batch request/response for multiple rules. Contains: descriptions (array of RuleDescription), stats (templateCount, llmCount, fallbackCount, totalLatencyMs).

## Success Criteria

- Template-based rules (FIXED_VALUE, FIELD_REFERENCE, TYPE_CHECK) produce descriptions in under 1ms with zero external calls.
- LLM-generated descriptions are returned in under 15 seconds per call.
- When the API key is missing, 100% of complex rules fall back gracefully with no errors thrown.
- A batch of 50 rules produces descriptions for all 50 with no omissions.
- All LLM API calls are traceable in the audit trail with input, output, and latency.

## Assumptions

- The Claude API is used via the @anthropic-ai/sdk package, as specified in the constitution.
- The ANTHROPIC_API_KEY environment variable controls LLM availability.
- The engine is stateless — it does not cache descriptions. If caching is needed, it will be added as a separate concern.
- The engine does not depend on any specific connector — it works with the generic TransformationRule and ValidationRule entities from features 011 and 012.
- The simple REGEX template set is intentionally small (5-10 common patterns). Any pattern not recognized is treated as complex.
