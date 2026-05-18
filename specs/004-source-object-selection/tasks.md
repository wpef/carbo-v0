# Tasks: Source Object Selection

**Input**: `specs/004-source-object-selection/`
**Prerequisites**: 000-connector-interface (types), 003-source-schema-retrieval (SchemaSnapshot, SchemaObject models), 002-source-connection (ConnectorConnection model, adapter registry)

## Phase 1: Data Model + Service Layer

- [ ] T001 Add `ObjectSelection` model to `prisma/schema.prisma` per data-model.md. Add relation fields on `ConnectorConnection` and `SchemaSnapshot` models. Run `npx prisma generate` (no migration yet -- Neon branch handles schema).
- [ ] T002 Create `src/features/004-source-object-selection/lib/common-business-objects.ts`: export `CommonBusinessObjectsConfig` with per-connector-type lists (salesforce, hubspot, demo). Per research Decision 2.
- [ ] T003 Create `src/features/004-source-object-selection/lib/default-selection.ts`: export `computeDefaultSelections(objects: SchemaObject[], adapterType: string): Array<{ objectApiName: string; isSelected: boolean }>`. Selects `isCustom=true` + objects in common business objects list. Per FR-002.
- [ ] T004 Create `src/features/004-source-object-selection/services/object-selection-service.ts` with:
  - `getObjectsWithSelection(planId): Promise<{ objects: ObjectSelectionRow[]; summary: SelectionSummary; snapshotId; connectionId }>` -- joins SchemaObject + ObjectSelection, computes category, initializes defaults on first load (FR-001, FR-007, FR-009).
  - `saveSelections(planId, selections: SaveSelectionPayload): Promise<{ updated: number; summary: SelectionSummary }>` -- upsert in transaction, set selectedAt, log to audit trail (FR-006, FR-007, FR-010).
  - `migrateSelections(connectionId, oldSnapshotId, newSnapshotId, newObjects: SchemaObject[]): Promise<void>` -- copy selections for surviving objects, apply defaults for new objects, flag orphaned (spec assumption on snapshot migration).
- [ ] T005 Create `src/features/004-source-object-selection/services/object-expand-service.ts`: export `expandObject(connectionId, objectApiName): Promise<ObjectExpandResult>`. Calls adapter `getRecordCount`, `getFields`, `getRecords(_, _, 1, 5)` in parallel with 30s timeout. Per FR-005. Console log start/end with timing (Principle VII).

**Checkpoint**: Service layer complete. All business logic testable without UI.

---

## Phase 2: API Routes

- [ ] T006 Create `src/app/api/plans/[planId]/source/objects/route.ts`:
  - `GET`: calls `getObjectsWithSelection(planId)`, returns JSON per contracts/api.md.
  - `PUT`: validates body, calls `saveSelections(planId, payload)`, returns updated summary.
  - Both: resolve planId -> connectionId -> CURRENT snapshotId; return 404 for missing connection/snapshot.
- [ ] T007 Create `src/app/api/plans/[planId]/source/objects/[objectApiName]/expand/route.ts`:
  - `GET`: validates objectApiName exists in CURRENT snapshot, calls `expandObject`, returns JSON.
  - 404 if object not found, 504 if timeout.

**Checkpoint**: API routes functional. Can test with curl/Postman against demo adapter.

---

## Phase 3: UI Components

