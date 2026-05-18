# Tasks: Migration Logic

**Input**: `specs/013-migration-logic/`
**Prerequisites**: 012-field-mapping (FieldMapping model, API routes, field mapping view)

---

## Phase 1: Schema & Library

**Purpose**: Database models, type matrix, auto-equivalence, and shared utilities.

- [ ] T001 Add MigrationLogic, ValueEquivalence, ClassificationPrompt models to `prisma/schema.prisma` per data-model.md. Add relation from FieldMapping to MigrationLogic (one-to-one, cascade delete). Add indexes on ValueEquivalence.migrationLogicId. Run `npx prisma migrate dev --name add-migration-logic`.
- [ ] T002 [P] Create type compatibility matrix at `src/features/migration-logic/lib/type-compatibility-matrix.ts`. Export `getSectionType(sourceType: string, destType: string): SectionType`. Implement the 25-entry matrix from the spec. Normalize unknown types to "text". Export `SectionType` union type.
- [ ] T003 [P] Create auto-equivalence utility at `src/features/migration-logic/lib/auto-equivalence.ts`. Export `computeAutoEquivalences(sourceValues: string[], destValues: string[]): ValueEquivalenceItem[]`. Case-insensitive exact match via `value.toLowerCase().trim()`. Each source value maps to at most one destination value (first match wins). Export `ValueEquivalenceItem` type.
- [ ] T004 [P] Create informational message lookup at `src/features/migration-logic/lib/informational-messages.ts`. Export `getInformationalMessage(sourceType: string, destType: string): string | null`. Returns the French message for D4 combinations per the Type Compatibility Matrix (e.g., "La valeur sera copiee" for text-to-text, "Vrai ou Faux" for checkbox-to-text, "Vrai=>1, Faux=>0" for checkbox-to-number). Returns null for non-D4 combinations.
- [ ] T005 [P] Create shared types at `src/features/migration-logic/types.ts`. Export `SectionType`, `LinkStatus`, `MigrationLogicDetail`, `ValueEquivalenceItem`, `SaveMigrationLogicInput`, `ClassifyRequest`, `ClassifyResponse` per contracts/api.md.
- [ ] T006 [P] Create link status computation at `src/features/migration-logic/lib/link-status.ts`. Export `computeLinkStatus(sourceType: string, destType: string, migrationLogic: { status: string } | null): LinkStatus`. Uses `getSectionType()` internally. ERROR -> RED_DASHED, no logic -> RED_SOLID, VALIDATED -> GREEN, DEFINED -> ORANGE.

**Checkpoint**: Prisma migrated, all library functions compile and are independently unit-testable.

---

## Phase 2: Service & API Routes

**Purpose**: Server-side migration logic CRUD and LLM classification endpoint.

- [ ] T007 Create migration logic service at `src/features/migration-logic/services/migration-logic-service.ts`. Implement: `getMigrationLogic(fieldMappingId: string): Promise<MigrationLogicDetail>` (returns logic + field metadata + computed sectionType; returns shell response with field metadata if no record exists), `saveMigrationLogic(fieldMappingId: string, input: SaveMigrationLogicInput): Promise<{ id, status, ... }>` (upsert in transaction: delete old equivalences, create new logic + children, set status based on action), `classifyValues(request: ClassifyRequest): Promise<ClassifyResponse>` (calls Claude API). Each mutation calls `logAudit()`.
- [ ] T008 Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/field-mappings/[fieldMappingId]/migration-logic/route.ts`: GET handler calls `getMigrationLogic()`, returns 200 (or 200 with shell data if no record). PUT handler validates body, calls `saveMigrationLogic()`, returns 200. Returns 409 if sectionType is ERROR.
- [ ] T009 [P] Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/field-mappings/[fieldMappingId]/migration-logic/classify/route.ts`: POST handler validates body (prompt, destinationValues, sampleSourceValues all required and non-empty), calls `classifyValues()`, returns 200. Returns 503 if LLM unavailable.

