# Implementation Plan: Rule Description Engine

**Branch**: `018-rule-description-engine` | **Date**: 2026-05-18 | **Spec**: `specs/018-rule-description-engine/spec.md`

## Summary

A pure backend service that generates human-readable natural language descriptions for all four migration logic types (VALUE_EQUIVALENCE, PROMPT, ERROR, INFORMATIONAL). Template-based descriptions are resolved locally; PROMPT descriptions are sent to the Claude API via @anthropic-ai/sdk. The engine has no UI -- it is consumed by document generation features (019, 020). Batch processing minimizes API round-trips.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: @anthropic-ai/sdk (Claude API client), Prisma ORM
**Storage**: Neon Postgres (via Prisma) -- reads MigrationLogic, ValueEquivalence, ClassificationPrompt entities from feature 013
**Testing**: Vitest (unit for template generators, integration for LLM calls with mocked SDK)
**Target Platform**: Vercel (serverless Route Handlers)
**Project Type**: Backend service (no UI components)
**Performance Goals**: Template descriptions <1ms (SC-001), LLM descriptions <15s per call (SC-002), batch of 50 rules fully resolved (SC-004)
**Constraints**: ANTHROPIC_API_KEY optional -- graceful degradation when absent (FR-006)

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 11 FRs + 6 acceptance scenarios |
| II | Readability | PASS | Simple switch on logicType; no clever abstractions |
| III | Data fidelity | PASS | All rule types produce descriptions; unknown types flagged explicitly (edge case) |
| IV | Tests on real data | PASS | Unit tests use realistic migration logic fixtures (multi-value picklists, real prompts) |
| V | Idempotence | PASS | Stateless engine -- same input always produces same output (deterministic for templates; LLM output may vary but is logged) |
| VI | Traceability | PASS | Every LLM API call logged to audit trail with input, output, latency (FR-010) |
| VII | Observability | PASS | Console logs for each description generation (type, source, latency) |
| VIII | Modularity | PASS | Isolated service at `src/features/rule-descriptions/`; public interface via exported types + service function |
| IX | Human-in-the-loop | N/A | No automated decisions -- descriptions are informational only |

## Architecture

### Source Code Layout

```
src/
├── features/
│   └── rule-descriptions/
│       ├── services/
│       │   ├── description-service.ts        # Main entry: generateDescriptions(rules)
│       │   ├── template-generators.ts        # VALUE_EQUIVALENCE, ERROR, INFORMATIONAL
│       │   └── llm-generator.ts              # PROMPT descriptions via Claude API
│       ├── lib/
│       │   ├── prompts.ts                    # System prompt template for Claude API
│       │   └── constants.ts                  # Defaults: timeout, max mappings shown, etc.
│       └── types.ts                          # RuleDescription, DescriptionBatch, DescriptionInput
├── lib/
│   ├── anthropic.ts                          # Anthropic SDK client singleton
│   └── audit.ts                              # Existing audit trail utility (from 001)
tests/
├── unit/
│   └── rule-descriptions/
│       ├── template-generators.test.ts
│       ├── llm-generator.test.ts
│       └── description-service.test.ts
└── fixtures/
    └── rule-descriptions/
        └── migration-logic-fixtures.ts       # Realistic migration logic data
```

### Key Dependencies Between Files

- `description-service.ts` → `template-generators.ts` + `llm-generator.ts` + `audit.ts`
- `llm-generator.ts` → `anthropic.ts` (SDK client) + `prompts.ts`
- `template-generators.ts` → `constants.ts` (truncation threshold)

## Phases

### Phase 0: Research
See `research.md` -- decisions on Claude API usage, batching strategy, template design.

### Phase 1: Design
See `data-model.md` (input/output types), `contracts/api.md` (service interface contract).

### Phase 2: Implementation
See `tasks.md` -- ordered by: SDK setup → template generators → LLM generator → batch orchestrator → tests.

## Complexity Tracking

No constitution violations identified. The feature is a pure service with no UI and no persistent state of its own.
