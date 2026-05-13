# Implementation Plan: Source Object Selection

**Branch**: `004-source-object-selection` | **Date**: 2026-04-02 | **Spec**: `specs/004-source-object-selection/spec.md`

## Summary

After schema retrieval, the consultant selects which source objects are in scope for migration. The system provides smart defaults (custom + common business objects pre-selected, system objects hidden), search/filter, bulk actions, and on-demand object expansion (record count, fields preview, sample records). Selection is persisted and restored on return.

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: Neon Postgres via Prisma (ObjectSelection table, isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Performance Goals**: List loads < 2s for 2000 objects; search < 200ms; expand < 10s
**Constraints**: Selection scoped to connection + snapshot; must survive schema refresh for persisting objects

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Standard list + checkbox pattern, no clever abstractions |
| III | Data fidelity | PASS | Orphaned selections flagged on schema refresh, not silently dropped |
| IV | Tests on real data | N/A | No data transformation; selection is UI state |
| V | Idempotence | PASS | Toggling selection is idempotent (select/deselect sets boolean) |
| VI | Traceability | PASS | Selection changes logged to audit trail (FR-010) |
| VII | Observability | PASS | Console logs for selection bulk operations and expand calls |
| VIII | Modularity | PASS | Isolated ObjectSelection service; depends on 003 via snapshotId/objectId only |
| IX | Human-in-the-loop | PASS | Smart defaults (custom + business objects pré-sélectionnés) entièrement visibles et modifiables par le consultant ; aucune sélection cachée ; migration de sélection sur refresh ne touche que les objects qui persistent par apiName |

## Project Structure

### Source Code

```text
src/
├── app/
│   ├── plans/[planId]/source/objects/     # Object selection step page
│   └── api/plans/[planId]/source/objects/
│       ├── route.ts                        # GET list, PUT bulk update
│       └── [objectId]/
│           ├── route.ts                    # PATCH toggle selection
│           └── expand/
│               └── route.ts               # GET on-demand expand (count, fields, records)
├── components/objects/
│   ├── ObjectSelectionList.tsx             # Selectable object list with search
│   ├── ObjectRow.tsx                       # Single object row with checkbox + expand
│   ├── ObjectExpandPanel.tsx              # Expanded view: count, fields, sample records
│   ├── SelectionToolbar.tsx               # Bulk actions: select all, deselect all, counter
│   └── SystemObjectToggle.tsx             # "Hide system objects" toggle
├── lib/
│   ├── services/object-selection.ts       # Domain logic: init defaults, toggle, bulk, migrate
│   └── types/object-selection.ts          # TypeScript types
└── hooks/
    └── use-object-selection.ts            # React hook for selection state

prisma/schema.prisma                       # ObjectSelection model

tests/
├── unit/services/object-selection.test.ts
└── integration/api/object-selection.test.ts
```

**Structure Decision**: Object selection is a sub-step of the source flow, following schema retrieval. On-demand expand calls (record count, fields, sample records) are adapter pass-through calls at dedicated sub-routes.
