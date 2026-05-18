# Tasks: Source Field Retrieval

**Input**: `specs/005-source-field-retrieval/`
**Prerequisites**: 004-source-object-selection (ObjectSelection model, selection API with at least one selected object)

---

## Phase 1: Data Layer

- [ ] T001 [US1] Add `ObjectField` model to `prisma/schema.prisma`: id, objectId, snapshotId, apiName, label, dataType, isRequired, isReadOnly, isUnique, isAccessible, referenceTo (optional), relationshipType (optional), createdAt. Add @@unique([objectId, apiName]), @@index([objectId]), @@index([snapshotId]). Add relation to SchemaObject. Run `prisma migrate dev`.
- [ ] T002 [P] [US1] Create `src/lib/types/field.ts`: export TypeScript types for ObjectFieldResult and FieldRetrievalResult (succeeded, failed, totalFields, duration).

---

## Phase 2: Service Layer

- [ ] T003 [US1] Create `src/lib/services/field-retrieval.ts`: implement `retrieveFields(connectionId, snapshotId)` -- gets all selected objects, iterates sequentially calling adapter.getFields(apiName) for each. Persists ObjectField rows (upsert by objectId+apiName). Handles per-object errors without aborting the batch. Returns FieldRetrievalResult. Logs to audit trail.
- [ ] T004 [US1] In same service, implement `getFieldsByObject(snapshotId)` -- returns fields grouped by object for all selected objects. Includes summary (objectCount, totalFields, inaccessibleFields).
- [ ] T005 [US1] In same service, implement `getFieldsForObject(objectId)` -- returns all fields for a single object.
- [ ] T006 [US1] In same service, implement `cleanupFieldsForDeselected(snapshotId)` -- deletes ObjectField rows for objects that are no longer selected. Called when selection changes.

---

## Phase 3: API Routes

- [ ] T007 [P] [US1] Create `src/app/api/plans/[planId]/source/fields/route.ts`: implement POST handler -- validates connection + schema + selections exist, calls `retrieveFields`, returns 201 with result per contract. Prevent concurrent retrieval (409).
- [ ] T008 [P] [US1] In same route file, implement GET handler -- calls `getFieldsByObject`, returns fields grouped by object + summary per contract.
- [ ] T009 [US1] Create `src/app/api/plans/[planId]/source/fields/[objectId]/route.ts`: implement GET handler -- calls `getFieldsForObject`, returns fields per contract.

---

## Phase 4: UI Components

- [ ] T010 [P] [US1] Create `src/components/fields/FieldRow.tsx`: single field row displaying apiName, label, dataType (with icon), required badge, read-only badge, unique badge, "No Access" badge (if !isAccessible), relationship info (referenceTo + type).
- [ ] T011 [P] [US1] Create `src/components/fields/FieldTable.tsx`: table of FieldRow components for one object. Column headers: Field, Type, Constraints, Relationship. Handles zero fields ("No fields found").
- [ ] T012 [P] [US1] Create `src/components/fields/FieldRetrievalProgress.tsx`: progress bar showing "Retrieving fields: X / Y objects completed". Shows per-object status (success checkmark, error icon). Appears during POST and hides after completion.
- [ ] T013 [US1] Create `src/components/fields/ObjectFieldAccordion.tsx`: accordion list of selected objects, each expandable to show its FieldTable. Shows object label, apiName, field count badge. Failed objects show error message with "Retry" button.

---

## Phase 5: Page Integration

- [ ] T014 [US1] Create `src/app/plans/[planId]/source/fields/page.tsx`: field retrieval step page. Shows "Retrieve Fields" button (triggers POST). After retrieval, shows ObjectFieldAccordion. Shows workflow navigation: "Source schema ready. Next: Connect Destination / Create Migration Plan" based on destination status.
- [ ] T015 [US1] Create `src/hooks/use-fields.ts`: React hook wrapping field retrieval API calls (trigger retrieval, get fields, get fields for object) with loading/error/progress states.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): T001 requires 004 SchemaObject model. T002 is [P] (types file, independent).
- **Phase 2** (T003-T006): Depends on T001.
- **Phase 3** (T007-T009): Depends on Phase 2. T007/T008 are [P] (same file, independent handlers).
- **Phase 4** (T010-T013): No backend dependency. T010-T012 are [P]. T013 depends on T010+T011.
- **Phase 5** (T014-T015): Depends on Phase 3 and Phase 4.
