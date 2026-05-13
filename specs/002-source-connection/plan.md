# Implementation Plan: Source Connection

**Branch**: `002-source-connection` | **Date**: 2026-04-02 | **Spec**: `specs/002-source-connection/spec.md`

## Summary

Within a migration plan, the consultant selects a source adapter type (e.g., Salesforce), authenticates, and stores the connection. The feature provides a UI step inside the plan detail page, API routes for connection CRUD, and a demo mode bypass. No new connector logic is built here -- it delegates to adapters via the Connector Interface (000).

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: Neon Postgres via Prisma (SourceConnection table linked to MigrationPlan, isolated per tenant — OAuth tokens chiffrés en colonne `pgcrypto`)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Constraints**: Connection must complete in < 30 seconds excluding external auth

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Standard Next.js patterns, no abstractions beyond Connector Interface |
| III | Data fidelity | PASS | Disconnect cascades are explicit (FR-004) |
| IV | Tests on real data | N/A | No data transformation in this feature |
| V | Idempotence | PASS | Connecting twice replaces existing connection, no side effects |
| VI | Traceability | PASS | All connection events logged to audit trail |
| VII | Observability | PASS | Console logs for connect/disconnect/error |
| VIII | Modularity | PASS | Feature isolated behind SourceConnection service; communicates via Connector Interface types |
| IX | Human-in-the-loop | PASS | Connexion établie explicitement par le consultant via OAuth ; déconnexion confirmée ; aucune mutation auto des credentials |

## Project Structure

### Documentation

```text
specs/002-source-connection/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
├── app/
│   ├── plans/[planId]/source/     # Source connection step page
│   └── api/plans/[planId]/source/ # Route handlers (POST connect, DELETE disconnect, GET status)
├── components/source/
│   ├── AdapterPicker.tsx          # Adapter type selector
│   ├── ConnectionStatus.tsx       # Status badge (CONNECTED/PENDING/ERROR)
│   └── DemoModeToggle.tsx         # "Use Demo Data" switch
├── lib/
│   ├── services/source-connection.ts  # Domain logic: connect, disconnect, cascade cleanup
│   ├── connectors/registry.ts         # Adapter registry (returns available adapters)
│   └── types/connector.ts             # Re-exports from 000-connector-interface
└── hooks/
    └── use-source-connection.ts       # React hook for connection state

prisma/schema.prisma                   # SourceConnection model (added to MigrationPlan)

tests/
├── unit/services/source-connection.test.ts
└── integration/api/source-connection.test.ts
```

**Structure Decision**: Single Next.js project. The source connection step is a page under `plans/[planId]/source/`. API routes follow RESTful convention under `api/plans/[planId]/source/`.
