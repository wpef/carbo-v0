# Implementation Plan: Record Preview

**Branch**: `009-record-preview` | **Date**: 2026-04-02 | **Spec**: `specs/009-record-preview/spec.md`

## Summary

Provide a paginated data preview for any connected object (source or destination). The consultant sees actual records in a table with all field values, null/empty handling, pagination controls, and total record count. Records are fetched on-demand from the connector adapter and NOT persisted locally. This is a read-only, cross-cutting feature used by both source and destination views.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14+ (App Router), connector adapters (jsforce, @hubspot/api-client)
**Storage**: None — records are fetched on-demand, not persisted
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js App Router, Node.js
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: First page loads in under 5 seconds for 100k-record objects. Page navigation under 3 seconds.
**Constraints**: Page sizes: 25, 50 (default), 100. Records read-only. No local persistence.
**Scale/Scope**: 1 API route, 1 service, 1 reusable preview component

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Single preview component, straightforward pagination |
| III | Data fidelity | PASS | All field values shown; nulls explicit; no silent omissions |
| IV | Tests on real data | PASS | Integration tests with demo adapter returning realistic record sets |
| V | Idempotence | N/A | Read-only feature, no writes |
| VI | Traceability | PASS | Preview events logged (object, page, record count) |
| VII | Observability | PASS | Console logs for fetch timing, record count, errors |
| VIII | Modularity | PASS | Reusable component works for both source and destination; isolated service |

## Project Structure

### Documentation (this feature)

```text
specs/009-record-preview/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (no persistence — records fetched on-demand)
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
├── app/
│   └── api/
│       └── plans/
│           └── [planId]/
│               └── records/
│                   └── [objectApiName]/
│                       └── route.ts            # GET (paginated records)
├── components/
│   └── records/
│       ├── record-preview.tsx                  # Main preview component (table + pagination)
│       ├── record-table.tsx                    # Data table with null/empty/truncation handling
│       └── pagination-controls.tsx             # Page navigation + page size selector
├── lib/
│   └── services/
│       └── record-preview.service.ts           # Fetch records via adapter, format response
├── hooks/
│   └── use-record-preview.ts                   # React hook: manages pagination state, fetches records

tests/
├── unit/
│   ├── services/
│   │   └── record-preview.test.ts
│   └── components/
│       └── record-table.test.ts
└── integration/
    └── record-preview.test.ts
```

**Structure Decision**: The record preview is connector-agnostic — the route resolves the connection (source or destination) from the plan context and delegates to the adapter. A `role` query param (`?role=source` or `?role=destination`) determines which connection to use. The preview component is reusable across both source and destination views.
