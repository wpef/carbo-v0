# Tasks: Schema Write

**Input**: Design documents from `specs/022-schema-write/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Phase 1: Setup

- [ ] T001 [US1] Add `SchemaWriteOperation` model to `prisma/schema.prisma` per data-model.md. Run `npx prisma db push`.
- [ ] T002 [P] [US1] Create types in `src/lib/services/schema-write/types.ts`: `CreateFieldInput`, `ModifyFieldInput`, `CreateObjectInput`, `SchemaWriteResult`, `FieldDescriptionResult`.
- [ ] T003 [P] [US1] Create barrel export `src/lib/services/schema-write/index.ts`.

---

## Phase 2: Validation + Service Core (US1 -- Add field)

**Goal**: Create a new field in the destination system with pre-validation, audit logging, and schema refresh.

**Independent Test**: Submit a field creation request for a valid field. Verify the adapter's `createField()` is called, a `SchemaWriteOperation` is logged, and the schema snapshot is refreshed.

- [ ] T004 [US1] Implement validation in `src/lib/services/schema-write/validation.ts`: `validateFieldCreation(input, existingFields)` checks name uniqueness and type compatibility against adapter's supported types. `validateFieldModification(input, existingField)` checks type change rules. Returns `{ valid: boolean, error?: string }`.
- [ ] T005 [US1] Implement core service in `src/lib/services/schema-write/schema-write.service.ts`: `createField(connectionId, input: CreateFieldInput)` -- validate, call adapter `createField()`, log `SchemaWriteOperation` to DB (success or failure), refresh schema snapshot for affected object. Return `SchemaWriteResult`.
- [ ] T006 [US1] Write unit tests in `tests/unit/services/schema-write/validation.test.ts`: name conflict detection, type compatibility, empty name, invalid type.
- [ ] T007 [US1] Write unit tests in `tests/unit/services/schema-write/service.test.ts` (createField path): mock adapter + Prisma, verify adapter called with correct args, audit logged, schema refreshed, error handled.

**Checkpoint**: Field creation works end-to-end with mocked adapter.

---

## Phase 3: Field Modification (US2)

**Goal**: Modify existing destination field properties.

**Independent Test**: Modify a field's description and picklist values. Verify adapter `modifyField()` called, audit logged, snapshot updated.

- [ ] T008 [US2] Add `modifyField(connectionId, fieldApiName, input: ModifyFieldInput)` to `src/lib/services/schema-write/schema-write.service.ts`: validate, call adapter `modifyField()`, log `SchemaWriteOperation`, refresh snapshot. Handle rejected modifications (e.g., type change not allowed).
- [ ] T009 [US2] Add modifyField tests to `tests/unit/services/schema-write/service.test.ts`: modification success, type change rejection, API error handling, audit logging.

**Checkpoint**: Field modification works with mocked adapter.

---

## Phase 4: LLM Field Descriptions (US3)

**Goal**: Generate field descriptions using Claude API.

**Independent Test**: Call `generateFieldDescription()` with field context, get a useful description. Call without API key, get "unavailable" response.

- [ ] T010 [US3] Implement LLM field description in `src/lib/services/schema-write/field-description.ts`: `generateFieldDescription(objectApiName, fieldName, fieldType, sampleValues?, companyContext?)`. Call Claude API with structured prompt. Timeout 10s. Fallback if no API key or error. Return `FieldDescriptionResult`.
- [ ] T011 [US3] Write unit tests in `tests/unit/services/schema-write/field-description.test.ts`: successful generation (mocked), no API key, timeout, empty field name, GDPR-filtered sample values.

**Checkpoint**: LLM description generation works with fallback.

---

## Phase 5: Object Creation (US4)

**Goal**: Create custom objects in the destination system.

- [ ] T012 [US4] Add `createObject(connectionId, input: CreateObjectInput)` to `src/lib/services/schema-write/schema-write.service.ts`: validate, call adapter `createObject()`, log audit, refresh full schema. Return result.
- [ ] T013 [US4] Add createObject tests to `tests/unit/services/schema-write/service.test.ts`: success, name conflict, adapter not supporting object creation.

**Checkpoint**: Object creation works with mocked adapter.

---

## Phase 6: API Routes

**Goal**: Expose all schema write operations via REST API.

- [ ] T014 [P] [US1] Implement POST field creation route `src/app/api/plans/[planId]/connections/[connectionId]/schema-write/fields/route.ts`: validate canWriteSchema, call service, return 201/400/403/500.
- [ ] T015 [P] [US2] Implement PATCH field modification route `src/app/api/plans/[planId]/connections/[connectionId]/schema-write/fields/[fieldApiName]/route.ts`: validate canWriteSchema, call service, return 200/400/403.
- [ ] T016 [P] [US4] Implement POST object creation route `src/app/api/plans/[planId]/connections/[connectionId]/schema-write/objects/route.ts`: validate canWriteSchema, call service, return 201/400/403.
- [ ] T017 [P] [US3] Implement POST describe-field route `src/app/api/plans/[planId]/connections/[connectionId]/schema-write/describe-field/route.ts`: call `generateFieldDescription()`, return 200/500.

**Checkpoint**: All API routes functional.

---

## Phase 7: UI Components

**Goal**: Build the UI for field creation, modification, and object creation in the mapping view.

- [ ] T018 [US1] Create field creation form `src/components/schema-write/create-field-form.tsx`: two-tab form (New field / Copy from source). Fields: name (required), type (dropdown from adapter types, required), picklist values (if type=picklist), description (optional), group (optional). "Generate description" button (calls describe-field API). Submit calls field creation API.
- [ ] T019 [US2] Create field modification modal `src/components/schema-write/modify-field-modal.tsx`: opens from destination field card click. Shows editable: name, type, picklist values, description, group. "Generate description" button. Save calls modification API. Display errors clearly.
- [ ] T020 [US3] Create description generation button `src/components/schema-write/generate-description-button.tsx`: reusable button that triggers LLM description, shows loading, fills description field. Hidden/disabled when no API key.
- [ ] T021 [US4] Create object creation form `src/components/schema-write/create-object-form.tsx`: fields for object name and primary property (name + type). Submit calls object creation API.
- [ ] T022 [US1] Create React hook `src/hooks/use-schema-write.ts`: encapsulates API calls for create field, modify field, create object, generate description. Handles loading state, error state, and triggers schema refresh in UI after success.

**Checkpoint**: All UI components functional.

---

## Phase 8: Integration Test

- [ ] T023 [US1] Write integration test in `tests/integration/schema-write.test.ts`: seed a plan with destination connection (canWriteSchema=true), create a field via API, verify SchemaWriteOperation logged, verify field appears in refreshed schema. Test canWriteSchema=false returns 403.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T003): No dependencies, start immediately
- **Phase 2** (T004-T007): Depends on T001 (Prisma), T002 (types); requires adapter interface from 000
- **Phase 3** (T008-T009): Depends on T005 (service core)
- **Phase 4** (T010-T011): Depends on T002 (types); parallel with Phases 2-3
- **Phase 5** (T012-T013): Depends on T005 (service core)
- **Phase 6** (T014-T017): Depends on T005, T008, T010, T012 (all service methods)
- **Phase 7** (T018-T022): Depends on T014-T017 (API routes)
- **Phase 8** (T023): Depends on all previous phases

### Parallel Opportunities

- T002 and T003 can run in parallel
- Phase 4 (T010-T011) can run in parallel with Phases 2-3
- T014, T015, T016, T017 can all run in parallel (different route files)
- T018, T019, T020, T021 can run in parallel (different component files)
