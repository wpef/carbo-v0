# Implementation Plan: Salesforce Adapter

**Branch**: `implement/phase-1-v4` | **Date**: 2026-05-18 | **Spec**: `specs/adapters/salesforce/spec.md`

## Summary

Implement the Salesforce adapter: a concrete `ConnectorAdapter` (feature 000) for Salesforce as a read-only source. The adapter authenticates via OAuth2 with PKCE (S256), retrieves schema metadata via jsforce v3.x `describeGlobal` / `describe`, queries records via SOQL, computes field stats, and handles rate limits and token refresh transparently. No new data model -- the adapter fulfils the `ConnectorAdapter` interface and is consumed by features 002-010 through the adapter registry.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14+ App Router)
**Primary Dependencies**: jsforce v3.x (Salesforce REST API), Next.js Route Handlers
**Storage**: Neon Postgres via Prisma (connection record managed by feature 002; adapter is stateless beyond token lifecycle)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web (Vercel deployment, localhost dev)
**Project Type**: Adapter module within the Carbo-v0 Next.js mono-project
**Constraints**: Read-only (canRead=true, canWrite=false, canWriteSchema=false); jsforce does NOT support PKCE -- token exchange via direct HTTP POST; PKCE verifier on `globalThis` for dev hot-reload survival

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved; this plan is phase 3 of speckit workflow |
| II | Readability | PASS | Standard jsforce usage; OAuth flow extracted into a dedicated module; system-object filter as a documented constant |
| III | Data fidelity | PASS | FR-006/009: 100% of objects and fields retrieved, no silent omission; FLS-restricted fields listed with "no access" marker |
| IV | Tests on real data | PASS | Realistic fixtures from a Salesforce Developer Edition org (describeGlobal, describe Contact, SOQL Contact query) |
| V | Idempotence | PASS | Read-only adapter; same query = same result |
| VI | Traceability | PASS | FR-015: every operation (connect, disconnect, schema, records, errors, rate limits) logged to audit trail |
| VII | Observability | PASS | Console logging on every API call, token refresh, rate limit event |
| VIII | Modularity | PASS | Adapter is a self-contained module at `src/lib/adapters/salesforce/`; public surface = `ConnectorAdapter` interface + adapter registration |
| IX | Human-in-the-loop | N/A | Adapter is read-only; no destructive or ambiguous operations |

## Architecture

```
src/lib/adapters/salesforce/
  index.ts                    # Adapter entry: exports ConnectorAdapter implementation
  auth.ts                     # OAuth2 + PKCE flow (buildAuthUrl, exchangeCode, refreshToken)
  pkce.ts                     # PKCE helpers (generateVerifier, computeChallenge, globalThis store)
  client.ts                   # jsforce Connection factory + rate-limit interceptor
  schema.ts                   # describeGlobal + describe per object -> ConnectorSchema/ConnectorField
  records.ts                  # SOQL queries -> PaginatedRecords + FieldStats computation
  system-objects.ts           # ~130 system object filter patterns (constant + filter function)
  default-selection.ts        # Pre-selection logic: custom objects + common CRM objects
  types.ts                    # Salesforce-specific internal types (SFDescribeResult, SFTokenResponse, etc.)

src/app/api/connectors/salesforce/
  connect/route.ts            # POST -- initiate OAuth2 flow, return authorization URL
  callback/route.ts           # GET  -- exchange code for tokens, create connection
  [connectionId]/
    disconnect/route.ts       # POST -- revoke tokens, transition to DISCONNECTED
    schema/route.ts           # GET  -- retrieve full object list (describeGlobal)
    objects/
      [apiName]/
        fields/route.ts       # GET  -- retrieve fields for one object (describe)
        records/route.ts      # GET  -- paginated records + optional field stats
        count/route.ts        # GET  -- record count (SELECT COUNT())

tests/
  unit/adapters/salesforce/
    auth.test.ts
    schema.test.ts
    records.test.ts
    system-objects.test.ts
    rate-limit.test.ts
  fixtures/salesforce/
    describe-global.json      # Realistic describeGlobal from a Developer Edition
    describe-contact.json     # Realistic describe for Contact object
    query-contacts.json       # Realistic SOQL query result
    token-response.json       # Sample OAuth token response
```

## Phases

### Phase 0: Research
See `research.md` -- jsforce v3, OAuth2/PKCE, SOQL pagination, rate limits.

### Phase 1: Design
See `contracts/api.md` (API route contracts). Data model: none new (uses 000 types + 002 Connection entity).

### Phase 2: Implementation
See `tasks.md` -- 4 phases, 19 tasks.

## Complexity Tracking

> No Constitution violations. This section is intentionally empty.
