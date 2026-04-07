# Tasks: HubSpot Destination Connector

**Input**: Design documents from `specs/002-hubspot-connector/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-routes.md
**Depends on**: Feature 001 (Salesforce connector) for shared infrastructure (Prisma, audit logger, base layout)

**Organization**: Tasks grouped by user story. Assumes shared infrastructure from 001 already exists.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (HubSpot-specific)

**Purpose**: Install HubSpot dependencies and extend existing infrastructure

- [ ] T001 Install @hubspot/api-client SDK in package.json
- [ ] T002 Extend Prisma schema with HubSpot entities (HubSpotConnection, DestinationSchema, DestinationObject, DestinationProperty) in prisma/schema.prisma
- [ ] T003 Run Prisma migration for HubSpot entities in prisma/migrations/
- [ ] T004 [P] Create HubSpot test fixtures (objects-list, properties-contacts, search-contacts) in tests/fixtures/hubspot/

---

## Phase 2: Foundational (HubSpot Core)

**Purpose**: Core HubSpot infrastructure that MUST be complete before user stories

- [ ] T005 Create HubSpot-specific types (HSObject, HSProperty, HSSearchResponse) in src/lib/connectors/hubspot/types.ts
- [ ] T006 [P] Implement HubSpot client wrapper (@hubspot/api-client initialization, connection management) in src/lib/connectors/hubspot/client.ts
- [ ] T007 [P] Implement HubSpot auth logic (private app token validation, portal info retrieval) in src/lib/connectors/hubspot/auth.ts

**Checkpoint**: HubSpot foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Connect to HubSpot and Browse Schema (Priority: P1) MVP

**Goal**: A consultant can authenticate with a HubSpot portal, browse all objects, and view properties with types, constraints, and group info.

**Independent Test**: Connect to a HubSpot test portal, browse objects, select "Contacts", and see all properties.

### Implementation for User Story 1

- [ ] T008 [US1] Implement schema retrieval and snapshot storage (list objects, get properties, save snapshot) in src/lib/connectors/hubspot/schema.ts
- [ ] T009 [US1] Implement POST /api/connectors/hubspot/connect route in src/app/api/connectors/hubspot/connect/route.ts
- [ ] T010 [US1] Implement GET /api/connectors/hubspot/[connectionId]/objects route in src/app/api/connectors/hubspot/[connectionId]/objects/route.ts
- [ ] T011 [US1] Implement GET /api/connectors/hubspot/[connectionId]/objects/[apiName]/properties route in src/app/api/connectors/hubspot/[connectionId]/objects/[apiName]/properties/route.ts
- [ ] T012 [P] [US1] Create connection form component (token input + validation) in src/app/connectors/hubspot/components/connection-form.tsx
- [ ] T013 [US1] Create object list browser component (search/filter, standard/custom indicators) in src/app/connectors/hubspot/components/object-list.tsx
- [ ] T014 [US1] Create property list table component (with group info) in src/app/connectors/hubspot/components/property-list.tsx
- [ ] T015 [US1] Create main HubSpot connector page assembling all components in src/app/connectors/hubspot/page.tsx
- [ ] T016 [US1] Add console logging for all US1 operations (Principle VII)

**Checkpoint**: Consultant can connect and browse the full HubSpot schema

---

## Phase 4: User Story 2 — Read Records from HubSpot (Priority: P2)

**Goal**: A consultant can preview paginated records from any object and see basic property stats.

**Independent Test**: Select "Contacts", view paginated records, see property stats (null count, distinct values).

### Implementation for User Story 2

- [ ] T017 [US2] Implement record reading with Search API pagination and stats computation in src/lib/connectors/hubspot/records.ts
- [ ] T018 [US2] Implement GET /api/connectors/hubspot/[connectionId]/objects/[apiName]/records route in src/app/api/connectors/hubspot/[connectionId]/objects/[apiName]/records/route.ts
- [ ] T019 [P] [US2] Create record preview table component (paginated) in src/app/connectors/hubspot/components/record-preview.tsx
- [ ] T020 [P] [US2] Create property stats display component in src/app/connectors/hubspot/components/property-stats.tsx
- [ ] T021 [US2] Integrate record preview and stats into connector page in src/app/connectors/hubspot/page.tsx
- [ ] T022 [US2] Add console logging for all US2 operations (Principle VII)

**Checkpoint**: Consultant can browse schema and preview existing HubSpot data

---

## Phase 5: User Story 3 — Create Objects and Properties in HubSpot (Priority: P3)

**Goal**: A consultant can create new custom properties on existing objects and new custom objects directly from Carbo-v0.

**Independent Test**: Create a new property on Contacts, then see it appear in the property list.

### Implementation for User Story 3

- [ ] T023 [US3] Implement schema write logic (create property, create object, validate before write) in src/lib/connectors/hubspot/write.ts
- [ ] T024 [US3] Implement schema diff computation (compare current vs previous snapshot) in src/lib/connectors/hubspot/diff.ts
- [ ] T025 [US3] Implement POST /api/connectors/hubspot/[connectionId]/objects/[apiName]/properties/create route in src/app/api/connectors/hubspot/[connectionId]/objects/[apiName]/properties/create/route.ts
- [ ] T026 [US3] Implement POST /api/connectors/hubspot/[connectionId]/objects/create route in src/app/api/connectors/hubspot/[connectionId]/objects/create/route.ts
- [ ] T027 [US3] Implement POST /api/connectors/hubspot/[connectionId]/schema/refresh route in src/app/api/connectors/hubspot/[connectionId]/schema/refresh/route.ts
- [ ] T028 [US3] Implement POST /api/connectors/hubspot/[connectionId]/disconnect route in src/app/api/connectors/hubspot/[connectionId]/disconnect/route.ts
- [ ] T029 [P] [US3] Create property creation form component (label, name, type, group) in src/app/connectors/hubspot/components/create-property-form.tsx
- [ ] T030 [P] [US3] Create object creation form component (name, labels, primary property) in src/app/connectors/hubspot/components/create-object-form.tsx
- [ ] T031 [P] [US3] Create schema diff viewer component in src/app/connectors/hubspot/components/schema-diff.tsx
- [ ] T032 [US3] Integrate creation forms, refresh, and diff into connector page in src/app/connectors/hubspot/page.tsx
- [ ] T033 [US3] Add console logging for all US3 operations including write audit trail (Principle VII)

**Checkpoint**: Full destination connector operational — read + write schema + preview data

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Implement HubSpot rate limit monitoring and logging in src/lib/connectors/hubspot/client.ts
- [ ] T035 [P] Add error handling for all edge cases (invalid token, tier limitations, name conflicts, network failures) across all API routes
- [ ] T036 Validate all 3 quickstart.md scenarios end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Depends on feature 001 shared infrastructure being in place
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3-5)**: All depend on Foundational
  - US1 must complete before US2 and US3
  - US2 and US3 can proceed in parallel after US1
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Foundational only — no cross-story dependencies
- **US2 (P2)**: Depends on US1 (needs connection + object selection)
- **US3 (P3)**: Depends on US1 (extends schema operations). Can run in parallel with US2.

### Parallel Opportunities

- **Phase 1**: T004 in parallel with T002+T003
- **Phase 2**: T006+T007 in parallel (after T005)
- **Phase 3**: T012 independent of other US1 tasks
- **Phase 4**: T019+T020 in parallel
- **Phase 5**: T029+T030+T031 in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: US1 — Connect and browse
4. **VALIDATE**: Connect to a real HubSpot test portal

### Incremental Delivery

1. US1 → Browse destination schema (MVP)
2. US2 → Preview existing data
3. US3 → Create properties/objects (full destination connector)

---

## Notes

- This feature assumes feature 001 (Salesforce connector) has been implemented — shared infrastructure (Prisma, audit logger, layout) already exists
- Architecture mirrors 001 intentionally for future Connector SDK extraction
- 36 tasks total (lighter than 001 because shared infrastructure already exists)
