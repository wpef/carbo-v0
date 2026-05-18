# Research: Rule Description Engine

## Decision 1: Claude API Model Selection

**Decision**: Use `claude-sonnet-4-20250514` (Claude Sonnet 4) for PROMPT descriptions.

**Rationale**: PROMPT descriptions are short text summaries of classification prompts -- they do not require deep reasoning. Sonnet 4 offers the best cost/speed tradeoff for this use case. The model is configurable via a constant so it can be upgraded without code changes. Opus would be overkill for a one-paragraph summary; Haiku may under-perform on nuanced prompt interpretation.

**Alternatives**: Claude Opus 4 (too expensive for high-volume batch calls), Claude Haiku (risk of shallow descriptions for complex prompts), OpenAI GPT-4o (violates constitution -- @anthropic-ai/sdk is the standard).

## Decision 2: Batching Strategy for LLM Calls

**Decision**: Sequential LLM calls with `Promise.allSettled` for concurrent execution of up to 5 PROMPT rules at a time (concurrency window). Each call is independent -- no multi-rule prompt packing.

**Rationale**: The Claude API does not support batching multiple prompts in a single request (unlike the Batch API which is async). Packing multiple rule descriptions into a single prompt risks cross-contamination and makes fallback per-rule impossible. A concurrency window of 5 balances throughput against rate limits (Anthropic's default is 50 req/min for Sonnet). `Promise.allSettled` ensures one failure does not abort the batch.

**Alternatives**: Sequential one-at-a-time (too slow for 10+ PROMPT rules), single mega-prompt (fragile, no per-rule fallback), Anthropic Message Batches API (async -- latency unsuitable for on-demand document generation).

## Decision 3: Template Design for VALUE_EQUIVALENCE

**Decision**: Template lists up to 5 source→destination mappings in natural language, then summarizes the rest as "and N more equivalences". Unmapped source values are noted separately.

**Rationale**: FR-002 requires no API call for VALUE_EQUIVALENCE. The spec edge case states that 50+ mappings should summarize rather than list all. Five visible mappings give the reader enough context; the count covers the rest. The threshold (5) is a constant in `constants.ts`.

**Alternatives**: Always list all (unreadable at 50+), always summarize with count only (loses concrete examples), configurable per-rule (over-engineered).

## Decision 4: Error Description Template

**Decision**: Static template: "Types incompatibles ({sourceType} vers {destinationType}). Les valeurs du champ source seront exportees dans un fichier CSV avec les identifiants destination pour mise a jour manuelle apres la migration."

**Rationale**: FR-004 requires ERROR descriptions to explain the incompatibility and the CSV fallback. The template interpolates the concrete types for clarity. No LLM call needed.

**Alternatives**: Generic message without types (less helpful), LLM-generated explanation (unnecessary cost for a fixed-format message).

## Decision 5: Fallback Strategy for LLM Failures

**Decision**: On any LLM failure (timeout, rate limit, server error, empty response), the engine returns the raw classification prompt text followed by "(necessite une verification)" and records the failure in the RuleDescription metadata (`source: "fallback"`).

**Rationale**: FR-007 requires graceful degradation. The raw prompt is the best available information -- the consultant or reviewer can understand the intent even without the LLM summary. The "(necessite une verification)" suffix signals that the description is not LLM-enhanced. Failure details are logged to the audit trail (FR-010).

**Alternatives**: Retry with backoff (adds latency, may still fail), omit the description (violates "no omissions" requirement), throw and abort batch (one bad rule should not block the entire document).

## Decision 6: Anthropic SDK Client Singleton

**Decision**: Create a shared Anthropic client singleton at `src/lib/anthropic.ts`, similar to the Prisma singleton pattern. The client is instantiated lazily on first use. If `ANTHROPIC_API_KEY` is not set, the singleton returns `null` and callers handle gracefully.

**Rationale**: The SDK client is stateless and thread-safe. A singleton avoids re-instantiation on every request in serverless. The lazy+nullable pattern handles FR-006 (missing API key) at the infrastructure level rather than in business logic.

**Alternatives**: Instantiate per-request (wasteful), throw on missing key (violates FR-006 graceful degradation), environment check in every function (scattered logic).

## Decision 7: System Prompt for PROMPT Descriptions

**Decision**: A dedicated system prompt instructs Claude to produce a 1-3 sentence French description of what the classification prompt does, including the target categories. The user message contains the raw classification prompt text and the list of destination picklist values.

**Rationale**: The system prompt constrains output length and language. Including the destination picklist values in the user message gives Claude context about the classification targets. French output matches the application language.

**Alternatives**: English output with post-translation (extra step, risk of poor translation), no system prompt (inconsistent output format), include source field examples (unnecessary context, increases token count).
