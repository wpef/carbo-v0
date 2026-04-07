# Tasks: HubSpot Adapter

**Input**: `specs/adapters/hubspot/`
**Prerequisites**: 000-connector-interface (types.ts must exist), plan.md, spec.md, research.md, contracts/api.md

## Phase 1: Setup

- [ ] T001 Install @hubspot/api-client: `npm install @hubspot/api-client`
- [ ] T002 [P] Create adapter-specific types at `src/lib/connectors/hubspot/hubspot-types.ts`: HubSpotConfig (discriminated union: private-app vs oauth2), HubSpotTokenResponse, CreatablePropertyType union, PropertyCreateInput, ObjectCreateInput

## Phase 2: Authentication (US1 — Connect to HubSpot)

**Goal**: Consultant can authenticate via Private App token or OAuth2.

**Independent Test**: Private App token validated; OAuth2 flow completes; portal name displayed.

### Implementation

- [ ] T003 Create auth module at `src/lib/connectors/hubspot/hubspot-auth.ts`: validatePrivateAppToken(accessToken) calls account info endpoint and returns portal details, buildOAuthUrl(config, state) generates HubSpot authorization URL, exchangeOAuthCode(config, code) exchanges code for tokens, refreshOAuthToken(config, refreshToken) refreshes access token. Use @hubspot/api-client for token validation.
- [ ] T004 Create Private App auth route at `src/app/api/connectors/hubspot/auth/route.ts`: POST handler validates Private App token, GET handler initiates OAuth2 flow. Both log to audit trail.
- [ ] T005 Create OAuth2 callback route at `src/app/api/connectors/hubspot/callback/route.ts`: GET handler exchanges code for tokens, validates, logs to audit trail, redirects to plan page.

**Checkpoint**: Both auth methods work. Connection established.

---

## Phase 3: Schema Retrieval (US2 — Browse HubSpot schema)

**Goal**: After auth, retrieve all objects (standard + custom) and properties.

### Implementation

- [ ] T006 Create constants at `src/lib/connectors/hubspot/hubspot-constants.ts`: STANDARD_OBJECTS list (contacts, companies, deals, tickets, line_items with labels), CREATABLE_PROPERTY_TYPES list, DEFAULT_PROPERTY_GROUPS map, env var key constants
- [ ] T007 Create schema module at `src/lib/connectors/hubspot/hubspot-schema.ts`: getStandardObjects() returns hardcoded ConnectorObject list, getCustomObjects(client) calls Schemas API with 403 graceful degradation, getProperties(client, objectType) calls Properties API and maps to ConnectorField[]. Handle property types (string, number, date, datetime, enumeration, boolean) and read-only detection.

**Checkpoint**: Schema retrieval returns standard + custom objects with properties.

---

## Phase 4: Records & Stats (US3 — Preview records)

**Goal**: Query records via Search API and compute property stats.

### Implementation

- [ ] T008 Create records module at `src/lib/connectors/hubspot/hubspot-records.ts`: searchRecords(client, objectType, properties, page, pageSize) uses Search API with cursor pagination, mapToConnectorRecords(searchResults) converts to ConnectorRecord[], calculateFieldStats(records, fields) computes null count/distinct count/sample values per property. Handle cursor-to-page mapping for PaginatedRecords.

**Checkpoint**: Record queries return PaginatedRecords; stats computed.

---

## Phase 5: Schema Write (US4 — Create properties and objects)

**Goal**: Create new properties and custom objects in HubSpot.

### Implementation

- [ ] T009 Create schema write module at `src/lib/connectors/hubspot/hubspot-schema-write.ts`: createProperty(client, objectType, input) validates locally (name uniqueness against cached schema, type validity), then calls Properties API. createCustomObject(client, objectDef) calls Schemas API with Enterprise tier detection. Both log to audit trail.

**Checkpoint**: Properties and custom objects can be created.

---

## Phase 6: Adapter Integration (US5 — Full adapter)

**Goal**: Wire all modules into a single ConnectorAdapter implementation.

### Implementation

- [ ] T010 Create main adapter at `src/lib/connectors/hubspot/hubspot-adapter.ts`: implements ConnectorAdapter with canRead=true, canWrite=false, canWriteSchema=true. Methods delegate to auth, schema, records, and schema-write modules. Includes rate limit handling (detect 429, read Retry-After, exponential backoff), token lifecycle (OAuth2 refresh, Private App EXPIRED), and audit logging on every operation.
- [ ] T011 Create barrel export at `src/lib/connectors/hubspot/index.ts`: export HubSpotAdapter class and HubSpotConfig type.

**Checkpoint**: HubSpotAdapter is a complete ConnectorAdapter implementation.

---

## Phase 7: Tests

- [ ] T012 [P] Create test fixtures at `tests/fixtures/hubspot/objects-standard.json` (5 standard objects), `properties-contacts.json` (~60 properties of varied types), `records-contacts.json` (25 records with nulls/varied values)
- [ ] T013 [P] Create auth unit tests at `tests/unit/connectors/hubspot/auth.test.ts`: test Private App token validation (valid, invalid, revoked), test OAuth2 URL generation, test OAuth2 code exchange
- [ ] T014 [P] Create schema unit tests at `tests/unit/connectors/hubspot/schema.test.ts`: test standard objects list, test custom objects with 403 graceful degradation, test property mapping (types, read-only, group)
- [ ] T015 [P] Create records unit tests at `tests/unit/connectors/hubspot/records.test.ts`: test Search API pagination (cursor to page mapping), test field stats calculation
- [ ] T016 [P] Create schema write unit tests at `tests/unit/connectors/hubspot/schema-write.test.ts`: test property creation with local validation (duplicate name, invalid type), test custom object creation, test Enterprise tier detection
- [ ] T017 Create adapter integration test at `tests/unit/connectors/hubspot/adapter.test.ts`: test full adapter with mocked @hubspot/api-client (connect -> getSchema -> getFields -> getRecords -> createField flow), verify audit logging, verify rate limit handling

**Checkpoint**: All tests pass.

---

## Dependencies & Execution Order

- **T001**: No deps
- **T002**: Can run in parallel with T001 (just type definitions)
- **T003**: Depends on T002 (types)
- **T004**: Depends on T003 (auth module)
- **T005**: Depends on T003 (auth module). Can run in parallel with T004.
- **T006**: No deps on auth. Can run in parallel with Phase 2.
- **T007**: Depends on T006 (constants), depends on 000-connector-interface types
- **T008**: Depends on 000-connector-interface types. Can run in parallel with T007.
- **T009**: Depends on T007 (schema module for cached schema validation)
- **T010**: Depends on T003, T007, T008, T009 (all modules). Central integration point.
- **T011**: Depends on T010
- **T012**: No code deps — can run in parallel with any task
- **T013-T016**: Depend on their respective modules. Parallel-safe with each other.
- **T017**: Depends on T010 (full adapter)