**Checkpoint**: All API routes respond correctly. Test with curl: get logic for a field mapping (empty and populated), save D1 equivalences, save D2 prompt, validate D4, classify values.

---

## Phase 3: Modal Infrastructure

**Purpose**: The migration logic modal shell (C2) that orchestrates section rendering.

- [ ] T010 Create `use-migration-logic` hook at `src/features/migration-logic/hooks/use-migration-logic.ts`. Fetches logic via GET route on mount. Provides `{ logic, isLoading, error, save, validate }` where `save` and `validate` call PUT with the appropriate action. Accepts `fieldMappingId`, `objectMappingId`, `planId` as params. Calls `mutate` on the parent field mapping list after save/validate to update link colors.
- [ ] T011 Create migration logic modal at `src/features/migration-logic/components/migration-logic-modal.tsx` (C2). Receives `fieldMappingId`, `objectMappingId`, `planId`, `isOpen`, `onClose`. Uses `useMigrationLogic()` to fetch data. Renders: source field header (left), destination field header (right), section component based on `sectionType`, footer with Cancel/Save/Validate buttons. Cancel closes modal. Save calls `save()`, Validate calls `validate()`. Both close modal on success. D3: Save and Validate disabled (only Cancel active). Uses shadcn/ui Dialog component.

**Checkpoint**: Modal opens, displays correct headers, renders placeholder sections, Cancel closes it.

---

## Phase 4: Section Components

**Purpose**: The four section-specific UIs rendered inside the modal.

- [ ] T012 Create value equivalence section at `src/features/migration-logic/components/value-equivalence-section.tsx` (D1). Receives source picklist values, destination picklist values, and existing equivalences. On mount (if no existing equivalences): computes auto-equivalences via `computeAutoEquivalences()` and pre-populates. Renders two columns: source values (left), destination values (right). Each source value has a dropdown to select a destination value (or "unmapped"). Supports drawing visual lines between linked values. Scrollable for 100+ values. Reports current equivalences to parent via `onChange` callback.
- [ ] T013 [P] Create classification prompt section at `src/features/migration-logic/components/classification-prompt-section.tsx` (D2). Receives destination picklist values and existing prompt text. Renders: textarea for prompt (placeholder: "Classifie ce texte dans une des categories suivantes"), example rows below. Uses `useClassificationPreview()` hook to fetch LLM examples. Debounces prompt changes (500ms). Displays fallback message if LLM unavailable. Reports prompt text to parent via `onChange`.
- [ ] T014 [P] Create `use-classification-preview` hook at `src/features/migration-logic/hooks/use-classification-preview.ts`. Accepts `prompt`, `destinationValues`, `planId`, `objectMappingId`, `fieldMappingId`. Fetches sample source values from the source connector (via record preview API from feature 009). Calls POST /classify with debounced prompt. Returns `{ classifications, isLoading, error }`.
- [ ] T015 [P] Create incompatible types section at `src/features/migration-logic/components/incompatible-types-section.tsx` (D3). Renders a red-bordered message with the French error text per FR-010. Static component, no interaction. Signals parent to disable Save/Validate buttons.
- [ ] T016 [P] Create simple copy section at `src/features/migration-logic/components/simple-copy-section.tsx` (D4). Receives the informational message from `getInformationalMessage()`. Renders a grey-bordered message with the type-specific text. Static component, no interaction beyond Validate.

**Checkpoint**: All four sections render correctly inside the modal. D1 auto-equivalence works. D2 calls LLM and shows examples. D3 disables Save/Validate. D4 shows the correct message.

---

## Phase 5: Integration with Field Mapping View

**Purpose**: Wire the modal into the field mapping view and update link colors.

- [ ] T017 Integrate migration logic modal into field mapping view. In the field mapping table (012), clicking a link (C1) or a "Configure" action on a field mapping row opens the `MigrationLogicModal` with the correct `fieldMappingId`. After modal closes with save/validate, the field mapping list re-fetches to reflect updated link status colors.
- [ ] T018 [P] Update link status computation in the field mapping view. Import `computeLinkStatus()` from migration-logic lib. Replace any hardcoded or placeholder link status logic with the computed value based on field types and MigrationLogic status.

