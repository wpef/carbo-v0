# Implementation Plan: Migration Logic

**Branch**: `013-migration-logic` | **Date**: 2026-05-18 | **Spec**: `specs/013-migration-logic/spec.md`

## Summary

Migration logic defines how data transforms when moving from source to destination for each field mapping. The system provides a modal interface (C2) that opens when a consultant clicks on a field link. Depending on source/destination type compatibility, the modal displays one of four sections: D1 (Value Equivalence for picklist mappings), D2 (LLM Classification Prompt for text-to-picklist), D3 (Incompatible Types error), or D4 (Simple Copy informational). The consultant can Save (orange status) or Validate (green status) the logic, which drives the link color-coding defined in 012-field-mapping.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, Tailwind CSS, shadcn/ui, React 18+, @anthropic-ai/sdk (Claude API for D2 classification)
**Storage**: Neon Postgres (via Prisma) -- MigrationLogic, ValueEquivalence, ClassificationPrompt tables
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: Modal opens in <2s (SC-001), auto-equivalence <1s (SC-002), LLM classification <5s (SC-003)
**Constraints**: LLM fallback required when API key is missing; Type Compatibility Matrix applied at application level
**Scale/Scope**: 5-200 field mappings per object mapping, picklists up to 100+ values

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 14 FRs + 17 acceptance scenarios |
| II | Readability | PASS | Standard Next.js patterns; type matrix as a pure lookup function; no clever abstractions |
| III | Data fidelity | PASS | D3 (incompatible) explicitly warns user and promises CSV fallback; no silent data loss |
| IV | Tests on real data | PASS | Integration tests with realistic picklist values (10-30 values per field); LLM mock for classification tests |
| V | Idempotence | PASS | Save/Validate are idempotent (overwrite existing logic); re-opening modal loads persisted state |
| VI | Traceability | PASS | All migration logic operations logged to AuditLog (FR-014) |
| VII | Observability | PASS | Console logs for logic creation, modification, validation, LLM calls |
| VIII | Modularity | PASS | Migration logic module isolated at `src/features/migration-logic/`; depends on field-mapping types via shared interfaces |
| IX | Human-in-the-loop | PASS | D1 auto-equivalence only runs on modal open (not on schema refresh); all logic requires explicit Save/Validate |

## Architecture

### Source Code Layout

```
src/
├── app/api/
│   └── plans/[planId]/
│       └── object-mappings/[objectMappingId]/
│           └── field-mappings/[fieldMappingId]/
│               └── migration-logic/
│                   ├── route.ts                    # GET + PUT (upsert logic)
│                   └── classify/route.ts           # POST (LLM classification preview)
├── features/
│   └── migration-logic/
│       ├── components/
│       │   ├── migration-logic-modal.tsx           # C2 — Link Detail Modal (orchestrator)
│       │   ├── value-equivalence-section.tsx        # D1 — Picklist value mapping
│       │   ├── classification-prompt-section.tsx    # D2 — LLM prompt + examples
│       │   ├── incompatible-types-section.tsx       # D3 — Error message
│       │   └── simple-copy-section.tsx              # D4 — Informational message
│       ├── hooks/
│       │   ├── use-migration-logic.ts              # Fetch/save migration logic for a field mapping
│       │   └── use-classification-preview.ts       # LLM classification preview with debounce
│       ├── services/
│       │   └── migration-logic-service.ts          # Server-side CRUD + LLM classification
│       ├── lib/
│       │   ├── type-compatibility-matrix.ts        # 5x5 type matrix → section type
│       │   ├── auto-equivalence.ts                 # Case-insensitive value matching
│       │   └── informational-messages.ts           # D4 message lookup by type pair
│       └── types.ts                                # MigrationLogicDetail, ValueEquivalenceInput, etc.
prisma/
└── schema.prisma                                   # MigrationLogic + ValueEquivalence + ClassificationPrompt models (added)
tests/
├── unit/
│   └── migration-logic/
│       ├── type-compatibility-matrix.test.ts
│       └── auto-equivalence.test.ts
└── integration/
    └── migration-logic/
        ├── migration-logic-crud.test.ts
        └── classification-preview.test.ts
```

### Key Dependencies Between Files

- `migration-logic-modal.tsx` -> `type-compatibility-matrix.ts` (determines which section to render)
- `value-equivalence-section.tsx` -> `auto-equivalence.ts` (initial auto-link on mount)
- `classification-prompt-section.tsx` -> `use-classification-preview.ts` -> `POST /classify` -> `migration-logic-service.ts` -> `@anthropic-ai/sdk`
- `migration-logic-service.ts` -> `prisma.ts` + `audit.ts`
- `use-migration-logic.ts` -> `GET/PUT /migration-logic` route

## Phases

### Phase 0: Research
See `research.md` -- decisions on type matrix encoding, auto-equivalence algorithm, LLM integration, upsert pattern.

### Phase 1: Design
See `data-model.md` (Prisma schema additions), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` -- ordered by: schema + library -> service + API -> modal + sections -> tests.

## Complexity Tracking

No constitution violations identified. The LLM dependency is gated with a fallback (D2 shows error message when unavailable), satisfying both Principle III (no silent failure) and Principle VII (logged degradation).
