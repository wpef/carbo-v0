# Tasks: Mapping Plan

**Input**: Design documents from `specs/003-mapping-plan/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-routes.md
**Depends on**: Features 001 + 002 (connectors) for schema data and shared infrastructure

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Mapping Infrastructure)

**Purpose**: Extend existing project with mapping-specific schema and dependencies

- [ ] T001 Install acorn (JS parser) for syntax validation in package.json
- [ ] T002 Extend Prisma schema with mapping entities (MappingPlan, ObjectMapping, FieldMapping, TransformationRule, ValidationRule, MigrationFilter) in prisma/schema.prisma
- [ ] T003 Run Prisma migration for mapping entities in prisma/migrations/
- [ ] T004 [P] Create mapping test fixtures (salesforce-to-hubspot-contacts, multi-object-plan) in tests/fixtures/mapping/

---

## Phase 2: Foundational (Mapping Core)

**Purpose**: Core mapping types and services that all user stories depend on

- [ ] T005 Create mapping-specific types (MappingPlan, ObjectMapping, FieldMapping, Rule types, Filter types) in src/lib/mapping/types.ts
- [ ] T006 Implement plan CRUD service (create, get, list, update status, delete) in src/lib/mapping/plan-service.ts
- [ ] T007 Implement type compatibility matrix (Salesforce types ↔ HubSpot types) in src/lib/mapping/validation.ts

**Checkpoint**: Mapping foundation ready

---

## Phase 3: User Story 1 — Create Object and Field Mappings (Priority: P1) MVP

**Goal**: A consultant can create a mapping plan, add object mappings, and map fields between source and destination — with explicit warnings for unmapped fields.

**Independent Test**: Create a mapping from SF Contact to HS Contacts, map 10+ fields, see unmapped fields listed.

### Implementation for User Story 1

- [ ] T008 [US1] Implement object mapping CRUD service in src/lib/mapping/object-mapping-service.ts
- [ ] T009 [US1] Implement field mapping CRUD service in src/lib/mapping/field-mapping-service.ts
- [ ] T010 [US1] Implement POST /api/mapping/plans route in src/app/api/mapping/plans/route.ts
- [ ] T011 [US1] Implement GET /api/mapping/plans route (list) in src/app/api/mapping/plans/route.ts
- [ ] T012 [US1] Implement GET /api/mapping/plans/[planId] route in src/app/api/mapping/plans/[planId]/route.ts
- [ ] T013 [US1] Implement CRUD routes for object mappings in src/app/api/mapping/plans/[planId]/objects/route.ts
- [ ] T014 [US1] Implement CRUD routes for field mappings in src/app/api/mapping/plans/[planId]/objects/[objectMappingId]/fields/route.ts
- [ ] T015 [P] [US1] Create plan list page in src/app/mapping/page.tsx
- [ ] T016 [US1] Create plan header component (name, source/dest info, status) in src/app/mapping/[planId]/components/plan-header.tsx
- [ ] T017 [US1] Create object mapping list component in src/app/mapping/[planId]/components/object-mapping-list.tsx
- [ ] T018 [US1] Create field mapping table component (side-by-side, type indicators) in src/app/mapping/[planId]/components/field-mapping-table.tsx
- [ ] T019 [US1] Create unmapped fields warning component in src/app/mapping/[planId]/components/unmapped-fields-warning.tsx
- [ ] T020 [US1] Create mapping summary component (completion stats) in src/app/mapping/[planId]/components/mapping-summary.tsx
- [ ] T021 [US1] Create plan detail page assembling all components in src/app/mapping/[planId]/page.tsx
- [ ] T022 [US1] Add console logging for all US1 operations (Principle VII)

**Checkpoint**: Consultant can create plans, map objects and fields, see unmapped warnings

---

## Phase 4: User Story 2 — Transformation and Validation Rules (Priority: P2)

**Goal**: A consultant can add transformation rules (fixed value, field reference, JS function) and validation rules (type check, regex) to any field mapping.

**Independent Test**: Add a JS transformation and a regex validation to a field mapping, see syntax validation and rule display.

### Implementation for User Story 2

- [ ] T023 [US2] Implement rule CRUD logic in src/lib/mapping/field-mapping-service.ts (extend existing service)
- [ ] T024 [US2] Implement JS syntax validation using acorn in src/lib/mapping/validation.ts (extend existing)
- [ ] T025 [US2] Implement rule CRUD routes in src/app/api/mapping/plans/[planId]/objects/[objectMappingId]/fields/[fieldMappingId]/rules/route.ts
- [ ] T026 [P] [US2] Create transformation rule editor component (fixed value, field ref, JS) in src/app/mapping/[planId]/components/transformation-rule-editor.tsx
- [ ] T027 [P] [US2] Create validation rule editor component (type check, regex) in src/app/mapping/[planId]/components/validation-rule-editor.tsx
- [ ] T028 [P] [US2] Create JS syntax validator component (inline error display) in src/app/mapping/[planId]/components/js-syntax-validator.tsx
- [ ] T029 [US2] Integrate rule editors into field mapping table in src/app/mapping/[planId]/components/field-mapping-table.tsx
- [ ] T030 [US2] Add console logging for all US2 operations (Principle VII)

**Checkpoint**: Consultant can define transformation and validation rules on any mapping

---

## Phase 5: User Story 3 — Migration Filters (Priority: P3)

**Goal**: A consultant can define filters on source records to control migration scope, with estimated record counts.

**Independent Test**: Add a date filter and an email filter, see estimated count update.

### Implementation for User Story 3

- [ ] T031 [US3] Implement filter CRUD and estimation service in src/lib/mapping/filter-service.ts
- [ ] T032 [US3] Implement filter routes in src/app/api/mapping/plans/[planId]/objects/[objectMappingId]/filters/route.ts
- [ ] T033 [US3] Create migration filter editor component (operator selector, value input) in src/app/mapping/[planId]/components/migration-filter-editor.tsx
- [ ] T034 [US3] Integrate filter editor and estimated count into object mapping view
- [ ] T035 [US3] Add console logging for all US3 operations (Principle VII)

**Checkpoint**: Consultant can define migration scope with filters and see impact estimates

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T036 [P] Implement mapping integrity checker (detect broken mappings after schema changes) in src/lib/mapping/integrity-checker.ts
- [ ] T037 [P] Add comprehensive error handling across all mapping API routes
- [ ] T038 Validate all 3 quickstart.md scenarios end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Depends on features 001 + 002 shared infrastructure
- **Foundational (Phase 2)**: Depends on Setup
- **US1 (Phase 3)**: Depends on Foundational — **MVP**
- **US2 (Phase 4)**: Depends on US1 (extends field mapping with rules)
- **US3 (Phase 5)**: Depends on US1 (adds filters to object mappings). Can run in parallel with US2.
- **Polish (Phase 6)**: Depends on all user stories

### Parallel Opportunities

- **Phase 1**: T004 in parallel with T002+T003
- **Phase 3**: T015 independent; T016-T020 partially parallel (different components)
- **Phase 4**: T026+T027+T028 in parallel (different components)
- **After US1**: US2 and US3 can proceed in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1+2: Setup + Foundational
2. Phase 3: US1 — Create mappings with unmapped field warnings
3. **VALIDATE**: Create a real SF→HS mapping plan

### Incremental Delivery

1. US1 → Field mappings with type indicators (MVP)
2. US2 → Add transformation/validation rules
3. US3 → Add migration filters
4. Polish → Integrity checker, error handling

---

## Notes

- 38 tasks total
- This feature consumes connector schemas but does NOT execute migrations
- The data model is the richest of all features — 6 new entities
- JS functions are syntax-checked only at definition time; execution is feature 006
