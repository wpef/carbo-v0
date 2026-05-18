# Tasks: Schema Write

**Input**: `specs/022-schema-write/`
**Prerequisites**: 000 (ConnectorAdapter), 003/007 (schema snapshot refresh), 008 (destination field retrieval), 012 (field mapping view)

## Phase 1: Types & Data Model

- [ ] T001 Create `src/lib/types/schema-write.ts`: define TypeScript types for CreateFieldRequest, ModifyFieldRequest, CreateObjectRequest, GenerateDescriptionRequest, GenerateDescriptionResponse, SchemaWriteOperationDTO, ValidationResult. All per data-model.md DTOs. Include JSDoc on each type with FR reference.

- [ ] T002 Extend `src/lib/types/connector.ts`: add optional `modifyField?` method to `ConnectorAdapter` interface. Add `supportedFieldTypes?: string[]` to `ConnectorCapabilities`. The `modifyField` signature: `(connectionId: string, objectApiName: string, fieldApiName: string, updates: Partial<Omit<ConnectorField, 'apiName' | 'isReadOnly' | 'isUnique'>>) => Promise<ConnectorField>`. Add JSDoc.

- [ ] T003 Add `SchemaWriteOperation` model to Prisma schema: `SchemaWriteOperationType` enum, `SchemaWriteResult` enum, `SchemaWriteOperation` model with all fields per data-model.md. Run `prisma generate`.

- [ ] T004 [P] Create Prisma migration for the SchemaWriteOperation table. Run `prisma migrate dev --name add-schema-write-operations`. Verify the migration applies cleanly.

**Checkpoint**: Types compile, Prisma schema valid, migration applied. `npx prisma studio` shows the `schema_write_operations` table.

---

## Phase 2: Service Layer

- [ ] T005 Create `src/lib/services/schema-write/field-validator.ts`: implement `validateCreateField(connectionId, objectApiName, fieldData)` and `validateModifyField(connectionId, objectApiName, fieldApiName, updates)`. Validation rules:
  - `validateCreateField`: name non-empty, type in adapter's `supportedFieldTypes`, name not already in current snapshot for that object, if type is picklist/enumeration then `picklistValues` must be non-empty array.
  - `validateModifyField`: field exists in current snapshot, if renaming then new name not in snapshot, if changing type then new type in `supportedFieldTypes`.
  Return `{ valid: true }` or `{ valid: false, errors: string[] }`.
  Console-log validation steps (Principle VII).

- [ ] T006 Create `src/lib/services/schema-write/write-service.ts`: implement `createField`, `modifyField`, `createObject`. Each function MUST:
  1. Validate inputs using fieldValidator (for fields) or inline validation (for objects).
  2. Get the adapter from the registry and verify `canWriteSchema === true`.
  3. Call the adapter method (`adapter.createField`, `adapter.modifyField`, or `adapter.createObject`).
  4. Log to `SchemaWriteOperation` (result: SUCCESS or ERROR, with error message if failed).
  5. Log to `AuditLog` (action: `SCHEMA_WRITE_CREATE_FIELD` / `SCHEMA_WRITE_MODIFY_FIELD` / `SCHEMA_WRITE_CREATE_OBJECT`).
  6. On success, trigger snapshot refresh for the connection (call existing refresh service from 003/007).
  7. Return `{ field/object, operation }` on success; throw with structured error on failure.
  Console-log at each step: "Validating field creation for [name] on [object]", "Calling adapter.createField", "Field created successfully, refreshing snapshot", "Logged to audit trail".

- [ ] T007 Create `src/lib/services/schema-write/description-generator.ts`: implement `generateDescription(context)`. MUST:
  1. Check that `ANTHROPIC_API_KEY` env var is set. Throw `LLM_UNAVAILABLE` if not.
  2. Assemble the prompt: system message (CRM data migration expert), user message with objectLabel, fieldName, fieldType, companyContext, sampleValues.
  3. Call Claude API via `@anthropic-ai/sdk` (model: `claude-sonnet-4-20250514`, max_tokens: 200).
  4. Return `{ description, model, tokensUsed }`.
  5. Handle errors: timeout, API error -> throw with `LLM_UNAVAILABLE` code.
  Console-log: "Generating description for [fieldName] on [objectLabel]", "LLM response received ([tokensUsed] tokens)".

- [ ] T008 [P] Create `src/lib/services/schema-write/index.ts`: barrel export for `createField`, `modifyField`, `createObject`, `generateDescription`, `validateCreateField`, `validateModifyField`.

**Checkpoint**: Service functions can be called from a test script. DemoAdapter (with canWriteSchema=true) accepts create/modify calls.

