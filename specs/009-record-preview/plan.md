# Implementation Plan: Record Preview

**Branch**: `009-record-preview` | **Date**: 2026-05-18 | **Spec**: `specs/009-record-preview/spec.md`

## Summary

Provide a paginated, read-only preview of actual records for any selected source or destination object. The consultant opens the preview, sees a data table with all field values (including explicit null/empty display), navigates pages, and views the total record count. Records are fetched on-demand via the connector adapter and are never persisted locally. Relationship fields resolve to meaningful references. Large text values are truncated with an expand option. Every preview event is logged to the audit trail.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM (for plan/connection resolution), Tailwind CSS, shadcn/ui, React 18+, TanStack Table (headless table)
**Storage**: None for records themselves (on-demand fetch, no persistence). Prisma for plan/connection lookups.
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: First page <5s for 100K-record objects (SC-001); page navigation <3s (SC-002)
**Constraints**: DB-per-tenant (Neon); records fetched via `ConnectorAdapter.getRecords()` (1-indexed pagination); read-only (no mutations); connector resolves relationship references
**Scale/Scope**: Objects up to 100K+ records; pages of 25/50/100 records; up to 200 fields per object

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 8 FRs + 5 acceptance scenarios + 7 edge cases |
| II | Readability | PASS | Standard Next.js patterns; dedicated feature module with clear service/component separation |
| III | Data fidelity | PASS | 100% of field values displayed per record including nulls and empty strings (FR-005, SC-003); no silent omissions; relationship fields resolve to meaningful references (FR-006) |
| IV | Tests on real data | PASS | Integration tests use demo adapter with realistic record shapes (50+ fields, mixed types, nulls); E2E tests validate visible display |
| V | Idempotence | N/A | Read-only feature, no mutations |
| VI | Traceability | PASS | Every record preview event logged to audit trail with object, page, record count (FR-008) |
| VII | Observability | PASS | Console logs for fetch start, fetch duration, record count, errors |
| VIII | Modularity | PASS | Feature isolated at `src/features/009-record-preview/`; depends on 000 types + plan/connection models from 001/002; no modification of upstream internals |
| IX | Human-in-the-loop | N/A | Read-only preview; no destructive or ambiguous operations |

## Architecture

### Source Code Layout

```
src/
├── app/plans/[planId]/
│   └── [side]/                                  # "source" or "destination"
│       └── preview/
│           └── [objectApiName]/
│               └── page.tsx                     # Record preview page (server component shell)
├── features/009-record-preview/
│   ├── components/
│   │   ├── record-table.tsx                     # Paginated data table (FR-001, FR-005)
│   │   ├── record-cell.tsx                      # Single cell renderer (null/empty/truncated/binary)
│   │   ├── pagination-controls.tsx              # Previous/Next + page indicator + page size selector (FR-002, FR-003)
│   │   ├── record-count-badge.tsx               # Total record count display (FR-004)
│   │   └── expandable-text.tsx                  # Long text expand/collapse (FR-007)
│   ├── hooks/
│   │   ├── use-records.ts                       # Client hook: fetch records, manage page state
│   │   └── use-record-count.ts                  # Client hook: fetch total count
│   ├── services/
│   │   └── record-preview-service.ts            # Server-side: fetch records via adapter, audit logging
│   └── lib/
│       └── cell-formatters.ts                   # Display helpers (null label, empty label, binary placeholder, relationship display)
├── lib/
│   ├── prisma.ts                                # Prisma client singleton (existing)
│   ├── audit.ts                                 # Audit trail utility (existing)
│   └── types/
│       └── connector.ts                         # ConnectorRecord, PaginatedRecords types (existing, from 000)
```

### API Routes

```
src/app/api/plans/[planId]/[side]/records/[objectApiName]/
├── route.ts                # GET (paginated records)
└── count/
    └── route.ts            # GET (total record count)
```

### Key Dependencies Between Files

- `record-preview-service.ts` -> `prisma.ts` + `audit.ts` + `ConnectorAdapter.getRecords()` + `ConnectorAdapter.getRecordCount()` (from 000)
- `record-table.tsx` -> `record-cell.tsx` + `pagination-controls.tsx` + `record-count-badge.tsx`
- `record-cell.tsx` -> `cell-formatters.ts` + `expandable-text.tsx`
- `use-records.ts` -> calls `GET /api/plans/[planId]/[side]/records/[objectApiName]`
- `use-record-count.ts` -> calls `GET /api/plans/[planId]/[side]/records/[objectApiName]/count`
- `page.tsx` -> `record-table.tsx` + `use-records.ts` + `use-record-count.ts`

## Phases

### Phase 0: Research
See `research.md` — decisions on table library, truncation strategy, pagination approach.

### Phase 1: Design
See `data-model.md` (runtime types only, no Prisma additions), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` — ordered by: service layer -> API routes -> UI components -> page integration.

## Complexity Tracking

No constitution violations identified. No deviations from the standard stack. TanStack Table is the only new dependency (headless, zero-opinion, widely adopted for React data tables).
