# Tasks: Salesforce Adapter

**Input**: `specs/adapters/salesforce/`
**Prerequisites**: 000-connector-interface (types + registry implemented)

## Phase 1: Adapter Core (auth + client)

- [ ] T001 Create Salesforce-specific internal types (`SFTokenResponse`, `SFDescribeGlobalResult`, `SFDescribeResult`, `SFFieldDescribe`, `SFQueryResult`, `RateLimitInfo`) in `src/lib/adapters/salesforce/types.ts`. These are internal to the adapter; the public surface uses 000 interface types.
- [ ] T002 Implement PKCE helpers (`generateCodeVerifier`, `computeCodeChallenge`, `storeVerifier`, `retrieveVerifier`, `cleanExpired`) in `src/lib/adapters/salesforce/pkce.ts`. Verifiers stored on `globalThis.__pkceStore` keyed by state, 10-minute TTL. Include inline comment explaining why globalThis (Next.js HMR). (FR-004)
- [ ] T003 Implement OAuth2 auth module (`buildAuthorizationUrl`, `exchangeCodeForTokens`, `refreshAccessToken`) in `src/lib/adapters/salesforce/auth.ts`. `buildAuthorizationUrl` generates PKCE challenge (S256), includes scope `full refresh_token`, stores verifier. `exchangeCodeForTokens` does direct HTTP POST to `/services/oauth2/token` with code_verifier -- does NOT use jsforce OAuth2.authorize(). `refreshAccessToken` does POST with `grant_type=refresh_token`. (FR-002, FR-003, FR-013, FR-014)
- [ ] T004 Implement jsforce client factory (`createConnection`, `getConnection`, `withTokenRefresh`) in `src/lib/adapters/salesforce/client.ts`. `createConnection` instantiates `jsforce.Connection` from accessToken + instanceUrl. `withTokenRefresh` wraps any adapter call: on 401, calls `refreshAccessToken`, retries once, on second failure transitions to EXPIRED. (FR-005, FR-013)

**Checkpoint**: Auth module builds and compiles. PKCE generate/store/retrieve cycle works. Token exchange function signature is correct (direct HTTP POST, not jsforce).

---

## Phase 2: Schema + Object Selection

- [ ] T005 Implement system object filter (`SYSTEM_OBJECT_PATTERNS`, `isSystemObject`) in `src/lib/adapters/salesforce/system-objects.ts`. Document all ~130 patterns grouped by category (suffix, prefix, exact match). Export `isSystemObject(apiName: string): boolean` and `filterSystemObjects(objects: ConnectorObject[]): ConnectorObject[]`. (FR-007)
- [ ] T006 Implement default selection logic (`computeDefaultSelection`) in `src/lib/adapters/salesforce/default-selection.ts`. Pre-selects: all custom objects (`__c` suffix), common CRM objects (`COMMON_CRM_OBJECTS` constant: Account, Contact, Lead, Opportunity, Case, Campaign, Task, Event, Note, Attachment, ContentDocument). Returns `ConnectorObject[]` with `isSelected` flag set. (FR-008)
- [ ] T007 Implement schema retrieval (`getSchema`) in `src/lib/adapters/salesforce/schema.ts`. Calls `describeGlobal()` via jsforce, maps `sobjects[]` to `ConnectorObject[]` (apiName, label, description from `sobject.label`, isCustom from `sobject.custom`). Returns `ConnectorSchema`. (FR-006)
- [ ] T008 Implement field retrieval (`getFields`) in `src/lib/adapters/salesforce/schema.ts`. Calls `describe(objectApiName)` via jsforce, maps `fields[]` to `ConnectorField[]`. Mapping: `field.name` -> apiName, `field.label` -> label, `field.type` -> dataType (raw SF type string), `field.nillable === false && field.defaultValue === null` -> isRequired, `!field.updateable` -> isReadOnly, `field.unique` -> isUnique, `field.referenceTo[0]` -> referenceTo, relationship type derived from `field.relationshipOrder` (0=lookup, 1=master-detail) and `field.externalId`. FLS: if `!field.accessible`, include field with `_isAccessible: false`. (FR-009)

