# Implementation Plan: HubSpot Adapter

**Branch**: `adapters-hubspot` | **Date**: 2026-04-02 | **Spec**: `specs/adapters/hubspot/spec.md`

## Summary

Implement the HubSpot destination adapter as a concrete implementation of the Connector Interface (000). Supports two auth methods (Private App token, OAuth2), schema retrieval (standard + custom objects via CRM API v3 and Schemas API), property retrieval via Properties API, record preview via Search API, field stats, schema write (create properties and custom objects), rate limit handling, and token lifecycle. Full read+write adapter (canRead=true, canWrite=false, canWriteSchema=true).

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: @hubspot/api-client, Next.js 14+ (App Router for OAuth callback route)
**Storage**: N/A (adapter is stateless; connection state stored by plan features)
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js web application
**Project Type**: Connector adapter within unified Next.js project
**Performance Goals**: Schema retrieval < 3s for standard objects; property retrieval < 2s per object; record preview < 5s
**Constraints**: Custom objects require Enterprise tier. Private App tokens cannot be refreshed. Property creation limited to common types.
**Scale/Scope**: Single HubSpot portal per adapter instance. 5 standard objects + N custom objects. Up to 1000 properties per object.

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved with detailed FRs |
| II | Readability | PASS | Direct @hubspot/api-client usage; auth methods clearly separated |
| III | Data fidelity | PASS | Unknown property types (calculation, score) preserved and flagged; no silent omissions |
| IV | Tests on real data | PASS | Contract tests with realistic HubSpot-shaped fixtures (standard objects, properties, records) |
| V | Idempotence | PASS | Read operations are idempotent. Schema write checks for name conflicts before creating. |
| VI | Traceability | PASS | Every operation logged to audit trail (connect, schema retrieval, property creation, errors) |
| VII | Observability | PASS | Console logging for API calls, rate limits, auth status, schema write operations |
| VIII | Modularity | PASS | Adapter isolated in `src/lib/connectors/hubspot/`; depends only on ConnectorAdapter interface + @hubspot/api-client |

## Project Structure

### Documentation (this feature)

```text
specs/adapters/hubspot/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (no new Prisma entities)
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
└── lib/
    └── connectors/
        └── hubspot/
            ├── index.ts                   # Public barrel export
            ├── hubspot-adapter.ts         # ConnectorAdapter implementation
            ├── hubspot-auth.ts            # Private App token validation + OAuth2 flow
            ├── hubspot-schema.ts          # Standard objects + custom objects retrieval, property mapping
            ├── hubspot-records.ts         # Search API queries, pagination, field stats
            ├── hubspot-schema-write.ts    # Create properties and custom objects
            ├── hubspot-constants.ts       # Standard object list, creatable types, env var keys
            └── hubspot-types.ts           # Adapter-specific types (HubSpotConfig, auth method variants)

src/
└── app/
    └── api/
        └── connectors/
            └── hubspot/
                ├── auth/
                │   └── route.ts            # POST: validate Private App token; GET: initiate OAuth2
                └── callback/
                    └── route.ts            # GET: handle OAuth2 callback

tests/
├── unit/
│   └── connectors/
│       └── hubspot/
│           ├── adapter.test.ts
│           ├── auth.test.ts
│           ├── schema.test.ts
│           ├── records.test.ts
│           └── schema-write.test.ts
└── fixtures/
    └── hubspot/
        ├── objects-standard.json          # Standard objects (contacts, companies, deals, tickets, line_items)
        ├── properties-contacts.json       # Contacts properties (~60 properties)
        └── records-contacts.json          # 25 contact records
```

**Structure Decision**: Mirror Salesforce adapter structure for consistency. Extra module `hubspot-schema-write.ts` for the schema write capability (canWriteSchema=true). OAuth2 and Private App auth in a single auth module with method discrimination.
