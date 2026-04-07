# Implementation Plan: Rule Description Engine

**Branch**: `018-rule-description-engine` | **Date**: 2026-04-02 | **Spec**: `specs/018-rule-description-engine/spec.md`

## Summary

Build a stateless service that translates migration logic rules into human-readable descriptions. Three of four logic types (VALUE_EQUIVALENCE, INFORMATIONAL, ERROR) use local templates with zero external calls. PROMPT logic types are sent to the Claude API for natural language explanation. The service supports batch processing, graceful fallback when the API key is missing or the LLM fails, and logs all LLM calls to the audit trail.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: @anthropic-ai/sdk (Claude API client)
**Storage**: None (stateless service -- reads from existing entities, produces ephemeral descriptions)
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js 14+ (App Router), Node.js
**Project Type**: Domain service within monolithic Next.js project
**Performance Goals**: Template descriptions <1ms; LLM descriptions <15s per call
**Constraints**: Graceful degradation when ANTHROPIC_API_KEY is absent; configurable timeout (default 15s)
**Scale/Scope**: 1 service file, 1 types file, 1 API route, unit tests

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | One service file with explicit function names per logic type; no clever abstractions |
| III | Data fidelity | PASS | All rules produce descriptions -- none silently skipped; fallback text is explicit |
| IV | Tests on real data | PASS | Tests use realistic fixtures with multiple logic types, large value equivalences |
| V | Idempotence | PASS | Stateless service -- same input always produces same template output; LLM output may vary but is logged |
| VI | Traceability | PASS | Every LLM call logged to audit trail with input, output, latency, success/failure |
| VII | Observability | PASS | Console logs for LLM calls (start, duration, fallback), batch stats at end |
| VIII | Modularity | PASS | Pure service with typed input/output; no UI; consumed via public function + types |

## Project Structure

### Documentation (this feature)

```text
specs/018-rule-description-engine/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (no Prisma entities)
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
└── lib/
    └── services/
        └── rule-description/
            ├── index.ts                  # Public barrel export
            ├── rule-description.service.ts  # Main service (batch + single)
            ├── templates.ts              # Template functions for VALUE_EQUIVALENCE, INFORMATIONAL, ERROR
            ├── llm-client.ts             # Claude API wrapper (call, timeout, fallback)
            └── types.ts                  # RuleDescription, DescriptionBatch, DescriptionRequest

src/
└── app/
    └── api/
        └── plans/
            └── [planId]/
                └── rule-descriptions/
                    └── route.ts          # POST: generate descriptions for a plan's rules

tests/
└── unit/
    └── services/
        └── rule-description/
            ├── templates.test.ts         # Template output for each logic type
            ├── llm-client.test.ts        # LLM call, timeout, fallback, missing key
            └── service.test.ts           # Batch processing, ordering, stats
```

**Structure Decision**: Service in `src/lib/services/rule-description/` with separate files for templates, LLM client, and orchestration. The API route is nested under plans since descriptions are always generated in plan context.
