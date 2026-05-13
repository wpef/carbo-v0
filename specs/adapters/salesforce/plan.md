# Implementation Plan: Salesforce Adapter

**Branch**: `adapters-salesforce` | **Date**: 2026-04-02 | **Spec**: `specs/adapters/salesforce/spec.md`

## Summary

Implement the Salesforce source adapter as a concrete implementation of the Connector Interface (000). Handles OAuth2+PKCE authentication, schema retrieval via jsforce describeGlobal/describe, object selection with system object filtering, field retrieval, record preview via SOQL, field stats calculation, rate limit handling, and token refresh. Read-only adapter (canRead=true, canWrite=false, canWriteSchema=false).

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: jsforce v3.x, Next.js 14+ (App Router for OAuth callback route)
**Storage**: N/A (adapter is stateless; connection state stored by plan features)
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js web application
**Project Type**: Connector adapter within unified Next.js project
**Performance Goals**: Schema retrieval < 5s for 1200+ objects; record preview < 5s for first page
**Constraints**: OAuth2 PKCE required. Token exchange via direct HTTP POST (jsforce does not support code_verifier). PKCE store on globalThis for hot-reload survival.
**Scale/Scope**: Single Salesforce org per adapter instance. Up to 1200+ objects, 500+ fields per object.

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved with detailed FRs and gotchas |
| II | Readability | PASS | Direct jsforce usage; no magic. Gotchas documented in code comments. |
| III | Data fidelity | PASS | Unknown field types preserved as strings; no silent omissions; all fields from describe() returned |
| IV | Tests on real data | PASS | Contract tests with realistic Salesforce-shaped fixtures (1200 objects, varied field types, relationship fields) |
| V | Idempotence | PASS | All operations are read-only; re-running schema retrieval returns the same snapshot |
| VI | Traceability | PASS | Every operation (connect, disconnect, schema retrieval, record read, rate limit, error) logged to audit trail |
| VII | Observability | PASS | Console logging for OAuth flow steps, API calls, rate limit status, token refresh |
| VIII | Modularity | PASS | Adapter isolated in `src/lib/connectors/salesforce/`; depends only on ConnectorAdapter interface + jsforce |
| IX | Human-in-the-loop | N/A | Adapter stateless ; expose des opérations CRUD sur Salesforce, ne prend aucune décision sur le plan ; les opérations destructives éventuelles (Phase 2) seront déclenchées par les features applicatives, jamais par l'adapter lui-même |

## Project Structure

### Documentation (this feature)

```text
specs/adapters/salesforce/
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
        └── salesforce/
            ├── index.ts                   # Public barrel export
            ├── salesforce-adapter.ts       # ConnectorAdapter implementation
            ├── salesforce-auth.ts          # OAuth2+PKCE flow (build auth URL, exchange code, refresh token)
            ├── salesforce-schema.ts        # describeGlobal + describe mapping to ConnectorObject/ConnectorField
            ├── salesforce-records.ts       # SOQL queries, pagination, field stats
            ├── salesforce-constants.ts     # System object filter patterns, default CRM objects, env var keys
            └── salesforce-types.ts         # Adapter-specific types (SalesforceConfig, token response shape)

src/
└── app/
    └── api/
        └── connectors/
            └── salesforce/
                ├── auth/
                │   └── route.ts            # GET: initiate OAuth2 flow (redirect to Salesforce)
                └── callback/
                    └── route.ts            # GET: handle OAuth2 callback (exchange code for tokens)

tests/
├── unit/
│   └── connectors/
│       └── salesforce/
│           ├── adapter.test.ts
│           ├── auth.test.ts
│           ├── schema.test.ts
│           └── records.test.ts
└── fixtures/
    └── salesforce/
        ├── describe-global.json           # Realistic describeGlobal response (~50 objects)
        ├── describe-contact.json          # Realistic Contact describe response
        └── records-contact.json           # Realistic Contact records
```

**Structure Decision**: Adapter code isolated in `src/lib/connectors/salesforce/`. OAuth routes under `src/app/api/connectors/salesforce/`. Clear separation: auth, schema, records, constants as separate modules for readability.
