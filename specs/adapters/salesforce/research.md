# Research: Salesforce Adapter

**Feature**: adapters/salesforce
**Date**: 2026-05-18

## Decision 1: jsforce v3.x as Salesforce SDK

**Decision**: Use jsforce v3.x for all Salesforce REST API interactions after authentication.

**Rationale**: jsforce is the canonical Node.js library for Salesforce. v3.x provides TypeScript-native types, automatic `queryMore` pagination, and `Sforce-Limit-Info` header exposure. It wraps `describeGlobal`, `describe`, and SOQL queries cleanly.

**Critical limitation**: jsforce's `OAuth2.authorize()` does NOT accept a `code_verifier` parameter. The token exchange MUST bypass jsforce and use a direct HTTP POST to `/services/oauth2/token`. After obtaining tokens, create a jsforce `Connection` with the `accessToken` and `instanceUrl` from the response.

**Alternatives**: Raw `fetch` for everything (would reimplement pagination, token refresh, describe parsing -- rejected); `nforce` (less maintained, smaller community); Salesforce's own REST SDK for Node (does not exist as a first-party npm package).

## Decision 2: OAuth2 with PKCE (S256) -- Manual Token Exchange

**Decision**: Authorization Code flow with PKCE. Authorization URL built manually. Token exchange via direct HTTP POST. jsforce used only after tokens are obtained.

**Rationale**: Salesforce mandates PKCE on all Connected Apps. jsforce cannot do the token exchange with a code_verifier. The flow is:

1. Generate `code_verifier` (random 128 bytes, base64url) and `code_challenge` (SHA-256 of verifier, base64url).
2. Store verifier on `globalThis.__pkceStore[state]` (survives Next.js hot-reloads).
3. Redirect consultant to `{loginUrl}/services/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&scope=full+refresh_token&code_challenge=...&code_challenge_method=S256&state=...`.
4. On callback, POST to `{loginUrl}/services/oauth2/token` with `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`, `code_verifier`.
5. Create jsforce `Connection({ accessToken, instanceUrl })`.

**Implementation gotchas** (from spec, confirmed by v3 testing):
- PKCE store MUST be on `globalThis` -- module-level variables are reset on Next.js HMR.
- Login URL MUST match org type: `login.salesforce.com` (production) vs `test.salesforce.com` (sandbox).
- OAuth scopes: `"full refresh_token"` -- `"api"` alone lacks schema access; `"id"` alone lacks data access.
- IP Relaxation MUST be set to "Relax IP restrictions" on the Connected App for localhost dev.
- Connected App propagation: 10-15 min delay after creation/modification.

**Alternatives**: JWT Bearer (no user interaction, needs certs -- rejected for consultant UX); Username-Password (deprecated, no MFA).

## Decision 3: PKCE Verifier Storage on globalThis

**Decision**: Store PKCE code verifiers in a `Map` attached to `globalThis.__pkceStore`, keyed by the OAuth `state` parameter, with a 10-minute TTL.

**Rationale**: In Next.js development mode, Hot Module Replacement re-evaluates modules. A module-level `Map` would lose verifiers on any file save, causing `invalid_grant` on the callback. `globalThis` persists across HMR cycles. A 10-minute TTL prevents accumulation of orphaned verifiers. The `state` key ensures correct verifier retrieval even if multiple OAuth flows are initiated concurrently (unlikely in single-consultant scenario but defensive).

**Production note**: In production (no HMR), a module-level store would work, but `globalThis` is equally valid and keeps the code path identical in dev and prod.

**Alternatives**: Redis/DB storage (overkill for a transient 10-min value); cookie/session (token exchange happens server-side, browser cookie not available in Route Handler context without explicit forwarding).

## Decision 4: System Object Filtering

**Decision**: Maintain a constant array of ~130 known system object patterns in `src/lib/adapters/salesforce/system-objects.ts`. Export a `isSystemObject(apiName: string): boolean` function.

**Patterns** (categories):
- Suffix patterns: `__Share`, `__History`, `__Feed`, `__Tag`, `__ChangeEvent`, `__ViewStat`, `__DataCategorySelection`
- Prefix patterns: `AI`, `Auth`, `Flow`, `Setup`, `DatacloudDand`, `DuplicateRecordItem`
- Exact matches: `ApexClass`, `ApexTrigger`, `AsyncApexJob`, `CronTrigger`, `EmailTemplate`, `EntityDefinition`, `FieldDefinition`, `LoginHistory`, `PermissionSet`, `Profile`, `RecordType`, `UserRole`, etc.

