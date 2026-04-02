# Research: Rule Description Engine

## Decision: Template engine vs. string concatenation for non-LLM descriptions

**Chosen**: Simple TypeScript functions returning template literal strings.

**Rationale**: The templates are short (1-3 sentences) and logic-type-specific. A template engine (Handlebars, EJS) would add a dependency for trivial string generation. Each logic type has its own function: `describeValueEquivalence()`, `describeInformational()`, `describeError()`.

**Rejected**: Handlebars/EJS templates. Overhead of a template engine is not justified for <10 template patterns.

## Decision: LLM batching strategy

**Chosen**: One Claude API call per PROMPT rule (no multi-rule batching in a single prompt).

**Rationale**: Each classification prompt is independent and may be complex. Stuffing multiple prompts into a single LLM call risks confusion and makes error handling harder (one failure contaminates the whole batch). With `Promise.allSettled`, multiple calls run concurrently and individual failures are isolated.

**Rejected**: Single LLM call with all prompts concatenated. Risk of prompt confusion, harder to attribute failures, and more complex parsing of multi-rule output.

## Decision: Claude API model and parameters

**Chosen**: `claude-sonnet-4-20250514` with `max_tokens: 300`, `temperature: 0.3`.

**Rationale**: Rule descriptions are short (1-3 sentences). A smaller model is sufficient and cheaper. Low temperature ensures consistent, factual descriptions. 300 tokens is ample for a concise explanation.

**Rejected**: `claude-opus-4-20250514` -- overkill for short descriptions; higher cost and latency.

## Decision: Fallback behavior

**Chosen**: Three-tier fallback: (1) Template if logic type is non-LLM, (2) LLM call if API key present, (3) Raw prompt + "(requires review)" if no key or LLM failure.

**Rationale**: The consultant should never see a blank description. The fallback text is always the raw prompt, which is better than nothing and clearly marked for review.

## Decision: Timeout implementation

**Chosen**: `AbortController` with configurable timeout (default 15s) passed to the Anthropic SDK client.

**Rationale**: The Anthropic SDK supports `signal` for request cancellation. AbortController is the standard Node.js mechanism. Per-call timeout isolates slow calls without blocking the batch.

## Constraint: Audit trail integration

Every LLM call must produce an audit entry with: ruleId, promptInput (truncated if >500 chars), llmOutput, latencyMs, status (success/failure/timeout). The audit service interface is assumed to exist from feature 001. If not yet implemented, the service logs to console and the audit integration is added when available.

## Constraint: No caching

Per spec, the engine is stateless and does not cache descriptions. Each call to `generateDescriptions()` recomputes everything. Caching may be added later as an optimization but is explicitly out of scope.

## Constraint: VALUE_EQUIVALENCE summarization threshold

Per spec edge case, when a value equivalence has >10 mappings, the description lists the first 5 and adds "and N more equivalences". Threshold: 10 mappings. Display: first 5.