---

## Phase 3: DemoAdapter Extension

- [ ] T009 Extend `src/lib/adapters/demo/demo-adapter.ts`: set `capabilities.canWriteSchema = true` and `capabilities.supportedFieldTypes = ['string', 'number', 'date', 'datetime', 'enumeration', 'bool']`. Implement `createObject` (add to in-memory objects array, return ConnectorObject), `createField` (add to in-memory fields for the specified object, return ConnectorField), `modifyField` (update the field in-memory, return updated ConnectorField). Validate name uniqueness in-memory. Return errors for: name conflict, unsupported type, field not found (for modify).

**Checkpoint**: DemoAdapter supports all three write operations. Contract tests (000 T004) still pass. New write tests pass.

---

## Phase 4: API Routes

- [ ] T010 Create `src/app/api/connections/[connectionId]/schema/fields/route.ts`: POST handler for field creation. MUST:
  1. Parse and validate request body (CreateFieldRequest shape).
  2. Load connection and verify it is a destination with `canWriteSchema`.
  3. Call `writeService.createField(connectionId, objectApiName, fieldData)`.
  4. Return 201 with `{ field, operation }` on success.
  5. Return 400 for validation errors, 403 for non-writable connections, 422 for remote API errors, 500 for internal errors.

- [ ] T011 Create `src/app/api/connections/[connectionId]/schema/fields/[fieldApiName]/route.ts`: PATCH handler for field modification. MUST:
  1. Parse `objectApiName` from query params.
  2. Parse updates from request body.
  3. Load connection and verify canWriteSchema.
  4. Call `writeService.modifyField(connectionId, objectApiName, fieldApiName, updates)`.
  5. Return 200 on success, appropriate error codes on failure.

- [ ] T012 [P] Create `src/app/api/connections/[connectionId]/schema/objects/route.ts`: POST handler for object creation. Same pattern as T010 but for objects.

- [ ] T013 [P] Create `src/app/api/connections/[connectionId]/schema/describe/route.ts`: POST handler for LLM description generation. MUST:
  1. Parse GenerateDescriptionRequest from body.
  2. Call `descriptionGenerator.generateDescription(context)`.
  3. Return 200 with `{ description, model, tokensUsed }`.
  4. Return 503 if LLM is unavailable.

**Checkpoint**: All four routes respond correctly via manual HTTP calls. Create a field, modify it, create an object, generate a description.

---

## Phase 5: UI Components

- [ ] T014 Create `src/components/schema-write/CreateFieldForm.tsx`: React component for field creation. MUST:
  1. Render a form with: mode toggle ("New field" / "Copy from source field"), name input, label input, type dropdown (populated from `supportedFieldTypes`), description textarea, picklistValues input (visible when type is picklist/enumeration), group input (optional).
  2. In "Copy from source" mode: render a source field selector dropdown. On selection, pre-fill name, label, type (mapped via normalization), description, picklistValues.
  3. "Generate description" button next to description field (hidden if LLM unavailable -- check via a capability endpoint or config flag).
  4. On submit: POST to `/api/connections/[connectionId]/schema/fields`. Show loading state. Show success toast + close form. Show error toast on failure.
  5. On success: trigger destination field list refresh (invalidate the field list query/state).

- [ ] T015 Create `src/components/schema-write/ModifyFieldModal.tsx`: React component for field modification. MUST:
  1. Open when the consultant clicks a destination field card in the field mapping view.
  2. Pre-populate all editable fields from the current field data: name, label, type, description, picklistValues (if picklist), group.
  3. "Generate description" button (same as T014).
  4. Save button: PATCH to `/api/connections/[connectionId]/schema/fields/[fieldApiName]`. Show loading. Show success/error toasts.
  5. On success: trigger snapshot refresh in UI.

- [ ] T016 [P] Create `src/components/schema-write/CreateObjectForm.tsx`: React component for object creation. MUST:
  1. Render a form with: object name, label, description (optional), primary property section (name, label, type).
  2. On submit: POST to `/api/connections/[connectionId]/schema/objects`.
  3. On success: trigger object list refresh.

- [ ] T017 [P] Create `src/components/schema-write/DescriptionGenerator.tsx`: Reusable component for the "Generate description" button. MUST:
  1. Accept props: objectApiName, objectLabel, fieldName, fieldType, connectionId, onGenerated(description).
  2. On click: POST to `/api/connections/[connectionId]/schema/describe`.
  3. Show loading spinner. On success, call onGenerated with the description.
  4. On error: show error message inline.
  5. Hidden if LLM is not configured (check via `NEXT_PUBLIC_LLM_ENABLED` env var or similar).

