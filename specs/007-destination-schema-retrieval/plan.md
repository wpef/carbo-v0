# Implementation Plan: Destination Schema Retrieval

**Branch**: `007-destination-schema-retrieval` | **Date**: 2026-05-18 | **Spec**: `specs/007-destination-schema-retrieval/spec.md`

## Summary

Retrieve and persist the full destination schema (all objects + fields), display it to the consultant, support refresh with CURRENT/PREVIOUS snapshot rotation and diff, and expose `detectLiveDrift(connectionId, 'destination')` for plan-reopen drift detection. This is the destination-side counterpart of 003-source-schema-retrieval. Key difference: destination has no object-selection step — all objects are retrieved, and fields are retrieved for all objects in the same chain. Drift detection reuses the canonical taxonomy from spec 003 with destination-specific severity tuning.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14+ App Router, Prisma (Neon Postgres), feature 000 (ConnectorAdapter), feature 001 (MigrationPlan), feature 006 (destination ConnectorConnection)
**Storage**: `SchemaSnapshot` + `SchemaObject` + `ObjectField` tables (shared Prisma models from 003), filtered by `side='destination'`
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (Next.js Route Handlers)
**Constraints**: Full chain (schema + fields) on every trigger (FR-004); max 2 snapshots per connection (CURRENT/PREVIOUS); drift detection read-only and < 15s for 20 mapped objects
**Scale/Scope**: Up to 2000 objects per destination; up to 200 fields per object

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 6 acceptance scenarios, 6 FRs, drift section |
| II | Readability | PASS | Mirrors 003 patterns; service functions named after business operations (`fetchDestinationSchema`, `refreshDestinationSchema`, `detectLiveDrift`) |
| III | Data fidelity | PASS | Schema snapshots stored verbatim; no silent transformation; broken mappings flagged, never silently deleted or re-bound (FR-005, Principle IX) |
| IV | Tests on real data | PASS | Integration tests use realistic HubSpot-shaped fixtures (multi-object, varied field types, picklist values) |
| V | Idempotence | PASS | Snapshot rotation is atomic; drift detection is read-only with no side effects (FR-D-006) |
| VI | Traceability | PASS | Every schema retrieval logged to audit trail (FR-003); drift detection is read-only, not logged |
| VII | Observability | PASS | Console logs: schema fetch start/end, object count, field fetch per object, snapshot rotation, diff computation, drift detection results |
| VIII | Modularity | PASS | Feature isolated at `src/features/007-destination-schema/`; communicates with 003 via shared service interfaces for snapshot management and drift detection |
| IX | Human-in-the-loop | PASS | Refresh triggers integrity check but no auto-remediation; broken mappings require manual resolution; drift banner is informational only |

## Architecture

### Source Code Layout

```
src/
├── app/plans/[planId]/destination/
│   ├── schema/
│   │   └── page.tsx                          # Destination schema page (object list + diff)
├── features/007-destination-schema/
│   ├── components/
│   │   ├── destination-schema-page.tsx       # Client orchestrator
│   │   ├── destination-object-list.tsx       # Object list with badges
│   │   ├── destination-schema-diff.tsx       # Added/removed/modified objects display
│   │   └── schema-refresh-button.tsx         # Refresh trigger (FR-004)
│   ├── hooks/
│   │   └── use-destination-schema.ts         # Client-side schema fetching + refresh state
│   └── services/
│       ├── fetch-destination-schema.ts       # Full chain: schema + fields retrieval + snapshot rotation
│       └── destination-drift.ts              # detectLiveDrift wrapper with destination severity tuning
├── lib/
│   ├── services/
│   │   ├── schema-snapshot.ts               # Shared: snapshot CRUD, rotation (CURRENT/PREVIOUS)
│   │   ├── schema-diff.ts                   # Shared: compute diff between two snapshots
│   │   └── drift-detection.ts               # Shared: detectLiveDrift(connectionId, role)
│   └── types/
│       ├── connector.ts                     # (000) ConnectorAdapter types
│       ├── schema.ts                        # SchemaSnapshot, SchemaObject, ObjectField types
│       └── drift.ts                         # DriftReport, DriftChange, DriftTypeId enum
```

### API Routes

```
src/app/api/plans/[planId]/destination/
├── schema/
│   ├── route.ts                # GET (current snapshot + objects), POST (trigger full chain)
│   └── refresh/
│       └── route.ts            # POST (refresh: full chain + integrity check)
└── drift/
    └── route.ts                # GET (run detectLiveDrift for destination, read-only)
```

### Key Dependencies Between Files

- `fetch-destination-schema.ts` -> `schema-snapshot.ts` (rotation) + adapter `getSchema()` + `getFields()` + `audit.ts`
- `destination-drift.ts` -> `drift-detection.ts` (shared algorithm) + destination severity overrides
- `refresh/route.ts` -> `fetch-destination-schema.ts` + `checkMappingIntegrity` (feature 017)
- `drift/route.ts` -> `drift-detection.ts` (read-only, no DB write)

## Phases

### Phase 0: Research
See `research.md` -- snapshot reuse from 003, full-chain guarantee, drift severity tuning.

### Phase 1: Design
See `data-model.md` (shared SchemaSnapshot with side='destination'), `contracts/api.md` (route specs).

### Phase 2: Implementation
See `tasks.md` -- ordered by: shared services -> schema retrieval -> diff/refresh -> drift detection -> UI.

## Complexity Tracking

No constitution violations. All decisions align with established patterns from 003.
