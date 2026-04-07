# Implementation Plan: HubSpot Destination Connector

**Branch**: `002-hubspot-connector` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-hubspot-connector/spec.md`

## Summary

Build a HubSpot destination connector that authenticates via OAuth2, retrieves schema metadata
(objects, properties, types, constraints), displays paginated records with basic property stats,
supports schema refresh with diff, and allows creating new objects and properties in HubSpot.
Uses the HubSpot CRM API v3 via the @hubspot/api-client SDK. Follows the same patterns established
by feature 001 (Salesforce connector) for consistency and future SDK extraction.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14+ App Router) — established in 001
**Primary Dependencies**: Next.js, @hubspot/api-client, Prisma ORM, Tailwind CSS, shadcn/ui
**Storage**: SQLite via Prisma (established in 001)
**Testing**: Vitest (unit + integration), Playwright (E2E) — established in 001
**Target Platform**: Web browser (local development, localhost)
**Project Type**: Web application (single Next.js project)
**Performance Goals**: Schema browsing <2 min; record preview first page <5s; property creation <1 min
**Constraints**: Local-first; read + schema-write connector; single portal per connection
**Scale/Scope**: Single consultant; HubSpot portals with standard + custom objects, 100k+ records

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Spec-First | PASS | spec.md completed with clarifications before this plan |
| II | Readability over cleverness | PASS | Same patterns as 001; @hubspot/api-client is the official SDK |
| III | Data fidelity | PASS | FR-002/003 require 100% retrieval; FR-011 validates before write; no silent operations |
| IV | Functional tests on real data | PASS | Realistic HubSpot fixtures; Vitest for critical paths |
| V | Idempotence | PASS | Schema reads are idempotent; property creation validates uniqueness before write |
| VI | Traceability by default | PASS | FR-012 + shared AuditLog entity; every operation logged |
| VII | Developer observability | PASS | Console logging on all API calls and operations |

## Project Structure

### Documentation (this feature)

```text
specs/002-hubspot-connector/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-routes.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   └── connectors/
│   │       └── hubspot/
│   │           ├── connect/route.ts
│   │           ├── callback/route.ts
│   │           └── [connectionId]/
│   │               ├── disconnect/route.ts
│   │               ├── objects/route.ts
│   │               ├── objects/
│   │               │   └── [apiName]/
│   │               │       ├── properties/route.ts
│   │               │       ├── properties/create/route.ts
│   │               │       └── records/route.ts
│   │               ├── objects/create/route.ts
│   │               └── schema/
│   │                   └── refresh/route.ts
│   ├── connectors/
│   │   └── hubspot/
│   │       ├── page.tsx
│   │       └── components/
│   │           ├── connection-form.tsx
│   │           ├── object-list.tsx
│   │           ├── property-list.tsx
│   │           ├── record-preview.tsx
│   │           ├── property-stats.tsx
│   │           ├── schema-diff.tsx
│   │           ├── create-property-form.tsx
│   │           └── create-object-form.tsx
├── lib/
│   └── connectors/
│       └── hubspot/
│           ├── client.ts
│           ├── auth.ts
│           ├── schema.ts
│           ├── records.ts
│           ├── diff.ts
│           ├── write.ts          # Property/object creation logic
│           └── types.ts

tests/
├── unit/
│   └── connectors/
│       └── hubspot/
│           ├── schema.test.ts
│           ├── records.test.ts
│           ├── diff.test.ts
│           └── write.test.ts
└── fixtures/
    └── hubspot/
        ├── objects-list.json
        ├── properties-contacts.json
        └── search-contacts.json
```

**Structure Decision**: Mirrors the Salesforce connector layout (001) exactly. Same directory
conventions, same separation of concerns (lib/ for business logic, api/ for HTTP, components/ for UI).
This consistency is intentional — it will make Connector SDK extraction straightforward.

## Complexity Tracking

> No Constitution violations. This section is intentionally empty.
