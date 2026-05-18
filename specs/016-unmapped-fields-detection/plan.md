# Implementation Plan: Unmapped Fields Detection

**Branch**: `016-unmapped-fields-detection` | **Date**: 2026-05-18 | **Spec**: `specs/016-unmapped-fields-detection/spec.md`

## Summary

Unmapped fields detection ensures that no data is accidentally lost during migration by explicitly surfacing unmapped source fields and unmapped required destination properties for each object mapping. The system computes coverage percentage, displays warnings, and allows consultants to mark fields as "intentionally excluded" to distinguish deliberate omissions from oversights. This feature enforces Constitution Principle III (Data Fidelity) -- no silent data loss.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, Tailwind CSS, shadcn/ui, React 18+
**Storage**: Neon Postgres (via Prisma) -- FieldExclusion table
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: Detection works correctly with 200+ source fields (SC-004); warnings display within 2s
**Constraints**: Detection is read-time computation (no background process); "required" is defined by the destination connector schema
**Scale/Scope**: Up to 200+ fields per object mapping; coverage computed per object mapping, not across the plan

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 7 FRs + 5 acceptance scenarios |
| II | Readability | PASS | Detection is a pure computation on field lists; exclusion is a simple CRUD entity |
| III | Data fidelity | PASS | Core purpose: ensure 100% visibility of unmapped fields -- no silent omission (SC-001, SC-002) |
| IV | Tests on real data | PASS | Integration tests with realistic field counts (25-200 fields per object) |
| V | Idempotence | PASS | Detection is a stateless computation; exclusion toggle is idempotent |
| VI | Traceability | PASS | All exclusion/un-exclusion operations logged to AuditLog (FR-007) |
| VII | Observability | PASS | Console logs for detection computation, exclusion changes |
| VIII | Modularity | PASS | Detection module isolated at `src/features/unmapped-fields/`; exposed to 011/012 via coverage stats |
| IX | Human-in-the-loop | PASS | Exclusion is an explicit consultant decision; no auto-exclusion; bulk exclusion still requires confirmation |

## Architecture

### Source Code Layout

```
src/
├── app/api/
│   └── plans/[planId]/
│       └── object-mappings/[objectMappingId]/
│           └── unmapped-fields/
│               ├── route.ts                        # GET (unmapped fields + coverage stats)
│               └── exclusions/
│                   ├── route.ts                    # GET (list) + POST (create, supports bulk)
│                   └── [exclusionId]/route.ts      # DELETE (un-exclude)
├── features/
│   └── unmapped-fields/
│       ├── components/
│       │   ├── unmapped-fields-panel.tsx           # Main panel with warning sections
│       │   ├── unmapped-source-fields.tsx          # Unmapped source fields list + bulk exclude
│       │   ├── unmapped-dest-fields.tsx            # Unmapped required destination fields list
│       │   ├── excluded-fields-section.tsx         # Intentionally excluded fields (separate section)
│       │   └── coverage-badge.tsx                  # Coverage % badge (e.g., "80% couvert")
│       ├── hooks/
│       │   ├── use-unmapped-fields.ts             # Fetch unmapped fields + coverage
│       │   └── use-field-exclusions.ts            # Manage exclusions (add/remove/bulk)
│       ├── services/
│       │   └── unmapped-fields-service.ts         # Server-side detection + exclusion CRUD
│       ├── lib/
│       │   └── coverage-computation.ts            # Pure function: compute coverage stats
│       └── types.ts                               # UnmappedFieldsReport, FieldExclusionItem, etc.
prisma/
└── schema.prisma                                   # FieldExclusion model (added)
tests/
├── unit/
│   └── unmapped-fields/
│       └── coverage-computation.test.ts
└── integration/
    └── unmapped-fields/
        └── unmapped-fields-crud.test.ts
```

### Key Dependencies Between Files

- `unmapped-fields-service.ts` -> `prisma.ts` + `audit.ts` + schema snapshot data (ConnectorField[])
- `coverage-computation.ts` -> pure function, no external deps
- `unmapped-fields-panel.tsx` -> `use-unmapped-fields.ts` + `use-field-exclusions.ts`
- `use-unmapped-fields.ts` -> `GET /unmapped-fields` -> `unmapped-fields-service.ts`
- 011 object detail modal reads "fields remaining to validate" from this feature's coverage stats
- 012 field mapping view displays unmapped field warnings

## Phases

### Phase 0: Research
See `research.md` -- decisions on computation strategy, exclusion model, coverage formula.

### Phase 1: Design
See `data-model.md` (Prisma schema), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` -- ordered by: schema + computation -> service + API -> UI components -> integration -> tests.

## Complexity Tracking

No constitution violations identified. The feature is a direct implementation of Principle III (Data Fidelity) -- it is the mechanism that prevents silent data loss during mapping.
