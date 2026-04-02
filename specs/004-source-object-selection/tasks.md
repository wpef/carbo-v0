# Tasks: Source Object Selection

**Input**: `specs/004-source-object-selection/`
**Prerequisites**: 003-source-schema-retrieval (SchemaSnapshot + SchemaObject models, retrieval API)

---

## Phase 1: Data Layer

- [ ] T001 [US1] Add `ObjectSelection` model to `prisma/schema.prisma`: id, snapshotId, objectId, objectApiName, isSelected, selectedAt, createdAt, updatedAt. Add @@unique([snapshotId, objectId]), @@index([snapshotId, isSelected]). Add relations to SchemaSnapshot and SchemaObject. Run `prisma migrate dev`.

---

## Phase 2: Service Layer

- [ ] T002 [US1] Create `src/lib/services/object-selection.ts`: implement `initDefaultSelection(snapshotId, adapterType)` -- creates ObjectSelection rows for all objects in snapshot. Sets isSelected=true for isCustom objects and objects in adapter's commonBusinessObjects list. Logs to audit trail.
- [ ] T003 [US1] In same service, implement `getObjectsWithSelection(snapshotId, includeSystem)` -- returns all objects joined with their selection status + summary counts (total, selected, system, custom).
- [ ] T004 [US1] In same service, implement `updateSelection(objectId, isSelected)` and `bulkUpdateSelection(selections[])` -- toggles isSelected, sets selectedAt, logs changes to audit trail.
- [ ] T005 [US1] In same service, implement `migrateSelection(oldSnapshotId, newSnapshotId)` -- copies selection state from old to new snapshot for matching apiNames, applies defaults for new objects, deletes orphaned selections.
- [ ] T006 [US1] In same service, implement `expandObject(connectionId, objectApiName)` -- calls adapter.getRecordCount(), adapter.getFields(), adapter.getRecords() in parallel. Returns combined result with 30s timeout.
- [ ] T007 [US1] Update `src/lib/connectors/registry.ts`: add `commonBusinessObjects` and `systemObjectPrefixes` arrays to adapter metadata for each registered adapter.

---

## Phase 3: API Routes

- [ ] T008 [P] [US1] Create `src/app/api/plans/[planId]/source/objects/route.ts`: implement GET handler -- calls `getObjectsWithSelection`, initializes defaults if no selections exist. Returns objects + summary per contract.
- [ ] T009 [P] [US1] In same route file, implement PUT handler -- validates body, calls `bulkUpdateSelection`, returns updated summary per contract.
- [ ] T010 [US1] Create `src/app/api/plans/[planId]/source/objects/[objectId]/route.ts`: implement PATCH handler -- calls `updateSelection`, returns updated selection per contract.
- [ ] T011 [US1] Create `src/app/api/plans/[planId]/source/objects/[objectId]/expand/route.ts`: implement GET handler -- calls `expandObject`, returns count + fields + records per contract. Handle timeout with 504.

---

## Phase 4: UI Components

- [ ] T012 [P] [US1] Create `src/components/objects/ObjectRow.tsx`: single row with checkbox, label, apiName, isCustom badge, description truncated. Click on row expands. Checkbox toggles selection.
- [ ] T013 [P] [US1] Create `src/components/objects/ObjectExpandPanel.tsx`: expanded view showing record count, field list (as a table: apiName, label, type, constraints), and sample records (as a mini-table). Loading state while fetching.
- [ ] T014 [P] [US1] Create `src/components/objects/SelectionToolbar.tsx`: shows "X / Y objects selected" counter. Buttons: "Select all visible", "Deselect all visible". Operates on filtered list.
- [ ] T015 [P] [US1] Create `src/components/objects/SystemObjectToggle.tsx`: toggle switch "Hide system objects" (default: on). Emits filter change.
- [ ] T016 [US1] Create `src/components/objects/ObjectSelectionList.tsx`: composes ObjectRow, SelectionToolbar, SystemObjectToggle, and a search input. Client-side search by label/apiName. Handles empty state.

---

## Phase 5: Page Integration

- [ ] T017 [US1] Create `src/app/plans/[planId]/source/objects/page.tsx`: object selection step page. Integrates ObjectSelectionList. Shows "Proceed to Field Retrieval" button (disabled if 0 selected). Calls API routes.
- [ ] T018 [US1] Create `src/hooks/use-object-selection.ts`: React hook wrapping object selection API calls with optimistic updates for toggle, loading states, and search filtering.

---

## Phase 6: Cross-feature Integration

- [ ] T019 [US1] Wire `migrateSelection` into schema retrieval flow: update `src/lib/services/schema-retrieval.ts` to call `migrateSelection(oldSnapshotId, newSnapshotId)` after snapshot rotation, so selection survives schema refresh.

---

## Dependencies & Execution Order

- **Phase 1** (T001): Requires 003 SchemaSnapshot + SchemaObject models.
- **Phase 2** (T002-T007): Depends on T001. T007 is [P] with T002-T006 (registry update, independent file).
- **Phase 3** (T008-T011): Depends on Phase 2. T008/T009 are [P] (same file). T010 and T011 are independent routes.
- **Phase 4** (T012-T016): No backend dependency. T012-T015 are [P]. T016 depends on T012-T015.
- **Phase 5** (T017-T018): Depends on Phase 3 and Phase 4.
- **Phase 6** (T019): Depends on T005. Can run anytime after Phase 2.
