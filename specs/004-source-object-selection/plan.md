# Implementation Plan: Source Object Selection

**Branch**: `004-source-object-selection` | **Date**: 2026-05-18 | **Spec**: `specs/004-source-object-selection/spec.md`

## Summary

Let consultants select which source objects to include in migration scope. The feature displays all objects from the current schema snapshot in a selectable list with smart defaults (custom + common business objects pre-selected, system objects hidden), real-time search, on-demand expansion (record count + fields + sample records), bulk actions, and persisted selection. This is a UI-heavy feature with a thin API layer and one new Prisma model (`ObjectSelection`).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, Tailwind CSS, shadcn/ui, React 18+
**Storage**: Neon Postgres (via Prisma) -- `ObjectSelection` table linked to connection + snapshot
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: List loads <2s for 2000 objects (SC-001), search <200ms (SC-002), expand <10s (SC-003)
**Constraints**: DB-per-tenant (Neon); on-demand expand calls go through connector adapter (rate limits apply)
**Scale/Scope**: Up to 2000 objects per schema; selection is per-connection, per-snapshot

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 10 FRs + 6 acceptance scenarios |
| II | Readability | PASS | Standard Next.js App Router patterns; accordion list with search is straightforward UI |
| III | Data fidelity | PASS | Selection state is explicit per object; no silent changes; orphaned selections flagged on snapshot migration |
| IV | Tests on real data | PASS | Integration tests use realistic fixtures (multi-object schemas with standard/custom/system objects) |
| V | Idempotence | PASS | Selection toggle is idempotent (set to true/false, not flip); persist is upsert |
| VI | Traceability | PASS | Selection changes logged to audit trail (FR-010) |
| VII | Observability | PASS | Console logs for: object list load, search filter, expand fetch, selection persist, bulk actions |
| VIII | Modularity | PASS | Feature isolated at `src/features/004-source-object-selection/`; consumes 000 types + 003 snapshot data |
| IX | Human-in-the-loop | PASS | Pre-selection is a default, not a forced decision; consultant can modify freely; orphaned selections show a warning (not auto-removed) |

## Architecture

### Source Code Layout

```
src/
├── app/plans/[planId]/source/
│   └── objects/
│       └── page.tsx                             # Object selection page (server component shell)
├── features/004-source-object-selection/
│   ├── components/
│   │   ├── object-selection-page.tsx            # Client orchestrator
│   │   ├── object-list.tsx                      # Virtualized selectable object list (FR-001, FR-009)
│   │   ├── object-row.tsx                       # Single row: checkbox + label + apiName + badge + description
│   │   ├── object-expand-panel.tsx              # Expandable panel: record count + fields + sample records (FR-005)
│   │   ├── object-search.tsx                    # Real-time search input (FR-004)
│   │   ├── bulk-actions-bar.tsx                 # Select/Deselect all visible + count display (FR-006, FR-009)
│   │   ├── system-objects-toggle.tsx            # Hide system objects toggle (FR-003)
│   │   └── proceed-bar.tsx                      # Bottom bar: selected count + "Retrieve Fields" CTA (FR-008)
│   ├── hooks/
│   │   ├── use-object-selection.ts              # Fetch + mutate selection state
│   │   └── use-object-expand.ts                 # On-demand expand: record count + fields + sample records
│   ├── services/
│   │   ├── object-selection-service.ts          # Server-side: get/save selection, compute defaults, migrate selection
│   │   └── object-expand-service.ts             # Server-side: fetch record count + fields + sample via adapter
│   └── lib/
│       ├── default-selection.ts                 # Compute pre-selection defaults (isCustom + common business objects list)
│       └── common-business-objects.ts           # Per-connector-type lists of common business objects
├── lib/types/
│   └── connector.ts                             # From 000-connector-interface
├── app/api/plans/[planId]/source/
│   └── objects/
│       ├── route.ts                             # GET (list with selection state) + PUT (save selection)
│       └── [objectApiName]/
│           └── expand/
│               └── route.ts                     # GET (record count + fields + sample records)
prisma/
└── schema.prisma                                # + ObjectSelection model
tests/
├── unit/
│   └── 004-source-object-selection/
│       ├── default-selection.test.ts
│       └── common-business-objects.test.ts
├── integration/
│   └── 004-source-object-selection/
│       ├── object-selection-crud.test.ts
│       └── object-expand.test.ts
└── e2e/
    └── 004-source-object-selection/
        └── object-selection.spec.ts
```

### Key Dependencies Between Files

- `object-selection-service.ts` -> `prisma.ts` + `audit.ts` + `default-selection.ts`
- `object-expand-service.ts` -> `registry.ts` (adapter) + `prisma.ts` (connection lookup)
- `object-selection-page.tsx` -> all components + `use-object-selection.ts` + `use-object-expand.ts`
- `default-selection.ts` -> `common-business-objects.ts`
- `object-list.tsx` -> `object-row.tsx` + `object-expand-panel.tsx`

## Phases

### Phase 0: Research
See `research.md` -- decisions on virtualization, default computation, expand strategy.

### Phase 1: Design
See `data-model.md` (Prisma schema), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` -- ordered task list with parallel markers and checkpoints.

## Complexity Tracking

No constitution violations identified. All principles are satisfied by the design.
