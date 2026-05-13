# Implementation Plan: Destination Connection

**Branch**: `006-destination-connection` | **Date**: 2026-04-02 | **Spec**: `specs/006-destination-connection/spec.md`

## Summary

Within a migration plan, allow the consultant to connect a destination system by choosing an adapter type (e.g., HubSpot) and authenticating. The connection is stored as the plan's `destinationConnectionId`. This mirrors 002-source-connection but for the destination side, reusing the same `ConnectorConnection` entity and adapter registry. Includes a "Use Demo Data" shortcut.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14+ (App Router), Prisma ORM, @hubspot/api-client (HubSpot adapter)
**Storage**: Neon Postgres via Prisma — reuses `ConnectorConnection` table from 002 (isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js 14+ (App Router) sur Vercel
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: Connection completes in under 30 seconds
**Constraints**: One destination per plan. Destination adapters may differ from source adapters.
**Scale/Scope**: 1 API route group, 1 service, 1 UI page section, adapter registry extension

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Mirrors source connection pattern; no new abstractions |
| III | Data fidelity | N/A | No data transformation in connection step |
| IV | Tests on real data | PASS | Integration tests with demo adapter |
| V | Idempotence | PASS | Re-connecting replaces existing connection cleanly |
| VI | Traceability | PASS | Connection events logged to audit trail |
| VII | Observability | PASS | Console logs for connection lifecycle |
| VIII | Modularity | PASS | Reuses ConnectorConnection + adapter interface; no cross-module internals |
| IX | Human-in-the-loop | PASS | Connexion destination établie explicitement par le consultant ; symétrique à 002 ; aucune mutation auto |

## Project Structure

### Documentation (this feature)

```text
specs/006-destination-connection/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (no new Prisma entities — reuses ConnectorConnection)
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
├── app/
│   ├── api/
│   │   └── plans/
│   │       └── [planId]/
│   │           └── destination-connection/
│   │               └── route.ts          # POST (connect), DELETE (disconnect), GET (status)
│   └── plans/
│       └── [planId]/
│           └── destination/
│               └── page.tsx              # Destination connection UI within plan
├── components/
│   └── destination/
│       ├── adapter-selector.tsx          # Adapter type picker (HubSpot, Demo)
│       └── connection-status.tsx         # Connection status badge
├── lib/
│   ├── connectors/
│   │   ├── types.ts                      # From 000 (unchanged)
│   │   ├── registry.ts                   # Adapter registry (extended for destination adapters)
│   │   └── adapters/
│   │       └── hubspot/
│   │           └── index.ts              # HubSpot adapter (implements ConnectorAdapter)
│   └── services/
│       └── destination-connection.service.ts  # Business logic: connect, disconnect, cleanup

tests/
├── unit/
│   └── services/
│       └── destination-connection.test.ts
└── integration/
    └── destination-connection.test.ts
```

**Structure Decision**: Mirrors `002-source-connection` structure. The adapter registry is shared between source and destination — each adapter declares its role via capability flags. The route handler is nested under `plans/[planId]/` to enforce plan context.
