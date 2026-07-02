# Tasks: Destination Field Retrieval

**Input**: `specs/008-destination-field-retrieval/`
**Prerequisites**: 000 (connector types), 005 (ObjectField model + shared field service), 006 (destination connection), 007 (destination schema snapshot)

## Phase 1: Shared Infrastructure Extraction

**Purpose**: Extract reusable field retrieval logic from 005 so both source and destination can use it.

- [ ] T001 Extract shared `retrieveAndPersistFieldsForObject()` into `src/features/shared/services/field-service.ts`. This function takes `connectionId`, `snapshotId`, `objectId`, `objectApiName`, `adapterType` and returns `{ fieldCount, status, error? }`. It calls `adapter.getFields()`, maps `ConnectorField[]` to `ObjectField` Prisma creates, and handles per-object errors. Refactor 005's source field service to delegate to this shared function.

**Checkpoint**: Source field retrieval still works identically after extraction. Shared function is importable.

---

## Phase 2: Destination Field Service (FR-001, FR-002, FR-003)

**Purpose**: Server-side service that retrieves and persists fields for all destination objects.

- [ ] T002 Create `src/features/destination/services/destination-field-service.ts` with three functions:
  - `retrieveDestinationFields({ connectionId, snapshotId, planId })`: iterates all `SchemaObject` rows for the given snapshot, calls `retrieveAndPersistFieldsForObject()` for each with concurrency limit (5), collects results, logs to audit trail (`DESTINATION_FIELDS_RETRIEVED`), returns `RetrieveFieldsResult`.
  - `getDestinationFieldsByObject({ snapshotId, objectId })`: queries `ObjectField` by objectId.
  - `getAllDestinationFields({ snapshotId })`: queries all `ObjectField` rows for the snapshot.
  Console log: retrieval start, per-object progress (every 10 objects), completion summary with timing.

- [ ] T003 [P] Create TypeScript types for the service in `src/features/destination/types.ts`: `RetrieveFieldsParams`, `RetrieveFieldsResult`, `ObjectRetrievalStatus`.

**Checkpoint**: `retrieveDestinationFields()` can be called with a valid snapshot and returns field counts. Audit log entry created.

---

## Phase 3: API Routes

**Purpose**: HTTP endpoints for triggering retrieval and reading persisted fields.

- [ ] T004 Create `src/app/api/plans/[planId]/destination/fields/route.ts`:
  - `POST`: Resolve destination connection + CURRENT snapshot from plan. Call `retrieveDestinationFields()`. Return `RetrieveFieldsResult` as JSON. Handle 404 (no plan/connection/snapshot) and 409 (already in progress).
  - `GET`: Read persisted fields from DB. Accept optional `objectId` or `objectApiName` query param for filtering. Return `{ fields, totalCount }`.

- [ ] T005 [P] Create `src/app/api/plans/[planId]/destination/objects/[objectId]/fields/route.ts`:
  - `GET`: Return fields for a single destination object. Include object metadata in response. Handle 404.

**Checkpoint**: API routes return correct data. POST triggers retrieval and GET reads persisted results.

---

## Phase 4: Full Chain Integration (007 FR-004)

**Purpose**: Wire destination field retrieval into the full chain so schema -> fields always executes together.

- [ ] T006 Update the destination schema retrieval service (007) to call `retrieveDestinationFields()` after successfully persisting objects. Ensure the chain is atomic: if field retrieval fails entirely, the schema snapshot is still persisted (partial success per 005 FR-006 pattern). Add console logging for chain progress: "Schema retrieved, starting field retrieval..." -> "Field retrieval complete."

**Checkpoint**: Post-OAuth auto-trigger and manual refresh both execute schema -> fields as a single chain. The destination schema page never shows objects without fields.

---

## Phase 5: UI Components

**Purpose**: Display destination fields with appropriate badges.

- [ ] T007 Create `src/features/destination/components/destination-field-list.tsx`: Table component displaying fields for a destination object. Columns: Label, API Name, Type, Badges. Badge rendering: red "Requis" for isRequired, grey "Lecture seule" for isReadOnly, blue "Unique" for isUnique, orange "Pas d'acces" for !isAccessible. If referenceTo is set, display relationship info (target object + type) in the Type column.

- [ ] T008 [P] Create `src/features/destination/components/destination-object-fields.tsx`: Expandable panel for an object in the destination schema list. On expand, fetches fields via `GET /api/plans/[planId]/destination/objects/[objectId]/fields` and renders `DestinationFieldList`. Shows field count badge on the collapsed row.

- [ ] T009 Create `src/features/destination/hooks/use-destination-fields.ts`: Client-side hook for fetching destination fields. Wraps the GET API call with loading/error state. Accepts `objectId` as parameter.

**Checkpoint**: Destination schema page shows objects with expandable field lists. Badges render correctly for required, read-only, unique, and inaccessible fields.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (T001): Depends on 005 being implemented. Refactors existing code.
- **Phase 2** (T002-T003): Depends on Phase 1 (shared service). T003 is parallel with T002.
- **Phase 3** (T004-T005): Depends on Phase 2 (service functions). T004 and T005 are parallel.
- **Phase 4** (T006): Depends on Phase 2 (destination field service) + 007 (schema service exists).
- **Phase 5** (T007-T009): Depends on Phase 3 (API routes). T007 and T008 are parallel. T009 is parallel with T007/T008.

### Parallel Opportunities

```
Phase 1: T001 (sequential -- refactors existing code)
Phase 2: T002 first, [T003] parallel
Phase 3: [T004 | T005] parallel
Phase 4: T006 (sequential -- integrates with 007)
Phase 5: [T007 | T008 | T009] parallel
```

### Execution Graph

```
T001 -> T002 -> T004 -> T006
         |        |
        T003    T005 -> T007
                         |
                        T008 -> (integration with 007 schema page)
                         |
                        T009
```
