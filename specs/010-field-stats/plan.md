# Implementation Plan: Field Stats

**Branch**: `010-field-stats` | **Date**: 2026-05-18 | **Spec**: `specs/010-field-stats/spec.md`

## Summary

Compute and display per-field data quality statistics (null count, distinct value count, up to 5 sample values) from records already fetched by the record preview (009). Stats are computed client-side from the in-memory record set, require no additional API calls, and are displayed alongside the record preview table. The scope (number of analyzed records) is always visible so the consultant understands whether stats represent a sample or the full dataset.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Tailwind CSS, shadcn/ui, React 18+
**Storage**: None. Stats are ephemeral, computed on-the-fly from fetched records (FR-002). Not persisted.
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Vercel (serverless) -- but this feature is purely client-side
**Project Type**: Client-side computation + UI overlay on the record preview
**Performance Goals**: Stats computation <1s for 100 records x 200 fields (SC-001)
**Constraints**: No additional API calls (FR-002); stats computed from fetched records only; scope always labeled (FR-003)
**Scale/Scope**: Up to 100 records per page, up to 200 fields per object

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 6 FRs + 4 acceptance scenarios + 6 edge cases |
| II | Readability | PASS | Single pure function `computeFieldStats()` with clear inputs/outputs; no framework magic |
| III | Data fidelity | PASS | Stats are accurate to the fetched records (SC-002); scope label prevents false confidence from partial data; no silent omissions |
| IV | Tests on real data | PASS | Unit tests use realistic field distributions (mixed nulls, high cardinality, uniform values, binary) from demo adapter data |
| V | Idempotence | N/A | Pure computation, no side effects, no mutations |
| VI | Traceability | N/A | Client-side computation; no server events to audit. Record preview events (009) already cover the data access. |
| VII | Observability | PASS | Console log when stats are computed: field count, record count, computation time |
| VIII | Modularity | PASS | Feature isolated at `src/features/010-field-stats/`; depends only on 009 record types and the `FieldStats` type from 000; no modification of 009 internals |
| IX | Human-in-the-loop | N/A | Read-only analytics; no destructive or ambiguous operations |

## Architecture

### Source Code Layout

```
src/
├── features/010-field-stats/
│   ├── components/
│   │   ├── field-stats-panel.tsx              # Stats panel displayed below/alongside the record table
│   │   ├── field-stat-column.tsx              # Per-column stats display (null count, distinct count, samples)
│   │   └── stats-scope-label.tsx              # "Based on N of M records" label (FR-003)
│   ├── hooks/
│   │   └── use-field-stats.ts                 # Computes stats from records, memoized
│   └── lib/
│       ├── compute-field-stats.ts             # Pure function: records[] -> FieldStats[] (FR-001)
│       └── field-stats-types.ts               # Feature-specific types
├── lib/
│   └── types/
│       └── connector.ts                       # FieldStats type (existing, from 000)
```

No API routes. No Prisma changes. This is a purely client-side feature.

### Integration with 009

The field stats components are rendered inside or below the record preview table (009). Integration approach:
- `use-field-stats.ts` receives the `records` array and `fieldMetadata` from `use-records.ts` (009)
- `field-stats-panel.tsx` is rendered as a child or sibling of `record-table.tsx` (009)
- No modification of 009 internals -- stats components are composed alongside, not injected into, the record table

### Key Dependencies Between Files

- `compute-field-stats.ts` -> pure function, no external deps (only uses `FieldStats` type from 000)
- `use-field-stats.ts` -> `compute-field-stats.ts` + records from 009's `use-records` hook
- `field-stats-panel.tsx` -> `field-stat-column.tsx` + `stats-scope-label.tsx`
- Integration: 009's `page.tsx` composes `RecordTable` (009) + `FieldStatsPanel` (010)

## Phases

### Phase 0: Research
See `research.md` -- decisions on computation strategy, display format, scope labeling.

### Phase 1: Design
See `data-model.md` (runtime types), `contracts/api.md` (no API routes -- documents the computation contract).

### Phase 2: Implementation
See `tasks.md` -- ordered by: computation logic -> UI components -> integration with 009 -> tests.

## Complexity Tracking

No constitution violations identified. No new dependencies. No deviations from the standard stack. This feature adds zero server-side complexity -- it is entirely a client-side computation + UI overlay.