- [ ] T008 Create `src/features/004-source-object-selection/hooks/use-object-selection.ts`: SWR/fetch hook for GET + mutation for PUT. Optimistic update on toggle. Revalidate on PUT success.
- [ ] T009 Create `src/features/004-source-object-selection/hooks/use-object-expand.ts`: Lazy fetch hook (only triggers on expand click). Loading + error + timeout states.
- [ ] T010 [P] Create `src/features/004-source-object-selection/components/object-search.tsx`: controlled input, debounced 100ms, emits filter string. Per FR-004 + SC-002.
- [ ] T011 [P] Create `src/features/004-source-object-selection/components/system-objects-toggle.tsx`: toggle switch (shadcn/ui Switch), default on (hide system). Emits boolean filter. Per FR-003.
- [ ] T012 Create `src/features/004-source-object-selection/components/object-row.tsx`: checkbox + label + apiName + custom/business/system badge + truncated description. Expand chevron triggers `use-object-expand`. Per FR-001.
- [ ] T013 Create `src/features/004-source-object-selection/components/object-expand-panel.tsx`: collapsible panel below object-row. Shows record count, field table (apiName, label, dataType, isRequired, isReadOnly), sample records table. Loading skeleton on fetch. Timeout/error message. Per FR-005.
- [ ] T014 Create `src/features/004-source-object-selection/components/object-list.tsx`: renders filtered/sorted `ObjectSelectionRow[]` using `object-row.tsx`. Applies search filter (FR-004), system toggle filter (FR-003). Empty state "No objects match your search" (spec edge case). Per FR-001.
- [ ] T015 [P] Create `src/features/004-source-object-selection/components/bulk-actions-bar.tsx`: "Select all visible" / "Deselect all visible" buttons. Calls PUT with all currently visible objects. Displays "X / Y objects selected" count. Per FR-006, FR-009.
- [ ] T016 [P] Create `src/features/004-source-object-selection/components/proceed-bar.tsx`: bottom sticky bar with selected count + "Retrieve Fields" button. Button disabled + validation message when selectedCount === 0. Per FR-008.
- [ ] T017 Create `src/features/004-source-object-selection/components/object-selection-page.tsx`: client orchestrator composing all components. Manages search state, system toggle state, selection state. Wires hooks to components.
- [ ] T018 Create `src/app/plans/[planId]/source/objects/page.tsx`: server component shell. Renders `<ObjectSelectionPage planId={params.planId} />`.

**Checkpoint**: Full UI functional. Consultant can view, search, filter, expand, select/deselect objects, and proceed.

---

## Phase 4: Integration + Audit

- [ ] T019 Wire selection migration into schema refresh chain: in the schema refresh flow (003), after creating a new snapshot, call `migrateSelections(connectionId, oldSnapshotId, newSnapshotId, newObjects)`. Ensure orphaned selections are flagged with warning (spec edge case).
- [ ] T020 Verify audit trail logging: confirm `OBJECT_SELECTION_INITIALIZED` fires on first load and `OBJECT_SELECTION_CHANGED` fires on every toggle/bulk action. Verify logged data matches contracts/api.md audit table.

**Checkpoint**: Feature complete including cross-feature integration.

---

## Dependencies & Execution Order

- **T001**: No deps within this feature (depends on 003 Prisma models being present).
- **T002, T003**: Depend on T001 (types). Parallel-safe with each other.
- **T004**: Depends on T001, T002, T003.
- **T005**: Depends on T001. Parallel-safe with T002, T003, T004.
- **T006**: Depends on T004.
- **T007**: Depends on T005.
- **T008**: Depends on T006.
- **T009**: Depends on T007.
- **T010, T011**: No service deps. Parallel-safe. Can start with Phase 3.
- **T012**: Depends on T008, T009.
- **T013**: Depends on T009.
- **T014**: Depends on T012.
- **T015, T016**: Depend on T008. Parallel-safe with each other.
- **T017**: Depends on T014, T015, T016, T010, T011.
- **T018**: Depends on T017.
- **T019**: Depends on T004 (migrateSelections function).
- **T020**: Depends on T006 (API routes must be functional).

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003 | T005] parallel, then T004
Phase 2: [T006 | T007] parallel (different routes)
Phase 3: [T008 | T009] parallel, [T010 | T011] parallel,
         then T012 + T013, then T014 + [T015 | T016],
         then T017, then T018
Phase 4: [T019 | T020] parallel
```
