# Implementation Plan: Field Stats

**Branch**: `010-field-stats` | **Date**: 2026-04-02 | **Spec**: `specs/010-field-stats/spec.md`

## Summary

Compute per-field data quality statistics (null count, distinct value count, sample values) from records already fetched for the record preview. Stats are computed client-side from the current page of records — no additional API calls. The scope (number of records analyzed) is always displayed. This is a pure frontend feature built on top of 009-record-preview.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: React (within Next.js)
**Storage**: None — stats are computed in-memory from fetched records
**Testing**: Vitest (unit tests for computation logic)
**Target Platform**: Browser (client-side computation)
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: Stats computation under 1 second for 100 records with 200 fields
**Constraints**: Client-side only. No API calls. Stats scope = fetched records (sample, not full dataset).
**Scale/Scope**: 1 utility function, 1 component, hook extension

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Simple computation function + display component |
| III | Data fidelity | PASS | Stats accurately reflect fetched data; scope always labeled |
| IV | Tests on real data | PASS | Unit tests with realistic record fixtures (nulls, high cardinality, all-same) |
| V | Idempotence | N/A | Read-only computation, no side effects |
| VI | Traceability | N/A | No server-side operation (client-side computation) |
| VII | Observability | PASS | Console log for computation timing in dev mode |
| VIII | Modularity | PASS | Self-contained utility function + component; no cross-module deps |

## Project Structure

### Documentation (this feature)

```text
specs/010-field-stats/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (no persistence)
├── quickstart.md
├── contracts/           # Skipped (no API — client-side only)
└── tasks.md
```

### Source Code

```text
src/
├── components/
│   └── records/
│       ├── field-stats-row.tsx                 # Stats display row per field (null count, distinct, samples)
│       └── record-preview.tsx                  # Extended to include field stats toggle
├── utils/
│   └── compute-field-stats.ts                  # Pure function: records[] -> FieldStats[]
├── hooks/
│   └── use-record-preview.ts                   # Extended: compute stats from fetched records

tests/
└── unit/
    └── utils/
        └── compute-field-stats.test.ts
```

**Structure Decision**: The stats computation is a pure utility function with zero side effects. It takes an array of `ConnectorRecord` and returns `FieldStats[]`. The component renders stats in a collapsible row above or below the record table. No API route needed — everything is client-side.
