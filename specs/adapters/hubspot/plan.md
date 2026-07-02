# Implementation Plan: HubSpot Adapter

**Branch**: `implement/phase-1-v4` | **Date**: 2026-05-18 | **Spec**: `specs/adapters/hubspot/spec.md`

## Summary

Build the HubSpot destination adapter implementing `ConnectorAdapter` from feature 000. The adapter authenticates via Private App token or OAuth2, retrieves standard and custom CRM objects with their properties, provides record preview with field stats, and supports schema write operations (create properties, create custom objects). Uses `@hubspot/api-client` as the SDK for all HubSpot API interactions.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14+ App Router)
**Primary Dependencies**: @hubspot/api-client, Next.js Route Handlers, Prisma ORM
**Storage**: Neon Postgres via Prisma (shared `Connection` model from feature 006)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web browser (Vercel deployment)
**Project Type**: Connector adapter (service layer + API routes)
**Performance Goals**: Schema browsing <2 min end-to-end; record preview first page <5s; property creation <10s
**Constraints**: Destination connector (canWriteSchema=true); single portal per connection; Custom objects require Enterprise tier
**Scale/Scope**: HubSpot portals with standard objects (5) + custom objects (Enterprise only); up to 100k records per object

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 14 FRs |
| II | Readability | PASS | @hubspot/api-client is the canonical SDK; no custom abstractions |
| III | Data fidelity | PASS | FR-005 retrieves all properties; FR-010 validates before write; no silent omissions |
| IV | Tests on real data | PASS | Will use realistic HubSpot CRM fixtures (not lorem ipsum); contract tests against mock adapter |
| V | Idempotence | PASS | Schema reads are idempotent; property creation checks uniqueness (FR-010) before write |
| VI | Traceability | PASS | FR-013: every operation logged to audit trail |
| VII | Observability | PASS | Console logging on all API calls, rate limits, errors |
| VIII | Modularity | PASS | Isolated adapter at `src/lib/adapters/hubspot/`; public interface = ConnectorAdapter |
| IX | Human-in-the-loop | N/A | Schema write requires explicit user action; no auto-creation |

## Architecture

### Project Structure

```
src/lib/adapters/hubspot/
  hubspot-adapter.ts          # ConnectorAdapter implementation (entry point)
  auth.ts                     # Private App + OAuth2 authentication
  schema.ts                   # Object + property retrieval, snapshot management
  records.ts                  # Record reading + pagination + stats
  schema-write.ts             # Property + custom object creation (canWriteSchema)
  rate-limiter.ts             # 429 detection, Retry-After, exponential backoff
  types.ts                    # HubSpot-specific internal types
  constants.ts                # Standard objects list, creatable property types

src/app/api/connectors/hubspot/
  connect/route.ts            # POST  - Private App token validation
  oauth/route.ts              # GET   - Initiate OAuth2 flow
  oauth/callback/route.ts     # GET   - OAuth2 callback
  [connectionId]/
    disconnect/route.ts       # POST  - Disconnect
    objects/route.ts          # GET   - List objects (standard + custom)
    objects/[apiName]/
      fields/route.ts         # GET   - List properties for object
      records/route.ts        # GET   - Paginated records + stats
    schema-write/
      property/route.ts       # POST  - Create property on object
      object/route.ts         # POST  - Create custom object

tests/unit/adapters/hubspot/
  auth.test.ts
  schema.test.ts
  records.test.ts
  schema-write.test.ts
  rate-limiter.test.ts

tests/fixtures/hubspot/
  account-info.json           # Realistic HubSpot account info response
  objects-standard.json       # Standard CRM objects response
  objects-custom.json         # Custom objects response (Schemas API)
  properties-contacts.json    # Properties for contacts object
  search-contacts.json        # Search API response with records
```

### Adapter Registration

The adapter is registered in `src/lib/adapters/registry.ts`:
```typescript
import { hubspotAdapter } from '@/lib/adapters/hubspot/hubspot-adapter'
// registry: "hubspot" -> hubspotAdapter
```

### Key Design Decisions

1. **Two auth methods in one adapter**: Private App (bearer token, simpler) and OAuth2 (authorization code flow). Both validate via the same account info endpoint. The adapter stores the auth method in the connection config to know how to handle token refresh.
2. **Schema write as separate module**: `schema-write.ts` isolates all mutating operations (property creation, object creation) from read-only operations. Gated by `canWriteSchema=true`.
3. **Rate limiter as wrapper**: All SDK calls go through a rate-limiter that intercepts 429 responses, reads `Retry-After`, and applies exponential backoff transparently.
4. **Standard objects as constants**: The 5 standard objects (contacts, companies, deals, tickets, line_items) are hardcoded. Custom objects come from the Schemas API, which may fail on non-Enterprise portals.

## Phases

### Phase 0: Research
See `research.md` -- @hubspot/api-client SDK, CRM API v3, OAuth2 flow, Properties API, Schemas API.

### Phase 1: Design
See `contracts/api.md` (API route contracts), `data-model.md` (shared model from 006).

### Phase 2: Implementation
See `tasks.md` -- ordered by dependency, grouped by user story.

## Complexity Tracking

No Constitution violations. This section is intentionally empty.