**Checkpoint**: `getSchema()` returns full object list from a Salesforce org. `getFields("Contact")` returns all Contact fields with correct types and relationship info. System objects are correctly filtered. Default selection includes custom + CRM objects.

---

## Phase 3: Records + Stats + Rate Limits

- [ ] T009 Implement record retrieval (`getRecords`) in `src/lib/adapters/salesforce/records.ts`. Builds SOQL: `SELECT {accessibleFields} FROM {apiName} LIMIT {pageSize} OFFSET {(page-1)*pageSize}`. Page is 1-indexed (feature 000 FR-012). Returns `PaginatedRecords`. Uses `getRecordCount` for `totalCount` (separate query, cached per request cycle). Handles OFFSET > 2000 with clear error. (FR-010)
- [ ] T010 Implement record count (`getRecordCount`) in `src/lib/adapters/salesforce/records.ts`. Executes `SELECT COUNT() FROM {apiName}`. Returns `number`. (mapped to ConnectorAdapter.getRecordCount)
- [ ] T011 Implement field stats computation (`getFieldStats`) in `src/lib/adapters/salesforce/records.ts`. Accepts field API names, fetches a sample via SOQL (default 200 records), computes per-field: nullCount, distinctCount, sampleValues (up to 5 unique non-null). Returns `FieldStats[]`. (FR-011)
- [ ] T012 Implement rate limit monitor in `src/lib/adapters/salesforce/client.ts`. Parse `Sforce-Limit-Info: api-usage=X/Y` from jsforce response headers. Track current usage. When usage > 80% of limit: log warning to audit trail, apply exponential backoff (1s base, 2x multiplier, 30s max) before next request. Expose `getRateLimitStatus(): { used: number, limit: number, percentUsed: number }`. (FR-012)

**Checkpoint**: `getRecords("Contact", 1, 50)` returns 50 records with correct pagination. `getFieldStats("Contact", ["FirstName", "Email"])` returns accurate stats. Rate limit monitor logs warnings at >80%.

---

## Phase 4: API Routes + Adapter Registration

- [ ] T013 Create `POST /api/connectors/salesforce/connect` route in `src/app/api/connectors/salesforce/connect/route.ts`. Validates env vars, calls `buildAuthorizationUrl`, returns `{ authorizationUrl }`. Logs to audit trail. (FR-002)
- [ ] T014 Create `GET /api/connectors/salesforce/callback` route in `src/app/api/connectors/salesforce/callback/route.ts`. Retrieves verifier by state, calls `exchangeCodeForTokens`, creates ConnectorConnection (status CONNECTED, org info from token response `id` field), redirects to source page with `?connected=salesforce`. On error, redirects with `?error=...`. Detects PKCE store miss (hot-reload) and suggests restarting flow. (FR-002, FR-003, FR-004)
- [ ] T015 [P] Create `POST /api/connectors/salesforce/{connectionId}/disconnect` route. Revokes token, clears stored credentials, returns `{ status: "DISCONNECTED" }`. Logs to audit trail.
- [ ] T016 [P] Create `GET /api/connectors/salesforce/{connectionId}/schema` route. Calls adapter `getSchema`, returns `ConnectorSchema` + metadata. Logs to audit trail.
- [ ] T017 [P] Create `GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/fields` route. Calls adapter `getFields`, returns `ConnectorField[]` with accessibility info. Logs to audit trail.
- [ ] T018 [P] Create `GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/records` route. Validates `page >= 1` and `pageSize` bounds. Calls adapter `getRecords`. Returns `PaginatedRecords`. Logs to audit trail. (000 FR-012: page is 1-indexed)
- [ ] T019 [P] Create `GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/count` route. Calls adapter `getRecordCount`. Returns `{ count }`. Logs to audit trail.
- [ ] T020 Register Salesforce adapter in `src/lib/adapters/registry.ts` as `"salesforce"` -> `salesforceAdapter`. Import from `src/lib/adapters/salesforce/index.ts`.
- [ ] T021 Create adapter entry point `src/lib/adapters/salesforce/index.ts`. Composes all modules into a `ConnectorAdapter` implementation. Sets capabilities: `{ canRead: true, canWrite: false, canWriteSchema: false }`. Exports the adapter object. (FR-001)