**Checkpoint**: Clicking a field link opens the correct modal section. Saving turns the link orange. Validating turns it green. Incompatible types show dashed red.

---

## Phase 6: Tests

**Purpose**: Verify type matrix, auto-equivalence, CRUD, and LLM classification.

- [ ] T019 Create unit test `tests/unit/migration-logic/type-compatibility-matrix.test.ts`. Test all 25 combinations from the spec matrix. Verify unknown types normalize to "text". Verify symmetry where applicable (picklist-to-text is D4, text-to-picklist is D2).
- [ ] T020 [P] Create unit test `tests/unit/migration-logic/auto-equivalence.test.ts`. Test: exact case-insensitive match, no match, partial match, 100+ values performance, trimming whitespace, duplicate source values (first match wins).
- [ ] T021 [P] Create unit test `tests/unit/migration-logic/link-status.test.ts`. Test: ERROR -> RED_DASHED, no logic -> RED_SOLID, VALIDATED -> GREEN, DEFINED -> ORANGE, DRAFT -> RED_SOLID.
- [ ] T022 Create integration test `tests/integration/migration-logic/migration-logic-crud.test.ts`. Test against real Postgres: create D1 logic with equivalences (verify upsert replaces old equivalences), create D2 logic with prompt, validate D4 logic, verify cascade delete from FieldMapping. Verify audit logs.
- [ ] T023 [P] Create integration test `tests/integration/migration-logic/classification-preview.test.ts`. Test classify endpoint with mocked LLM (mock `@anthropic-ai/sdk`). Verify response format. Verify 503 when LLM unavailable.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Schema & Library): No deps beyond 012 existing -- start immediately
- **Phase 2** (Service & API): Depends on Phase 1 (Prisma models + library functions)
- **Phase 3** (Modal): Depends on Phase 2 (API routes for hooks)
- **Phase 4** (Sections): Depends on Phase 3 (modal shell to render inside)
- **Phase 5** (Integration): Depends on Phase 4 (sections functional) + 012 field mapping view
- **Phase 6** (Tests): Unit tests can start after Phase 1; integration tests after Phase 2

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003 | T004 | T005 | T006] parallel
Phase 2: T007 first, then [T008 | T009] parallel
Phase 3: T010 first, then T011
Phase 4: T012 first, then [T013 + T014 | T015 | T016] parallel
Phase 5: [T017 | T018] parallel
Phase 6: [T019 | T020 | T021] parallel (unit), then [T022 | T023] parallel (integration)
```

### FR Coverage

| FR | Task(s) | Phase |
|----|---------|-------|
| FR-001 (Modal opens with correct section) | T002, T010, T011 | 1, 3 |
| FR-002 (Section by type matrix) | T002, T011 | 1, 3 |
| FR-003 (Cancel/Save/Validate buttons, D3 disabled) | T011, T015 | 3, 4 |
| FR-004 (D1 value columns) | T012 | 4 |
| FR-005 (D1 auto-equivalence) | T003, T012 | 1, 4 |
| FR-006 (D1 many-to-one constraint) | T003, T007, T012 | 1, 2, 4 |
| FR-007 (D2 prompt textarea) | T013 | 4 |
| FR-008 (D2 example rows) | T013, T014 | 4 |
| FR-009 (D2 examples refresh on prompt change) | T014 | 4 |
| FR-010 (D3 error message) | T015 | 4 |
| FR-011 (D4 informational message) | T004, T016 | 1, 4 |
| FR-012 (Save persists + orange status) | T007, T008, T010 | 2, 3 |
| FR-013 (Validate persists + green status) | T007, T008, T010 | 2, 3 |
| FR-014 (Audit trail) | T007 | 2 |