- [ ] T018 Integrate schema write components into the field mapping view (012):
  1. Add "Add field" button to the destination column header in the field mapping table. On click, open `CreateFieldForm` in a dialog/sheet.
  2. When the consultant clicks a destination field card, open `ModifyFieldModal` instead of (or in addition to) the existing detail modal.
  3. Gate visibility: only show "Add field" and modify capability when `canWriteSchema === true` for the destination connection.

**Checkpoint**: Full UI flow works: add a field (new or copy-from-source), modify a field, generate a description, create an object. All operations reflect in the field/object lists immediately.

---

## Phase 6: Tests

- [ ] T019 Create `tests/unit/services/schema-write/field-validator.test.ts`: unit tests for field validation. Test cases:
  1. Valid field creation -> { valid: true }.
  2. Empty name -> { valid: false, errors: ["name is required"] }.
  3. Unsupported type -> { valid: false, errors: ["type 'blob' is not supported"] }.
  4. Name already exists in snapshot -> { valid: false, errors: ["field 'email' already exists"] }.
  5. Picklist type without values -> { valid: false, errors: ["picklistValues required for enumeration type"] }.
  6. Valid modification -> { valid: true }.
  7. Field not found for modification -> { valid: false }.
  8. Rename conflict -> { valid: false }.

- [ ] T020 [P] Create `tests/unit/services/schema-write/write-service.test.ts`: unit tests for write service. Test cases:
  1. Successful field creation -> returns field + operation with result=SUCCESS.
  2. Validation failure -> throws with validation errors, no adapter call made.
  3. Adapter error (tier limit) -> operation logged with result=ERROR, error re-thrown.
  4. Snapshot refresh triggered after success.
  5. Successful object creation.
  6. Successful field modification.
  Use DemoAdapter (canWriteSchema=true) or mock adapter.

- [ ] T021 [P] Create `tests/unit/services/schema-write/description-generator.test.ts`: unit tests for LLM description generation. Test cases:
  1. API key configured, successful generation -> returns description.
  2. API key not configured -> throws LLM_UNAVAILABLE.
  3. API call fails (timeout) -> throws LLM_UNAVAILABLE.
  Mock the Anthropic SDK client.

- [ ] T022 Create `tests/integration/schema-write/api-routes.test.ts`: integration tests against real Postgres. Test:
  1. POST create field -> 201, field in snapshot after refresh.
  2. POST create field with duplicate name -> 400.
  3. PATCH modify field -> 200, field updated.
  4. POST create object -> 201, object in snapshot.
  5. POST describe -> 200 (mock LLM) or 503 (no key).
  6. POST on source connection -> 403.
  7. POST on connection with canWriteSchema=false -> 403.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately.
- **T002**: No deps -- parallel with T001.
- **T003**: Depends on T001 (types referenced in schema).
- **T004**: Depends on T003 (migration after schema valid).
- **T005**: Depends on T001, T004 (needs types + DB).
- **T006**: Depends on T001, T002, T004, T005 (needs types, adapter interface, DB, validator).
- **T007**: Depends on T001 (needs types). Parallel with T005, T006.
- **T008**: Depends on T006, T007 (barrel exports).
- **T009**: Depends on T002 (needs modifyField in interface). Parallel with T005-T008.
- **T010**: Depends on T006, T008 (route calls service).
- **T011**: Depends on T006, T008.
- **T012**: Depends on T006, T008. Parallel with T010, T011.
- **T013**: Depends on T007, T008. Parallel with T010-T012.
- **T014**: Depends on T010, T013 (needs API endpoints).
- **T015**: Depends on T011, T013.
- **T016**: Depends on T012. Parallel with T014, T015.
- **T017**: Depends on T013. Parallel with T014-T016.
- **T018**: Depends on T014, T015, T016, T017 (integrates all components).
- **T019**: Depends on T005 (tests the validator).
- **T020**: Depends on T006 (tests the write service). Parallel with T019.
- **T021**: Depends on T007 (tests the generator). Parallel with T019, T020.
- **T022**: Depends on T010, T011, T012, T013 (tests the routes).

### Parallel Opportunities

```
Phase 1: [T001 | T002] -> T003 -> T004
Phase 2: [T005 | T007] -> T006 -> T008
Phase 3: T009 (parallel with Phase 2)
Phase 4: [T010 | T011 | T012 | T013]
Phase 5: [T014 | T015 | T016 | T017] -> T018
Phase 6: [T019 | T020 | T021] -> T022
```
