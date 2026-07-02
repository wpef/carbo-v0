# Tasks: HubSpot Adapter

**Input**: `specs/adapters/hubspot/`
**Prerequisites**: 000-connector-interface (types + registry implemented)

## Phase 1: Adapter Core (types, constants, auth)

- [ ] T001 Create HubSpot-specific internal types (`HubSpotConnectionConfig`, `HSAccountInfo`, `HSObjectSchema`, `HSPropertyDefinition`, `HSPropertyOption`, `HSSearchResponse`, `HSRecord`, `HSCreatePropertyRequest`, `HSCreateObjectRequest`, `HSCreatableType`, `CursorCache`) in `src/lib/adapters/hubspot/types.ts`. These are internal to the adapter; the public surface uses 000 interface types.
- [ ] T002 [P] Create constants (`STANDARD_OBJECTS`, `CREATABLE_PROPERTY_TYPES`, `NON_CREATABLE_TYPES`, `HUBSPOT_OAUTH_SCOPES`) in `src/lib/adapters/hubspot/constants.ts`. Standard objects: contacts, companies, deals, tickets, line_items. Creatable types: string, number, date, datetime, enumeration, bool. Non-creatable types: calculation, score, rich_text, object_coordinates.
- [ ] T003 Implement authentication module (`validatePrivateAppToken`, `buildOAuthAuthorizationUrl`, `exchangeCodeForTokens`, `refreshOAuthToken`) in `src/lib/adapters/hubspot/auth.ts`. `validatePrivateAppToken` calls `GET /account-info/v3/details` via the SDK to verify the token and extract portal info. `buildOAuthAuthorizationUrl` generates the authorization URL with required scopes and CSRF state. `exchangeCodeForTokens` calls `POST /oauth/v1/token` with `grant_type=authorization_code`. `refreshOAuthToken` calls `POST /oauth/v1/token` with `grant_type=refresh_token`. (FR-002, FR-012)
- [ ] T004 Implement rate limiter (`withRateLimit`) in `src/lib/adapters/hubspot/rate-limiter.ts`. Wraps any async function. On 429 response: reads `Retry-After` header, waits the specified duration + random jitter (0-500ms), retries. Exponential backoff on subsequent retries (2x multiplier). Max 3 retries. Logs each rate limit event to audit trail. (FR-011)

**Checkpoint**: Types compile. Constants defined. Private App token validation works against a real HubSpot portal. Rate limiter catches 429 and retries.

---

## Phase 2: Schema Retrieval (objects + properties)

- [ ] T005 Implement object retrieval (`getSchema`) in `src/lib/adapters/hubspot/schema.ts`. Builds the object list from two sources: (1) hardcoded `STANDARD_OBJECTS` mapped to `ConnectorObject` with `isCustom=false`; (2) custom objects from Schemas API (`client.crm.schemas.coreApi.getAll()`) mapped with `isCustom=true`. If Schemas API returns 403 (non-Enterprise portal), log informational message and continue with standard objects only -- no exception propagated. (FR-003, FR-004)
- [ ] T006 Implement property retrieval (`getFields`) in `src/lib/adapters/hubspot/schema.ts`. Calls `client.crm.properties.coreApi.getAll(objectType)`. Maps `HSPropertyDefinition` to `ConnectorField`: `name` -> apiName, `label` -> label, `type` -> dataType (raw HubSpot type), `modificationMetadata.readOnlyValue` -> isReadOnly, `hasUniqueValue` -> isUnique, `isRequired` = false (HubSpot enforces at form level, not API level). Adds `isCreatable` flag: true if type is in `CREATABLE_PROPERTY_TYPES` and not calculated. Adds `groupName`, `fieldType`, `description` as extended metadata. For enumeration types, includes `options` array. (FR-005)

**Checkpoint**: `getSchema()` returns 5 standard objects (+ custom if Enterprise). `getFields("contacts")` returns all contact properties with correct types and metadata. Non-Enterprise portals gracefully degrade.

---

## Phase 3: Records + Stats

- [ ] T007 Implement record retrieval (`getRecords`) in `src/lib/adapters/hubspot/records.ts`. Uses HubSpot Search API (`client.crm.{objectType}.searchApi.doSearch`). Page is 1-indexed per feature 000 FR-012. Internally uses cursor-based pagination: page 1 = no `after` param; page N = look up cached cursor from page N-1's response. Implements cursor cache (`Map<number, string | undefined>`) per connection+object, with 30-minute TTL. `pageSize` max 100 (HubSpot limit). Returns `PaginatedRecords`. Null property values preserved as `null` in response. (FR-006)
- [ ] T008 Implement record count (`getRecordCount`) in `src/lib/adapters/hubspot/records.ts`. Uses Search API with `limit=0` to get `total` without fetching records. Returns `number`.
- [ ] T009 Implement field stats computation (`getFieldStats`) in `src/lib/adapters/hubspot/records.ts`. Accepts field API names, fetches a sample via Search API (default 200 records, max 2000). Computes per-field: nullCount (count of null or empty string values), distinctCount, sampleValues (up to 5 unique non-null). Returns `FieldStats[]`. (FR-007)

