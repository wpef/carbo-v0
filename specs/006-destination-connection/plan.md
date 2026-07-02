# Implementation Plan: Destination Connection

**Branch**: `006-destination-connection` | **Date**: 2026-05-18 | **Spec**: `specs/006-destination-connection/spec.md`

## Summary

Enable a consultant to connect a destination system (HubSpot or demo) to an existing migration plan, store the connection, auto-retrieve the destination schema+fields after OAuth callback, refresh the schema on demand, and reconfigure the connection with a schema-diff/impact-report cascade that preserves structurally valid downstream work. This is the destination-side counterpart of 002-source-connection.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14+ App Router, Prisma (Neon Postgres), `@hubspot/api-client`, feature 000 (ConnectorAdapter), feature 001 (MigrationPlan)
**Storage**: `ConnectorConnection` row linked via `MigrationPlan.destinationConnectionId`; `SchemaSnapshot` for destination schema (shared entity from 003/007)
**Testing**: Vitest (unit + integration), Playwright (E2E connection flow)
**Target Platform**: Vercel (Next.js Route Handlers)
**Constraints**: One destination per plan; secrets never round-tripped to client; auto-retrieval bypasses full cascade in Phase 1 (FR-018)

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved, all FRs enumerated |
| II | Readability | PASS | Reuses 002 patterns (connection service, schema-diff, impact-report); no new abstractions |
| III | Data fidelity | PASS | Schema snapshots stored verbatim; no silent transformation; orphaned mappings flagged BROKEN, never silently deleted |
| IV | Tests on real data | PASS | Integration tests use realistic HubSpot-shaped fixtures (multi-object, varied field types) |
| V | Idempotence | PASS | Reconfiguration is atomic (single DB transaction); cancel is no-op; re-running same config = no-op |
| VI | Traceability | PASS | Every connect/disconnect/reconfigure/refresh logged to audit trail with full impact report (FR-013) |
| VII | Observability | PASS | Console logs at each step: adapter resolution, auth, schema fetch, diff computation, transaction commit |
| VIII | Modularity | PASS | Destination connection is an isolated module; communicates with 001 (plan), 000 (adapter) via shared types; reconfiguration cascade uses interfaces from 012/013/015 |
| IX | Human-in-the-loop | PASS | Destructive reconfiguration requires explicit confirmation dialog (FR-010); auto-retrieval post-OAuth is non-destructive (overwrites snapshot only, flags BROKEN — no deletions); no auto-rematch on refresh |

**Complexity Tracking**: None. No deviations from constitution or tech stack.

## Architecture

```
src/
├── app/plans/[planId]/destination/
│   └── page.tsx                          # Destination connection page (FR-001, FR-005)
├── components/destination/
│   ├── DestinationConnectionForm.tsx      # Adapter picker + auth form
│   ├── DestinationConnectedStatus.tsx     # Connected state + Reconfigure/Refresh buttons
│   └── ReconfigurationDialog.tsx          # Impact confirmation dialog (FR-010)
├── app/api/plans/[planId]/destination/
│   ├── route.ts                           # POST connect, DELETE disconnect
│   ├── reconfigure/route.ts               # POST reconfigure (diff + confirm flow)
│   └── refresh/route.ts                   # POST refresh schema (MVP silent overwrite)
└── lib/
    ├── services/destination-connection.ts # Business logic: connect, disconnect, reconfigure
    ├── services/schema-diff.ts            # Shared with 002: computeSchemaDiff()
    ├── services/impact-report.ts          # Shared with 002: computeImpactReport()
    └── services/destination-schema.ts     # fetchAndStoreDestinationSchema()
```

**Key architectural decisions**:

1. **Shared schema-diff and impact-report services** with 002 (source). The diff structure (FR-008) and impact report structure (FR-009) are identical. The services accept a `side: 'source' | 'destination'` parameter to query the correct mappings.
2. **Two-phase reconfiguration API**: Step 1 (`POST /reconfigure?preview=true`) computes diff+impact without mutations. Step 2 (`POST /reconfigure?confirm=true`) applies atomically. This keeps the confirmation dialog stateless.
3. **MVP refresh** (FR-016/017/018): `POST /refresh` overwrites the snapshot directly, marks orphaned field mappings as BROKEN, logs to audit. No diff dialog. Full cascade deferred to Phase 2.

## Phases

### Phase 0: Research
See `research.md` — adapter registry reuse, HubSpot OAuth flow, schema-diff sharing with 002.

### Phase 1: Design
See `data-model.md` (ConnectorConnection + MigrationPlan relationship), `contracts/api.md` (API routes).

### Phase 2: Core Connection
Destination page UI, adapter picker, connect/disconnect API, demo adapter support.

### Phase 3: Auto-Retrieval & Refresh
Post-OAuth auto-fetch (FR-016), manual refresh button (FR-017), MVP silent overwrite (FR-018).

### Phase 4: Reconfiguration Cascade
Schema diff, impact report, confirmation dialog, atomic apply, step rollback (FR-005 through FR-015).

### Phase 5: Audit & Polish
Audit trail logging, error handling, edge cases, integration tests.
