# Tasks: Salesforce Source Connector

**Input**: Design documents from `specs/001-salesforce-connector/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-routes.md

**Tests**: Constitution Principle IV mandates TDD on critical paths. Test tasks are included for critical
paths (schema retrieval, record reading, diff). Per project convention, tests will be proposed for user
validation before implementation.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize the Next.js project and install all dependencies

- [ ] T001 Initialize Next.js 14+ project with TypeScript and App Router in project root
- [ ] T002 [P] Install and configure Tailwind CSS + shadcn/ui with base theme
- [ ] T003 [P] Install and configure Prisma ORM with SQLite provider in prisma/schema.prisma
- [ ] T004 [P] Install and configure Vitest with TypeScript support in vitest.config.ts
- [ ] T005 [P] Install jsforce v2.0+ and @types if needed in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can begin

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Define Prisma schema with all 5 entities (SalesforceConnection, SourceSchema, SourceObject, SourceField, AuditLog) in prisma/schema.prisma
- [ ] T007 Run initial Prisma migration to create SQLite database in prisma/migrations/
- [ ] T008 [P] Create Prisma client singleton in src/lib/db/client.ts
- [ ] T009 [P] Create shared connector types (interfaces for SourceSchema, SourceObject, SourceField) in src/types/connector.ts
- [ ] T010 [P] Implement audit trail logger service in src/lib/audit/logger.ts (Constitution Principle VI)
- [ ] T011 [P] Create realistic Salesforce test fixtures (describe-global, describe-contact, query-contacts) in tests/fixtures/salesforce/
- [ ] T012 Create base app layout with navigation shell in src/app/layout.tsx
- [ ] T013 Configure environment variables for Salesforce Connected App (client ID, client secret, callback URL) in .env.local

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Connect to Salesforce and Browse Schema (Priority: P1) MVP

**Goal**: A consultant can authenticate with a Salesforce org via OAuth2, browse all objects (standard + custom), and view fields with types, constraints, and FLS indicators.

**Independent Test**: Connect to a Salesforce sandbox, browse objects, select "Contact", and see all fields with their types, constraints, and "no access" markers for restricted fields.

### Implementation for User Story 1

- [ ] T014 [P] [US1] Create Salesforce-specific types (SFObject, SFField, SFDescribeResponse) in src/lib/connectors/salesforce/types.ts
- [ ] T015 [P] [US1] Implement jsforce connection wrapper (connect, getConnection, isConnected) in src/lib/connectors/salesforce/client.ts
- [ ] T016 [US1] Implement OAuth2 flow logic (buildAuthUrl, handleCallback, storeTokens, revokeTokens) in src/lib/connectors/salesforce/auth.ts
- [ ] T017 [US1] Implement schema retrieval and snapshot storage (describeGlobal, describeObject, saveSnapshot) in src/lib/connectors/salesforce/schema.ts
- [ ] T018 [US1] Implement POST /api/connectors/salesforce/connect route in src/app/api/connectors/salesforce/connect/route.ts
- [ ] T019 [US1] Implement GET /api/connectors/salesforce/callback route in src/app/api/connectors/salesforce/callback/route.ts
- [ ] T020 [US1] Implement GET /api/connectors/salesforce/[connectionId]/objects route in src/app/api/connectors/salesforce/[connectionId]/objects/route.ts
- [ ] T021 [US1] Implement GET /api/connectors/salesforce/[connectionId]/objects/[apiName]/fields route in src/app/api/connectors/salesforce/[connectionId]/objects/[apiName]/fields/route.ts
- [ ] T022 [P] [US1] Create connection form component (OAuth2 connect button + status) in src/app/connectors/salesforce/components/connection-form.tsx
- [ ] T023 [US1] Create object list browser component (search/filter, standard/custom indicators) in src/app/connectors/salesforce/components/object-list.tsx
- [ ] T024 [US1] Create field list table component (with FLS "no access" markers) in src/app/connectors/salesforce/components/field-list.tsx
- [ ] T025 [US1] Create main Salesforce connector page assembling all components in src/app/connectors/salesforce/page.tsx
- [ ] T026 [US1] Add console logging for all US1 operations: connect, schema retrieval, errors (Principle VII)

**Checkpoint**: User Story 1 fully functional — consultant can connect and browse the full schema

---

## Phase 4: User Story 2 — Read Records from a Salesforce Object (Priority: P2)

**Goal**: A consultant can preview paginated records from any object and see basic field stats (null count, distinct values, sample values) to assess data quality before mapping.

**Independent Test**: Select "Contact", view paginated records with all field values, see field stats showing null rates and distinct value counts.

### Implementation for User Story 2

- [ ] T027 [US2] Implement record reading with SOQL pagination (query, queryMore, count) in src/lib/connectors/salesforce/records.ts
- [ ] T028 [US2] Implement field stats computation (null count, distinct values, sample values) in src/lib/connectors/salesforce/records.ts
- [ ] T029 [US2] Implement GET /api/connectors/salesforce/[connectionId]/objects/[apiName]/records route in src/app/api/connectors/salesforce/[connectionId]/objects/[apiName]/records/route.ts
- [ ] T030 [P] [US2] Create record preview table component (paginated, relationship resolution) in src/app/connectors/salesforce/components/record-preview.tsx
- [ ] T031 [P] [US2] Create field stats display component (null count, distinct values, samples) in src/app/connectors/salesforce/components/field-stats.tsx
- [ ] T032 [US2] Integrate record preview and field stats into connector page in src/app/connectors/salesforce/page.tsx
- [ ] T033 [US2] Add console logging for all US2 operations: record queries, stats computation, errors (Principle VII)

**Checkpoint**: User Stories 1 AND 2 both work independently — consultant can browse schema and preview data

---

## Phase 5: User Story 3 — Reconnect and Refresh Schema After Changes (Priority: P3)

**Goal**: A consultant can return to a previously connected Salesforce org, re-authenticate transparently, refresh the schema, and see a diff highlighting what changed since the last snapshot.

**Independent Test**: Reconnect to a Salesforce org after session expiry, refresh the schema, and see highlighted changes (added/removed/modified objects and fields).

### Implementation for User Story 3

- [ ] T034 [US3] Implement token refresh logic (detect expiry, use refresh token, handle failure) in src/lib/connectors/salesforce/auth.ts
- [ ] T035 [US3] Implement schema diff computation (compare current vs previous snapshot) in src/lib/connectors/salesforce/diff.ts
- [ ] T036 [US3] Implement POST /api/connectors/salesforce/[connectionId]/schema/refresh route in src/app/api/connectors/salesforce/[connectionId]/schema/refresh/route.ts
- [ ] T037 [US3] Implement POST /api/connectors/salesforce/[connectionId]/disconnect route in src/app/api/connectors/salesforce/[connectionId]/disconnect/route.ts
- [ ] T038 [P] [US3] Create schema diff viewer component (added/removed/modified indicators) in src/app/connectors/salesforce/components/schema-diff.tsx
- [ ] T039 [P] [US3] Create connection status component (connected/expired/error states + reconnect button) in src/app/connectors/salesforce/components/connection-status.tsx
- [ ] T040 [US3] Integrate reconnect and refresh flow into connector page in src/app/connectors/salesforce/page.tsx
- [ ] T041 [US3] Add console logging for all US3 operations: token refresh, schema diff, disconnect (Principle VII)

**Checkpoint**: All user stories independently functional — full connector workflow operational

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T042 [P] Implement Salesforce API rate limit monitoring (Sforce-Limit-Info header parsing) and exponential backoff in src/lib/connectors/salesforce/client.ts
- [ ] T043 [P] Add comprehensive error handling for all edge cases (invalid credentials, network failures, locked accounts, uncommon field types) across all API routes
- [ ] T044 Validate all 3 quickstart.md scenarios end-to-end (first connection, schema refresh, data quality check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 must complete before US2 (US2 uses the connected session and object selection from US1)
  - US1 must complete before US3 (US3 extends auth and schema from US1)
  - US2 and US3 can proceed in parallel after US1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (needs connection + object selection). Can run in parallel with US3.
- **User Story 3 (P3)**: Depends on US1 (extends auth and schema logic). Can run in parallel with US2.

### Within Each User Story

- Types/models before services
- Services before API routes
- API routes before UI components
- Individual components before page assembly
- Logging added as final task per story

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005 can all run in parallel
- **Phase 2**: T008, T009, T010, T011 can all run in parallel (after T006+T007)
- **Phase 3**: T014+T015 in parallel → T016+T017 → T018+T019 sequential → T020+T022+T023 partially parallel
- **Phase 4**: T030+T031 in parallel (different components)
- **Phase 5**: T038+T039 in parallel (different components)
- **After US1**: US2 and US3 can proceed in parallel

---

## Parallel Example: User Story 1

```text
# After foundational phase, launch type definitions in parallel:
T014: Create Salesforce-specific types in src/lib/connectors/salesforce/types.ts
T015: Implement jsforce client wrapper in src/lib/connectors/salesforce/client.ts

# Then services (sequential, depend on types):
T016: OAuth2 flow logic
T017: Schema retrieval and snapshot storage

# Then API routes (partially parallel, different endpoints):
T018 + T019: Connect + callback routes (parallel)
T020: Objects route (depends on T017)
T021: Fields route (depends on T017)

# Then UI components (partially parallel):
T022: Connection form (independent)
T023: Object list (depends on T020)
T024: Field list (depends on T021)

# Then assembly:
T025: Main page
T026: Logging
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Connect to a real Salesforce sandbox and browse schema
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Test independently → **MVP!** (consultant can connect and browse)
3. User Story 2 → Test independently → Add data preview capability
4. User Story 3 → Test independently → Add reconnect/refresh capability
5. Polish → Harden edge cases and validate quickstart scenarios

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests will be proposed for user validation before implementation (per project convention)
- Realistic Salesforce fixtures (T011) are required by Constitution Principle IV