**Checkpoint**: `getRecords("contacts", 1, 25)` returns 25 records with correct pagination. Cursor cache enables page 2+ without re-walking. `getFieldStats("contacts", ["firstname", "email"])` returns accurate stats.

---

## Phase 4: Schema Write (properties + custom objects)

- [ ] T010 Implement property creation (`createField`) in `src/lib/adapters/hubspot/schema-write.ts`. Local validation before API call (FR-010): (1) name uniqueness check against cached property list from `getFields`, (2) type in `CREATABLE_PROPERTY_TYPES`, (3) required fields present (name, label, type, fieldType, groupName). Calls `client.crm.properties.coreApi.create(objectType, propertyInput)`. Maps HubSpot response to `ConnectorField`. Handles: 409 Conflict (property exists -- return existing property details), 400 Bad Request (invalid type/missing fields), custom property limit (forward HubSpot error). Logs creation to audit trail. (FR-008, FR-010)
- [ ] T011 Implement custom object creation (`createObject`) in `src/lib/adapters/hubspot/schema-write.ts`. Calls `client.crm.schemas.coreApi.create(objectInput)`. Maps response to `ConnectorObject`. Handles: 403 (non-Enterprise -- return clear tier requirement error per FR-009), 409 (object exists), 400 (invalid input). Logs creation to audit trail. (FR-009)

**Checkpoint**: `createField("contacts", { name: "migration_source_id", ... })` creates the property in HubSpot and returns a `ConnectorField`. Duplicate name is caught locally before API call. `createObject(...)` works on Enterprise or returns clear error on non-Enterprise.

---

## Phase 5: API Routes + Adapter Registration

- [ ] T012 Create `POST /api/connectors/hubspot/connect` route in `src/app/api/connectors/hubspot/connect/route.ts`. Accepts `{ accessToken }` in body. Calls `validatePrivateAppToken`. Creates ConnectorConnection with `authMethod: "private_app"`, status CONNECTED, portal info. Returns connection object. Logs to audit trail. (FR-002)
- [ ] T013 Create `GET /api/connectors/hubspot/oauth` route in `src/app/api/connectors/hubspot/oauth/route.ts`. Validates env vars (`HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`). Calls `buildOAuthAuthorizationUrl`. Returns `{ authorizationUrl }`. Logs to audit trail. (FR-002)
- [ ] T014 Create `GET /api/connectors/hubspot/oauth/callback` route in `src/app/api/connectors/hubspot/oauth/callback/route.ts`. Verifies CSRF `state`. Calls `exchangeCodeForTokens`. Validates account via SDK. Creates ConnectorConnection with `authMethod: "oauth2"`, status CONNECTED, portal info. Redirects to `/plans/{planId}/destination?connected=hubspot`. Logs to audit trail. (FR-002)
- [ ] T015 [P] Create `POST /api/connectors/hubspot/{connectionId}/disconnect` route. Clears stored tokens, transitions status to DISCONNECTED. Returns `{ status: "DISCONNECTED" }`. Logs to audit trail. (FR-013)
- [ ] T016 [P] Create `GET /api/connectors/hubspot/{connectionId}/objects` route. Calls adapter `getSchema`. Returns `ConnectorObject[]` with `customObjectsNote` when custom objects are unavailable. Logs to audit trail. (FR-003, FR-004)
- [ ] T017 [P] Create `GET /api/connectors/hubspot/{connectionId}/objects/{apiName}/fields` route. Calls adapter `getFields`. Returns `ConnectorField[]` with extended metadata (groupName, fieldType, isCreatable, options). Logs to audit trail. (FR-005)
- [ ] T018 [P] Create `GET /api/connectors/hubspot/{connectionId}/objects/{apiName}/records` route. Validates `page >= 1` and `pageSize <= 100`. Calls adapter `getRecords`. Optionally includes field stats if `includeStats=true`. Returns `PaginatedRecords`. Logs to audit trail. (FR-006, FR-007, 000 FR-012: page is 1-indexed)
- [ ] T019 [P] Create `POST /api/connectors/hubspot/{connectionId}/schema-write/property` route. Validates request body. Calls adapter `createField`. Returns created `ConnectorField`. Logs to audit trail. (FR-008, FR-010)
- [ ] T020 [P] Create `POST /api/connectors/hubspot/{connectionId}/schema-write/object` route. Validates request body. Calls adapter `createObject`. Returns created `ConnectorObject`. Logs to audit trail. (FR-009)
- [ ] T021 Register HubSpot adapter in `src/lib/adapters/registry.ts` as `"hubspot"` -> `hubspotAdapter`. Import from `src/lib/adapters/hubspot/hubspot-adapter.ts`.
- [ ] T022 Create adapter entry point `src/lib/adapters/hubspot/hubspot-adapter.ts`. Composes all modules into a `ConnectorAdapter` implementation. Sets capabilities: `{ canRead: true, canWrite: false, canWriteSchema: true }`. Implements all required methods + optional `createObject` and `createField`. Wraps all SDK calls with `withRateLimit` and token refresh logic (OAuth2: attempt refresh on 401; Private App: transition to EXPIRED on 401). Exports the adapter object. (FR-001, FR-011, FR-012, FR-014)

