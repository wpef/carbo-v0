# Implementation Plan: Source Schema Retrieval

**Branch**: `003-source-schema-retrieval` | **Date**: 2026-05-18 | **Spec**: `specs/003-source-schema-retrieval/spec.md`

## Summary

Retrieve the full list of objects from a connected source system, persist as versioned snapshots (CURRENT/PREVIOUS rotation), compute diffs between snapshots, and expose a read-only `detectLiveDrift` service that compares the stored snapshot to a live re-fetch without writing to the DB. The drift detection feeds the plan-reopen banner (001), sidebar badges, and contextual highlighting on mapping pages.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Prisma ORM, ConnectorAdapter (000), Next.js Route Handlers
**Storage**: Neon Postgres via Prisma (SchemaSnapshot, SchemaObject tables)
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js App Router (Vercel)
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: Full retrieval < 60s for 2000 objects (SC-001); drift detection < 15s for 20 mapped objects (FR-014)
**Constraints**: Max 2 snapshots per connection (FR-004); drift detection is read-only (FR-012); concurrency guard (FR-007)
**Scale/Scope**: Up to 2000 objects per connection, 12 canonical drift modification types

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with drift detection FRs |
| II | Readability | PASS | Service functions with explicit names; canonical taxonomy as typed enum |
| III | Data fidelity | PASS | 100% objects persisted (SC-002); no silent omissions; unmapped fields raise explicit errors |
| IV | Tests on real data | PASS | Integration tests against real Postgres with realistic fixtures (50+ objects) |
| V | Idempotence | PASS | Snapshot rotation is deterministic; `detectLiveDrift` is read-only and idempotent (FR-014) |
| VI | Traceability | PASS | Every retrieval logged to audit trail (FR-008); drift detection results logged |
| VII | Observability | PASS | Console logs for retrieval start/end, object counts, diff summary, drift report |
| VIII | Modularity | PASS | Isolated module at `src/features/003-source-schema-retrieval/`; public interface via types + service functions |
| IX | Human-in-the-loop | PASS | Drift detection is read-only; no auto-remediation; consultant triggers refresh explicitly |

## Architecture

```
src/features/003-source-schema-retrieval/
├── services/
│   ├── retrieveSchema.ts        # FR-001..004: fetch + persist + rotate snapshots
│   ├── computeSchemaDiff.ts     # FR-005: diff CURRENT vs PREVIOUS
│   ├── detectLiveDrift.ts       # FR-012..016: live re-fetch vs CURRENT, returns DriftReport
│   └── concurrencyGuard.ts      # FR-007: prevent concurrent retrievals
├── types/
│   └── drift.ts                 # DriftReport, DriftChange, DriftModificationType enum
└── index.ts                     # Public API barrel export
```

### API Routes

```
src/app/api/plans/[planId]/source/schema/
├── route.ts                     # GET (current snapshot) + POST (trigger retrieval)
└── diff/route.ts                # GET (diff CURRENT vs PREVIOUS)

src/app/api/plans/[planId]/source/drift/
└── route.ts                     # GET (live drift detection)
```

### Prisma Schema (additions)

```
prisma/schema.prisma             # SchemaSnapshot + SchemaObject models
```

### UI Components (consumed by 002 source page, not owned by 003)

Feature 003 does not own UI pages. The source page (002) calls the 003 API routes. The drift banner and sidebar badges are owned by 001. Feature 003 provides:
- Service functions (server-side)
- API routes
- Types (DriftReport, DriftChange) consumed by 001 and downstream features

## Phases

### Phase 0: Research
See `research.md` — decisions on snapshot storage, diff algorithm, drift detection scope optimization.

### Phase 1: Design
See `data-model.md` (Prisma models), `contracts/api.md` (API route signatures).

### Phase 2: Implementation
See `tasks.md` (ordered task list covering FR-001 through FR-016).

## Complexity Tracking

No constitution violations. All decisions align with principles.