**Checkpoint**: All API routes respond correctly. Adapter registered in registry. Full OAuth flow works end-to-end: connect -> callback -> schema -> fields -> records -> disconnect.

---

## Phase 5: Tests + Fixtures

- [ ] T022 Create realistic Salesforce test fixtures in `tests/fixtures/salesforce/`: `describe-global.json` (subset of a real Developer Edition describeGlobal with ~50 objects including system, standard, and custom), `describe-contact.json` (full Contact describe with ~67 fields including relationships and FLS-restricted fields), `query-contacts.json` (25 Contact records with nulls, lookups, various types), `token-response.json` (sample token exchange response). (Constitution IV)
- [ ] T023 [P] Create unit tests for PKCE module in `tests/unit/adapters/salesforce/pkce.test.ts`: verifier generation (length, charset), challenge computation (SHA-256 + base64url), store/retrieve cycle, TTL expiration, concurrent state keys.
- [ ] T024 [P] Create unit tests for system object filter in `tests/unit/adapters/salesforce/system-objects.test.ts`: suffix patterns (__Share, __History, etc.), prefix patterns (AI*, Auth*, etc.), exact matches (ApexClass, etc.), non-system objects pass through (Account, Contact, Invoice__c), edge cases (empty string, objects with similar names).
- [ ] T025 [P] Create unit tests for schema module in `tests/unit/adapters/salesforce/schema.test.ts`: describeGlobal mapping to ConnectorObject, describe mapping to ConnectorField (all field types), FLS-restricted field handling, relationship type derivation. Uses fixtures.
- [ ] T026 [P] Create unit tests for records module in `tests/unit/adapters/salesforce/records.test.ts`: SOQL generation (correct fields, LIMIT, OFFSET), 1-indexed pagination, OFFSET > 2000 error, field stats computation (null count, distinct count, sample values), empty result handling. Uses fixtures.
- [ ] T027 [P] Create unit tests for rate limit monitor in `tests/unit/adapters/salesforce/rate-limit.test.ts`: header parsing, threshold detection (>80%), backoff timing, recovery when usage drops.

**Checkpoint**: All unit tests pass. Fixtures represent realistic Salesforce data. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately
- **T002**: No deps -- parallel with T001
- **T003**: Depends on T001 (types) + T002 (PKCE helpers)
- **T004**: Depends on T001 (types) + T003 (auth for refresh)
- **T005, T006**: Depend on T001 (types). Parallel-safe with each other.
- **T007, T008**: Depend on T004 (client). T008 depends on T007 (schema module file).
- **T009, T010, T011**: Depend on T004 (client) + T008 (field list for SOQL generation). T010 and T011 depend on T009 (same file).
- **T012**: Depends on T004 (client module). Can parallel with T009-T011.
- **T013, T014**: Depend on T003 (auth). Sequential (connect before callback).
- **T015-T019**: Depend on T007-T012 (adapter methods). All parallel-safe.
- **T020, T021**: Depend on T007-T012 (all adapter methods implemented).
- **T022**: No deps -- can start early. Ideally before T023-T027.
- **T023-T027**: Depend on T022 (fixtures) + respective source modules. All parallel-safe.

### Parallel Opportunities

```
Phase 1: [T001 | T002] -> T003 -> T004
Phase 2: [T005 | T006] parallel with T007 -> T008
Phase 3: T009 -> [T010 | T011], T012 parallel
Phase 4: T013 -> T014, [T015 | T016 | T017 | T018 | T019] parallel, T020 + T021 after all
Phase 5: T022 first, then [T023 | T024 | T025 | T026 | T027] all parallel
```