**Rationale**: Salesforce orgs expose 1200+ objects. Without filtering, the object selection list is unusable. The filter is conservative -- it hides only objects that are never migration targets. A documented, maintainable constant is better than a regex-only approach because patterns overlap and evolve.

**Alternatives**: Server-side metadata query for "queryable and not internal" (unreliable -- many internal objects are queryable); regex only (fragile, hard to document).

## Decision 5: SOQL for Records + Count

**Decision**: Use SOQL queries via jsforce for record retrieval and record count.

- Record count: `SELECT COUNT() FROM {objectApiName}` -- single API call, optimized by Salesforce.
- Record page: `SELECT {fields} FROM {objectApiName} LIMIT {pageSize} OFFSET {offset}` where `offset = (page - 1) * pageSize`. 1-indexed pagination per FR-012 of feature 000.
- Field list in SELECT: only accessible fields (from describe result). Skip formula fields that cause SOQL errors.

**Rationale**: SOQL is the standard query language. The OFFSET/LIMIT pattern is simpler than cursor-based `queryMore` for page-addressable preview (consultant can jump to any page). OFFSET works up to 2000 records; beyond that, cursor-based would be needed, but preview is capped at reasonable page sizes (25-100).

**Limitation**: OFFSET has a max of 2000 in standard SOQL. For objects with more records, the UI must use sequential pagination with `queryMore` tokens or limit the preview to the first 2000 records. The spec targets preview (not bulk export), so this is acceptable.

**Alternatives**: Bulk API 2.0 (designed for full extraction, not preview -- overkill); `queryMore` cursor (better for sequential scan but doesn't support random page access).

## Decision 6: Rate Limit Monitoring

**Decision**: Parse `Sforce-Limit-Info: api-usage=X/Y` from every response. Warn at >80% usage. Apply exponential backoff starting at 1s (1s, 2s, 4s, 8s, max 30s) when approaching limit.

**Rationale**: Salesforce daily API limits vary by edition (Developer: ~15,000; Enterprise: ~100,000+). The `Sforce-Limit-Info` header is present on every REST response. Proactive monitoring prevents hard 429 errors. Exponential backoff allows recovery without blocking the consultant indefinitely.

**Implementation**: Wrap jsforce HTTP calls to intercept response headers. jsforce v3 exposes response metadata. Track usage in an in-memory counter per connection. Log every rate limit event to audit trail (FR-015).

**Alternatives**: No monitoring (risk 429 with no warning -- rejected); fixed-rate throttle (too conservative for low-usage orgs).

## Decision 7: Token Refresh Strategy

**Decision**: Intercept 401 responses, use the stored refresh token to obtain a new access token via POST to `/services/oauth2/token` with `grant_type=refresh_token`. If refresh fails, transition connection to EXPIRED status.

**Rationale**: Salesforce access tokens expire after ~1 hour. Refresh tokens are long-lived (until revoked or policy-expired). Transparent refresh avoids re-authentication prompts. If the refresh token itself is invalid (revoked by admin, password changed), the connection must move to EXPIRED so the consultant re-authenticates.

**Implementation**: The jsforce `Connection` can be configured with `refreshFn` callback. Alternatively, intercept at the adapter level. We use adapter-level interception because the initial token exchange is already manual (PKCE), so the refresh path should be consistent.

## Decision 8: Field Stats Computation

**Decision**: Compute field stats (null count, distinct count, sample values) server-side from the SOQL query results, returned alongside paginated records when requested.

**Rationale**: The spec (FR-011) requires per-field stats from retrieved records. Computing server-side avoids sending full record data to the client just for stats. The adapter's `getFieldStats` method accepts field names and queries the data. For the preview use case, stats are based on the fetched page (scope clearly labeled). Feature 010 spec allows client-side computation from preview data as an alternative -- the adapter supports both paths.

**Alternatives**: Client-side only (would work for small pages but requires sending all data to browser); full-dataset stats via aggregation SOQL (expensive, multiple queries per field -- deferred to future enhancement).
