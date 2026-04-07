# Tasks: Salesforce Adapter

**Input**: `specs/adapters/salesforce/`
**Prerequisites**: 000-connector-interface (types.ts must exist), plan.md, spec.md, research.md, contracts/api.md

## Phase 1: Setup

- [ ] T001 Install jsforce v3: `npm install jsforce@3` and `npm install -D @types/jsforce` if needed
- [ ] T002 [P] Create adapter-specific types at `src/lib/connectors/salesforce/salesforce-types.ts`: SalesforceConfig (clientId, clientSecret, callbackUrl, loginUrl), SalesforceTokenResponse, PkceChallenge (verifier, challenge)

## Phase 2: Authentication (US1 — OAuth2+PKCE)

**Goal**: Consultant can authenticate with Salesforce via OAuth2+PKCE.

**Independent Test**: Auth URL generated correctly; callback exchanges code for tokens; PKCE verifier survives hot-reload.

### Implementation

- [ ] T003 Create PKCE utilities and OAuth functions at `src/lib/connectors/salesforce/salesforce-auth.ts`: generatePkceChallenge() (code_verifier + code_challenge via SHA-256), buildAuthorizationUrl(config, state, codeChallenge), exchangeCodeForTokens(config, code, codeVerifier), refreshAccessToken(config, refreshToken). PKCE store on `globalThis.__pkceStore` as Map<string, string>.
- [ ] T004 Create OAuth initiation route at `src/app/api/connectors/salesforce/auth/route.ts`: GET handler generates PKCE, stores verifier on globalThis, redirects to Salesforce auth URL with code_challenge. Validates planId query param.
- [ ] T005 Create OAuth callback route at `src/app/api/connectors/salesforce/callback/route.ts`: GET handler retrieves verifier from globalThis, exchanges code for tokens via direct POST, logs to audit trail, redirects to plan page.

**Checkpoint**: OAuth flow completes end-to-end. Tokens obtained.

---

## Phase 3: Schema Retrieval (US2 — Browse Salesforce schema)

**Goal**: After auth, retrieve all objects and fields from Salesforce.

### Implementation

- [ ] T006 Create system object filter constants at `src/lib/connectors/salesforce/salesforce-constants.ts`: SYSTEM_OBJECT_PATTERNS (suffix, prefix, exact match arrays), DEFAULT_CRM_OBJECTS list, isSystemObject(apiName) function, isDefaultSelected(apiName, isCustom) function. Include env var key constants.
- [ ] T007 Create schema module at `src/lib/connectors/salesforce/salesforce-schema.ts`: mapDescribeGlobalToSchema(describeResult) converts jsforce describeGlobal response to ConnectorObject[], mapDescribeToFields(describeResult) converts jsforce describe response to ConnectorField[]. Handle relationship fields (referenceTo, relationshipType).

**Checkpoint**: Schema retrieval maps jsforce responses to ConnectorObject/ConnectorField types.

---

## Phase 4: Records & Stats (US3 — Preview records)

**Goal**: Query records via SOQL and compute field stats.

### Implementation

- [ ] T008 Create records module at `src/lib/connectors/salesforce/salesforce-records.ts`: buildSoqlQuery(objectApiName, fields, page, pageSize) generates SOQL with LIMIT/OFFSET, executeQuery(connection, soql) runs query via jsforce, calculateFieldStats(records, fields) computes null count/distinct count/sample values per field.

**Checkpoint**: Record queries return PaginatedRecords; stats computed from results.

---

## Phase 5: Adapter Integration (US4 — Full adapter)

**Goal**: Wire all modules into a single ConnectorAdapter implementation.

### Implementation

- [ ] T009 Create main adapter at `src/lib/connectors/salesforce/salesforce-adapter.ts`: implements ConnectorAdapter with canRead=true, canWrite=false, canWriteSchema=false. Methods delegate to auth, schema, and records modules. Includes rate limit detection (parse Sforce-Limit-Info header, exponential backoff), token refresh on 401, and audit logging on every operation.
- [ ] T010 Create barrel export at `src/lib/connectors/salesforce/index.ts`: export SalesforceAdapter class and SalesforceConfig type.

**Checkpoint**: SalesforceAdapter is a complete ConnectorAdapter implementation.

---

## Phase 6: Tests

- [ ] T011 [P] Create test fixtures at `tests/fixtures/salesforce/describe-global.json` (~50 objects: standard, custom, system), `describe-contact.json` (Contact with ~30 fields), `records-contact.json` (25 records with nulls/varied values)
- [ ] T012 [P] Create auth unit tests at `tests/unit/connectors/salesforce/auth.test.ts`: test PKCE generation (verifier length, challenge matches), test buildAuthorizationUrl includes all params, test exchangeCodeForTokens sends correct POST body
- [ ] T013 [P] Create schema unit tests at `tests/unit/connectors/salesforce/schema.test.ts`: test system object filtering (verify known patterns filtered), test default selection (custom __c + CRM objects), test field mapping (types, relationships, required/readonly)
- [ ] T014 [P] Create records unit tests at `tests/unit/connectors/salesforce/records.test.ts`: test SOQL generation with pagination, test field stats calculation (null count, distinct count, sample values)
- [ ] T015 Create adapter integration test at `tests/unit/connectors/salesforce/adapter.test.ts`: test full adapter with mocked jsforce (connect -> getSchema -> getFields -> getRecords -> getFieldStats flow), verify audit logging called, verify rate limit handling

**Checkpoint**: All tests pass.

---

## Dependencies & Execution Order

- **T001**: No deps
- **T002**: Depends on T001 (jsforce types); parallel-safe with T001 (just type definitions)
- **T003**: Depends on T002 (types)
- **T004, T005**: Depend on T003 (auth module). Sequential (T004 before T005 since callback references auth initiation state).
- **T006**: No deps on auth. Can run in parallel with Phase 2.
- **T007**: Depends on T006 (constants for system filtering), depends on 000-connector-interface types
- **T008**: Depends on 000-connector-interface types. Can run in parallel with T007.
- **T009**: Depends on T003, T007, T008 (all modules). Central integration point.
- **T010**: Depends on T009
- **T011**: No code deps — can run in parallel with any task
- **T012-T014**: Depend on their respective modules (T003, T007, T008). Parallel-safe with each other.
- **T015**: Depends on T009 (full adapter)
