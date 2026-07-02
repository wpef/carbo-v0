# Implementation Plan: Migration Filters

**Branch**: `015-migration-filters` | **Date**: 2026-05-18 | **Spec**: `specs/015-migration-filters/spec.md`

## Summary

Migration filters allow consultants to define conditions on source fields that control which records are included in the migration for a given object mapping. Filters use a builder pattern (field + operator + value) and combine with AND logic. After defining filters, the system queries the source connector to display an estimated record count showing how many records match the criteria.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, Tailwind CSS, shadcn/ui, React 18+
**Storage**: Neon Postgres (via Prisma) -- MigrationFilter table
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: Filter creation in <5s user time (SC-001), estimated count displayed within 10s (SC-002)
**Constraints**: Estimated counts depend on source connector response time; AND-only logic (no OR)
**Scale/Scope**: Up to 20+ filters per object mapping; estimated count is approximate

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 7 FRs + 6 acceptance scenarios |
| II | Readability | PASS | Standard CRUD pattern; filter builder is a simple form, not a visual query builder |
| III | Data fidelity | PASS | Filters restrict scope (no data transformation); invalid filters warn but allow save |
| IV | Tests on real data | PASS | Integration tests with realistic filter scenarios (date ranges, string contains) |
| V | Idempotence | PASS | Adding the same filter twice is rejected (duplicate detection); removing is idempotent |
| VI | Traceability | PASS | All filter operations logged to AuditLog (FR-007) |
| VII | Observability | PASS | Console logs for filter creation, removal, count estimation |
| VIII | Modularity | PASS | Filter module isolated at `src/features/migration-filters/`; exposed to 011 via filter count |
| IX | Human-in-the-loop | PASS | Filters are explicitly created by the consultant; no auto-filtering; conflicting filters show zero count (user decides) |

## Architecture

### Source Code Layout

```
src/
├── app/api/
│   └── plans/[planId]/
│       └── object-mappings/[objectMappingId]/
│           └── filters/
│               ├── route.ts                        # GET (list) + POST (create)
│               ├── [filterId]/route.ts             # DELETE
│               └── estimate/route.ts               # GET (estimated record count)
├── features/
│   └── migration-filters/
│       ├── components/
│       │   ├── filter-panel.tsx                    # Filter list + add form (rendered on field mapping page)
│       │   ├── filter-row.tsx                      # Single filter display with delete action
│       │   └── filter-form.tsx                     # Add filter form (field selector + operator + value)
│       ├── hooks/
│       │   ├── use-filters.ts                     # Fetch/manage filters for an object mapping
│       │   └── use-filter-estimate.ts             # Estimated record count with auto-refresh
│       ├── services/
│       │   └── filter-service.ts                  # Server-side CRUD + count estimation
│       ├── lib/
│       │   ├── filter-operators.ts                # Operator definitions and metadata
│       │   └── filter-validation.ts               # Validate filter against source schema
│       └── types.ts                               # FilterItem, CreateFilterInput, etc.
prisma/
└── schema.prisma                                   # MigrationFilter model (added)
tests/
├── unit/
│   └── migration-filters/
│       ├── filter-operators.test.ts
│       └── filter-validation.test.ts
└── integration/
    └── migration-filters/
        └── filter-crud.test.ts
```

### Key Dependencies Between Files

- `filter-panel.tsx` -> `use-filters.ts` + `use-filter-estimate.ts`
- `filter-form.tsx` -> `filter-operators.ts` (operator dropdown options)
- `filter-service.ts` -> `prisma.ts` + `audit.ts` + ConnectorAdapter.getRecordCount (for estimation)
- `use-filter-estimate.ts` -> `GET /filters/estimate` -> `filter-service.ts`
- 011 object detail modal reads filter count via the filter API

## Phases

### Phase 0: Research
See `research.md` -- decisions on operator set, estimation strategy, validation approach.

### Phase 1: Design
See `data-model.md` (Prisma schema), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` -- ordered by: schema + library -> service + API -> UI components -> integration with 012 -> tests.

## Complexity Tracking

No constitution violations identified. The estimated count dependency on the source connector is handled with a graceful fallback ("estimate unavailable") per the spec edge cases.
