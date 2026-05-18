# Implementation Plan: Source Connection

**Branch**: `002-source-connection` | **Date**: 2026-05-18 | **Spec**: `specs/002-source-connection/spec.md`

## Summary

Implement the source connection step within a migration plan: adapter selection, credential entry, authentication, schema retrieval (auto + manual refresh), demo mode, disconnect, and reconfiguration with schema-diff-based impact analysis and atomic cascade. The feature owns the `/plans/[planId]/source` page and its API routes. Phase 1 simplification: auto-refresh and manual refresh bypass the diff/confirmation cascade (FR-019), relying on `linkStatus=BROKEN` for orphaned references.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14+ (App Router), Prisma (ORM), shadcn/ui, Tailwind CSS
**Storage**: Neon Postgres via Prisma (`ConnectorConnection` row linked to `MigrationPlan`)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (Next.js App Router)
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: Connection < 30s (SC-001), impact preview < 1s for 500 field mappings (SC-006)
**Constraints**: DB-per-tenant (connection string resolved at runtime); secrets never round-tripped to client
**Scale/Scope**: Single consultant per tenant, plans with up to 500 field mappings

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Standard Next.js patterns; service functions named after business operations (`connectSource`, `reconfigureSource`, `computeSchemaDiff`) |
| III | Data fidelity | PASS | Schema snapshots stored as JSON; original data never mutated silently; reconfiguration preserves valid mappings (FR-016) |
| IV | Tests on real data | PASS | Integration tests use realistic schema fixtures (multi-object, multi-field); demo adapter provides representative data |
| V | Idempotence | PASS | Reconfiguration is atomic (single transaction, FR-013); cancel leaves plan byte-identical (SC-005); no partial writes |
| VI | Traceability | PASS | Every connection/disconnection/reconfiguration logged to audit trail with full impact report (FR-014) |
| VII | Observability | PASS | Console logs for connection lifecycle: connect attempt, auth result, schema fetch, diff computation, cascade apply |
| VIII | Modularity | PASS | Feature isolated in `src/features/002-source-connection/`; communicates with 000 types via `@/lib/types/connector`; downstream entities accessed through abstract service interfaces |
| IX | Human-in-the-loop | PASS | Destructive reconfiguration requires confirmation dialog (FR-011); auto-refresh Phase 1 relies on BROKEN flags, not silent deletion (FR-019) |

## Architecture

```
src/
├── app/plans/[planId]/source/
│   └── page.tsx                          # Source connection page (server component shell)
├── features/002-source-connection/
│   ├── components/
│   │   ├── adapter-selector.tsx          # Adapter type picker (FR-002)
│   │   ├── connection-form.tsx           # Credentials form + demo mode toggle (FR-005, FR-007)
│   │   ├── connection-status.tsx         # Connected state display + Reconfigurer button (FR-006)
│   │   ├── schema-refresh-button.tsx     # Manual refresh trigger (FR-018)
│   │   ├── impact-dialog.tsx             # Reconfiguration confirmation dialog (FR-011)
│   │   └── source-page-client.tsx        # Client orchestrator (auto-recovery FR-017, state machine)
│   ├── hooks/
│   │   └── use-source-connection.ts      # Client-side state + mutations
│   ├── services/
│   │   ├── connect-source.ts             # Connect / disconnect logic
│   │   ├── fetch-schema.ts               # Schema + objects + fields retrieval chain
│   │   ├── schema-diff.ts                # Pure function: compute diff between two snapshots (FR-009)
│   │   ├── impact-report.ts              # Compute downstream impact from diff (FR-010)
│   │   └── apply-reconfiguration.ts      # Atomic transaction: update connection + cascade (FR-013)
│   └── lib/
│       └── normalize-type.ts             # Type compatibility bucketing (shared with 012)
├── lib/types/
│   └── connector.ts                      # (000) ConnectorAdapter, ConnectorSchema, etc.
└── lib/adapters/
    ├── registry.ts                       # (000) Adapter registry
    └── demo/
        └── demo-adapter.ts              # (000) Demo adapter
```

### API Routes

```
src/app/api/plans/[planId]/source/
├── route.ts              # GET (current connection), POST (connect), DELETE (disconnect)
├── reconfigure/
│   ├── preview/
│   │   └── route.ts      # POST (compute impact preview without applying)
│   └── apply/
│       └── route.ts      # POST (apply reconfiguration atomically)
└── refresh/
    └── route.ts          # POST (refresh schema, Phase 1 simplified)
```

## Phases

### Phase 0: Research
See `research.md` -- adapter registry integration, schema snapshot storage, diff algorithm.

### Phase 1: Design
See `data-model.md` (Prisma schema additions), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` -- ordered task list with parallel markers and checkpoints.

## Complexity Tracking

No constitution violations. All decisions align with established patterns.
