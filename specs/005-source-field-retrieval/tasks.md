# Tasks: Source Field Retrieval

**Input**: `specs/005-source-field-retrieval/`
**Prerequisites**: 001 (MigrationPlan), 002 (ConnectorConnection), 003 (SchemaSnapshot/SchemaObject), 004 (object selection)

## Phase 1: Schema Migration

- [ ] T001 Add `ObjectField` model to `prisma/schema.prisma` per data-model.md: all columns (id, objectId, snapshotId, apiName, label, dataType, isRequired, isReadOnly, isUnique, isAccessible, referenceTo, relationshipType, createdAt), relations to SchemaObject and SchemaSnapshot (cascade delete), `@@unique([objectId, apiName])`, indexes on snapshotId and objectId. Add `fields ObjectField[]` relation to existing SchemaObject and SchemaSnapshot models.
- [ ] T002 Run `prisma migrate dev` to generate and apply migration. Verify the migration file is clean.
- [ ] T003 Extend `ConnectorField` in `src/lib/types/connector.ts`: add optional `isAccessible?: boolean` field (backward-compatible, defaults to true when undefined).

**Checkpoint**: `ObjectField` table exists. Prisma client regenerated. `ConnectorField` type updated.

---

## Phase 2: Service Layer (FR-001 through FR-008)

- [ ] T004 Create `src/features/005-source-field-retrieval/services/field-retrieval-service.ts` with function `retrieveFieldsForSelectedObjects(planId: string)`:
  - Resolve source connection for the plan
  - Load selected objects (`isSelected=true`) from CURRENT snapshot
  - Validate at least one selected object exists
  - For each object, call `adapter.getFields(connectionId, objectApiName)` with bounded concurrency (5 parallel, use `Promise.allSettled`)
  - Map `ConnectorField[]` to `ObjectField` create data (use `toObjectFieldData` mapping from data-model.md)
  - Upsert: delete existing fields for the object, then bulk insert new fields (within a transaction per object)
  - Collect results: succeeded objects (with field count), failed objects (with error message)
  - Return summary: `{ totalObjects, succeeded, failed, totalFields, failures }`
- [ ] T005 [P] Add concurrency guard: prevent concurrent field retrieval for the same plan. Use a simple in-memory lock (Map<planId, boolean>) or a DB-based lock (e.g., advisory lock or a `retrievalInProgress` flag on the snapshot). Return 409 if already in progress.
- [ ] T006 [P] Create `src/features/005-source-field-retrieval/lib/field-utils.ts`: helper functions for display logic — `getAccessibilityBadge(field)`, `formatRelationship(field)`, `formatDataType(field)` (flags unknown/system-specific types).

**Checkpoint**: Service retrieves fields from demo adapter, persists them, handles partial failures.

---

## Phase 3: Audit Trail (FR-007)

- [ ] T007 Add audit logging to `field-retrieval-service.ts`: log `FIELD_RETRIEVAL_STARTED` at the beginning (planId, connectionId, objectCount), `FIELD_RETRIEVAL_COMPLETED` at the end (totalFields, succeeded/failed counts, failure details), or `FIELD_RETRIEVAL_FAILED` if the entire batch fails. Use existing `audit.ts` utility.

**Checkpoint**: Audit trail entries visible in DB after retrieval. All events traceable (SC-003).

---

## Phase 4: API Routes

- [ ] T008 Create `src/app/api/plans/[planId]/source/fields/route.ts`:
  - POST: call `retrieveFieldsForSelectedObjects(planId)`, return summary (200) or error (400/404/409)
  - GET: query `ObjectField` for all selected objects in CURRENT snapshot, grouped by object. Return per contracts/api.md.
- [ ] T009 [P] Create `src/app/api/plans/[planId]/source/fields/[objectApiName]/route.ts`:
  - GET: query `ObjectField` for the given object in CURRENT snapshot. Return per contracts/api.md. 404 if object not found or not selected.

**Checkpoint**: API routes functional. POST triggers retrieval; GET returns persisted fields.

---

## Phase 5: UI Components

- [ ] T010 Create `src/features/005-source-field-retrieval/components/field-row.tsx`: renders a single field row with columns — Label, API Name, Type (with special-type indicator for unknown types), Required badge, Read-only badge, Unique badge, Relationship info (target object + type), "No Access" badge if `isAccessible=false` (FR-004). Handle edge case: field with no label uses apiName as display label.
- [ ] T011 Create `src/features/005-source-field-retrieval/components/field-list.tsx`: table component rendering all fields for a single object using `field-row.tsx`. Shows field count in header. Handles zero fields edge case ("No fields found"). No truncation for 100+ fields (acceptance scenario 5).
- [ ] T012 Create `src/features/005-source-field-retrieval/components/object-field-panel.tsx`: expandable panel per object — header shows object label + field count + retrieval status. Expands to show `field-list.tsx`. Multiple panels for multiple objects.
- [ ] T013 [P] Create `src/features/005-source-field-retrieval/components/retrieval-status.tsx`: per-object status indicator — loading spinner during retrieval, green check on success, red error with message on failure (FR-006).
- [ ] T014 Create `src/features/005-source-field-retrieval/components/workflow-nav.tsx`: conditional navigation message per spec §Workflow Navigation — shows appropriate "Next" link based on whether destination is connected or not.
- [ ] T015 Create `src/features/005-source-field-retrieval/hooks/use-field-retrieval.ts`: client hook that triggers POST to retrieve fields, tracks loading state per object, and refetches field data on completion.

**Checkpoint**: Field list displays in UI with all badges. Partial failures shown per-object.

---

## Phase 6: Page Integration

- [ ] T016 Create or update `src/app/plans/[planId]/source/schema/page.tsx`: server component that loads selected objects with their fields, renders `object-field-panel.tsx` for each object, includes `workflow-nav.tsx` at the bottom. Trigger field retrieval on first load if fields are not yet persisted.

**Checkpoint**: Full page functional — consultant sees fields for selected objects with all metadata.

---

## Phase 7: Selection Change Handling (FR-008)

- [ ] T017 Add `updateFieldsOnSelectionChange(planId: string, addedObjects: string[], removedObjects: string[])` to `field-retrieval-service.ts`: delete fields for removed objects (cascade from object deselection), retrieve fields for newly added objects. Called by the object selection service (004) when selection changes.

**Checkpoint**: Changing object selection correctly adds/removes field data (SC-004).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Schema Migration): No deps — start immediately
- **Phase 2** (Service Layer): Depends on Phase 1 (Prisma model + ConnectorField type)
- **Phase 3** (Audit): Depends on Phase 2 (service exists)
- **Phase 4** (API Routes): Depends on Phase 2 (service exists)
- **Phase 5** (UI Components): Depends on Phase 4 (API routes exist) — can start T010/T011/T013 in parallel with Phase 4 using mock data
- **Phase 6** (Page Integration): Depends on Phases 4 + 5
- **Phase 7** (Selection Change): Depends on Phase 2

### Parallel Opportunities

```
Phase 1: T001 → T002 → T003 (sequential, migration depends on model)
Phase 2: T004 first, then [T005 | T006] parallel
Phase 3: T007 (after T004)
Phase 4: [T008 | T009] parallel (after T004)
Phase 5: [T010 | T011 | T013] parallel (UI components), then T012 (depends on T011), T014, T015
Phase 6: T016 (after T008 + T012 + T014 + T015)
Phase 7: T017 (after T004, can run in parallel with Phases 4-6)
```
