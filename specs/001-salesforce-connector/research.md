# Research: Salesforce Source Connector

**Feature**: 001-salesforce-connector
**Date**: 2026-03-19

## Decision 1: Tech Stack (project-wide — first plan defines it)

**Decision**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Prisma + SQLite + Vitest + Playwright

**Rationale**:
- **Frontend**: Next.js + TypeScript is mandated by the constitution (Principle II). Tailwind + shadcn/ui provide a readable, component-based UI system with no custom CSS complexity.
- **Backend**: Next.js Route Handlers (App Router) keep everything in one project — no separate backend service needed. Aligns with local-first v0 simplicity.
- **Database**: SQLite via Prisma — file-based, zero-config, perfect for local-first. Prisma provides type-safe queries and migration tooling. Easy to swap to PostgreSQL later if needed.
- **Testing**: Vitest (fast, TypeScript-native, compatible with Next.js) for unit + integration. Playwright for E2E. Aligns with Principle IV (functional tests on real data).

**Alternatives considered**:
- Separate Express/Fastify backend: rejected — unnecessary complexity for v0, breaks single-deployment model
- PostgreSQL: rejected for v0 — requires external service, overkill for local-first. Will reconsider when moving to hosted SaaS.
- Drizzle ORM: considered — lighter than Prisma but weaker migration tooling. Prisma's schema-first approach aligns better with spec-first culture.
- Jest: rejected — slower, more configuration, less TypeScript-native than Vitest.

## Decision 2: Salesforce API Strategy

**Decision**: REST API for all operations (describe for schema, SOQL for records), via jsforce v2.0+

**Rationale**:
- REST API `describe` endpoints provide complete object and field metadata in a single call, including field-level security flags (`createable`, `updateable`).
- SOQL queries via REST handle record reading with built-in pagination (`queryMore` token pattern, max 2000 records per page).
- `SELECT COUNT() FROM ObjectName` provides efficient record counts.
- jsforce abstracts all of this with automatic token refresh, queryMore handling, and rate limit awareness.

**Alternatives considered**:
- Metadata API: provides deeper schema info (profile-level FLS) but is heavier and slower. REST describe is sufficient for our needs (field accessibility for the connected user). Can be added later if needed.
- Tooling API: designed for development tools (Apex classes, triggers), not data operations. Not relevant.
- Bulk API 2.0: optimal for large data transfers but not needed for preview/browse. Will be relevant for feature 006 (migration execution).
- Raw REST without jsforce: possible but would require reimplementing OAuth2 token management, pagination, and rate limit handling. jsforce is the standard Node.js library and is actively maintained.

## Decision 3: OAuth2 Flow with PKCE

**Decision**: Web Server flow (Authorization Code grant) with PKCE (S256)

**Rationale**:
- The consultant authenticates interactively via browser — this is exactly what the Authorization Code flow is designed for.
- Flow: redirect to Salesforce login → user grants access → callback with auth code → exchange for access + refresh tokens (server-side).
- **PKCE is mandatory**: Salesforce requires PKCE (Proof Key for Code Exchange) for all Connected Apps. The authorization request must include `code_challenge` (S256) and the token exchange must include `code_verifier`.
- **jsforce does not support PKCE natively**: the token exchange must be done via direct HTTP POST to `/services/oauth2/token` with the `code_verifier` parameter, instead of using jsforce's `authorize()` method.
- PKCE code verifiers are stored in-memory keyed by the `state` parameter, with a 10-minute TTL.
- Refresh tokens are long-lived (until revoked) — enables FR-007 (automatic re-authentication on session expiry).
- Access tokens are short-lived (~1 hour) — stored in memory or session, not persisted.
- Refresh tokens stored encrypted in SQLite (FR-006).

**Implementation gotchas** (discovered during v0 implementation):
- **PKCE store must survive hot-reloads**: in Next.js dev mode, modules are re-evaluated on file change. Storing code_verifiers in a module-level `Map` loses them. Solution: attach to `globalThis`.
- **Login URL must match**: the token exchange POST must go to the same Salesforce domain that issued the auth code. For Developer Edition orgs, this is `https://login.salesforce.com`. For sandboxes, `https://test.salesforce.com`. Mismatch causes `invalid_grant`.
- **OAuth scopes**: use `full refresh_token`. The scope `api` alone may not be sufficient, and `id` is not allowed on all editions. The scopes requested must exactly match what's configured in the Connected App.
- **IP Relaxation**: the Connected App must have IP Relaxation set to "Relax IP restrictions" for localhost development. Default is "Enforce IP restrictions" which blocks local callbacks.
- **Connected App propagation delay**: after creating or modifying a Connected App, Salesforce takes up to 10-15 minutes to propagate changes. `invalid_client_id` during this window is expected.

**Alternatives considered**:
- JWT Bearer flow: designed for service-to-service (no user interaction). Would require pre-configured certificates per org — too complex for consultants.
- Username-Password flow: deprecated by Salesforce, less secure, no MFA support.
- Device flow: designed for devices without browser — not applicable.
- jsforce `authorize()` for token exchange: rejected — does not support PKCE code_verifier parameter.

## Decision 4: Schema Snapshot Storage

**Decision**: Store schema snapshots as structured data in SQLite (normalized tables)

**Rationale**:
- Enables querying (e.g., "find all required fields", "diff two snapshots") without parsing JSON.
- Prisma models map directly to spec entities (SourceSchema, SourceObject, SourceField).
- Diff computation is a SQL operation (compare current vs previous snapshot).
- Two snapshots max (per clarification) keeps storage minimal.

**Alternatives considered**:
- Store as JSON blob: simpler write, harder to query and diff. Would require parsing on every read.
- File-based storage (JSON files): no query capability, harder to manage lifecycle. Doesn't align with using SQLite for other data.

## Decision 5: Field-Level Security Detection

**Decision**: Use REST describe response flags (`createable`, `updateable`) to determine field accessibility

**Rationale**:
- The describe response returns these flags per field, reflecting the connected user's actual permissions.
- A field where both `createable` and `updateable` are false AND it's not a formula/calculated field is effectively "no access" for write operations.
- For read access: if a field appears in the describe response, the user can read it. Fields truly invisible due to FLS are simply absent from the describe response.
- To detect these absent fields, we compare against a full schema describe (using the Metadata API's `describeGlobal` which lists all objects regardless of FLS). This enables showing "no access" fields per the spec.

**Alternatives considered**:
- Metadata API FieldPermissions: provides profile-by-profile FLS rules but requires admin-level access and is much heavier. Overkill for showing current user's view.

## Decision 6: Rate Limit Handling

**Decision**: Monitor via `Sforce-Limit-Info` response header + exponential backoff on 429 responses

**Rationale**:
- Every Salesforce REST response includes `Sforce-Limit-Info: api-usage=X/Y` header showing current usage against daily limit.
- jsforce can be configured to log and handle 429 (Too Many Requests) responses.
- Strategy: log usage on every call (Principle VII), warn at 80% usage, pause and inform consultant at limit.
- Daily limits vary by Salesforce edition (Developer: ~1,000; Enterprise: ~20,000).

**Alternatives considered**:
- No rate limit handling: rejected — violates Principle III (data fidelity) and FR-010.
- Pre-fetching all data to minimize calls: risky — could exceed limits faster on large orgs. Better to be incremental and transparent.
