# Implementation Plan: Migration Filters

**Branch**: `015-migration-filters` | **Date**: 2026-04-02 | **Spec**: `specs/015-migration-filters/spec.md`

## Summary

Define filters on source records per object mapping to control which records are included in migration. Filters use standard operators (EQUALS, NOT_EQUALS, CONTAINS, etc.) combined with AND logic. The system displays an estimated record count by querying the source connector. Filters are defined at plan time and applied at execution time (feature 024).

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: Neon Postgres via Prisma (MigrationFilter table linked to ObjectMapping, isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Constraints**: Estimated record count depends on source connector response time (up to 10 seconds)

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Simple CRUD with filter operators; no complex abstractions |
| III | Data fidelity | PASS | Filters are explicit conditions; conflicting filters produce zero-count warning |
| IV | Tests on real data | N/A | Filters are definitions, not data transformations; estimation tested via mock connector |
| V | Idempotence | PASS | Creating the same filter twice is a no-op (rejected as duplicate) |
| VI | Traceability | PASS | All filter create/remove operations logged to audit trail |
| VII | Observability | PASS | Console logs for filter operations and estimation queries |
| VIII | Modularity | PASS | Isolated behind MigrationFilterService; depends on ObjectMapping via ID only |
| IX | Human-in-the-loop | PASS | Filtres définis explicitement par le consultant ; estimated record count purement informatif (lecture seule) ; aucune décision auto |

## Project Structure

### Documentation

```text
specs/015-migration-filters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
├── app/
│   └── api/plans/[planId]/object-mappings/[mappingId]/filters/
│       ├── route.ts                                # GET list, POST create
│       ├── [filterId]/route.ts                     # DELETE remove
│       └── estimate/route.ts                       # GET estimated record count
├── components/mapping/
│   ├── MigrationFilterPanel.tsx                    # Filter list + add form (within object mapping view)
│   ├── FilterRow.tsx                               # Single filter display (field, operator, value, delete)
│   └── FilterForm.tsx                              # Add filter form (field picker, operator picker, value input)
├── lib/
│   ├── services/migration-filter.ts                # Domain logic: CRUD, field validation
│   ├── services/filter-estimation.ts               # Estimated record count via connector
│   └── types/mapping.ts                            # Extended with MigrationFilter types
└── hooks/
    └── use-migration-filters.ts                    # React hook for filter state + estimation

tests/
├── unit/services/migration-filter.test.ts
├── unit/services/filter-estimation.test.ts
└── integration/api/migration-filter.test.ts
```

**Structure Decision**: Filters are a panel within the object mapping view, not a separate page. The API is nested under the object mapping. Estimation is a separate endpoint because it requires a network call to the source connector.