**Checkpoint**: All API routes respond correctly. Adapter registered in registry. Both auth flows work end-to-end: Private App connect -> objects -> fields -> records -> disconnect. OAuth2 connect -> callback -> objects -> fields -> records -> disconnect. Schema write routes create properties and objects.

---

## Phase 6: Tests + Fixtures

- [ ] T023 Create realistic HubSpot test fixtures in `tests/fixtures/hubspot/`: `account-info.json` (portal details response), `objects-standard.json` (5 standard objects), `objects-custom.json` (Schemas API response with 2 custom objects), `properties-contacts.json` (full contacts property list with ~30 properties including enumerations, read-only, calculated), `search-contacts.json` (25 contact records with nulls, various property types), `create-property-response.json` (successful property creation response), `create-object-response.json` (successful custom object creation response). (Constitution IV)
- [ ] T024 [P] Create unit tests for auth module in `tests/unit/adapters/hubspot/auth.test.ts`: Private App token validation (success, invalid token, network error), OAuth2 URL generation (correct scopes, state param), code exchange (success, invalid code, state mismatch), token refresh (success, expired refresh token).
- [ ] T025 [P] Create unit tests for schema module in `tests/unit/adapters/hubspot/schema.test.ts`: standard object list (always 5), custom object retrieval (Enterprise), custom object graceful degradation (non-Enterprise 403), property mapping to ConnectorField (all types), isCreatable flag logic, enumeration options mapping. Uses fixtures.
- [ ] T026 [P] Create unit tests for records module in `tests/unit/adapters/hubspot/records.test.ts`: Search API pagination (cursor caching, page 1 vs page N), 1-indexed page validation, pageSize capped at 100, field stats computation (null count, distinct count, sample values), empty result handling. Uses fixtures.
- [ ] T027 [P] Create unit tests for schema-write module in `tests/unit/adapters/hubspot/schema-write.test.ts`: property creation (success, duplicate name caught locally, invalid type rejected, 409 from API), custom object creation (success, 403 Enterprise tier error). Uses fixtures.
- [ ] T028 [P] Create unit tests for rate limiter in `tests/unit/adapters/hubspot/rate-limiter.test.ts`: 429 detection, Retry-After header parsing, backoff timing (1x, 2x, 4x), max retry limit (3), jitter application.
- [ ] T029 Create contract test suite in `tests/unit/adapters/hubspot/contract.test.ts`: validate HubSpot adapter against `ConnectorAdapter` interface. Verify: all required methods exist, capabilities = `{ canRead: true, canWrite: false, canWriteSchema: true }`, optional methods `createObject` and `createField` are defined (not undefined), `getRecords` with page=1 returns currentPage=1.

**Checkpoint**: All unit tests and contract tests pass. Fixtures represent realistic HubSpot data. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately
- **T002**: No deps -- parallel with T001
- **T003**: Depends on T001 (types) + T002 (constants for scopes)
- **T004**: Depends on T001 (types). Can parallel with T003.
- **T005**: Depends on T002 (constants) + T003 (auth for SDK client) + T004 (rate limiter)
- **T006**: Depends on T002 (constants) + T003 (auth) + T004 (rate limiter). Can parallel with T005.
- **T007**: Depends on T001 (types) + T003 (auth) + T004 (rate limiter)
- **T008, T009**: Depend on T007 (same file, cursor cache). Sequential after T007.
- **T010**: Depends on T006 (getFields for uniqueness check) + T002 (creatable types)
- **T011**: Depends on T005 (getSchema for object context) + T004 (rate limiter)
- **T012**: Depends on T003 (auth)
- **T013, T014**: Depend on T003 (auth). Sequential (OAuth setup before callback).
- **T015-T020**: Depend on T005-T011 (adapter methods). All parallel-safe.
- **T021, T022**: Depend on T005-T011 (all adapter methods implemented).
- **T023**: No deps -- can start early. Ideally before T024-T029.
- **T024-T029**: Depend on T023 (fixtures) + respective source modules. All parallel-safe.

### Parallel Opportunities

```
Phase 1: [T001 | T002] -> [T003 | T004]
Phase 2: [T005 | T006] (after Phase 1)
Phase 3: T007 -> [T008 | T009]
Phase 4: [T010 | T011] (after Phase 2/3)
Phase 5: T012, T013 -> T014, [T015 | T016 | T017 | T018 | T019 | T020] parallel, T021 + T022 after all
Phase 6: T023 first, then [T024 | T025 | T026 | T027 | T028 | T029] all parallel
```
