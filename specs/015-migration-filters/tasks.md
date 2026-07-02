# Tasks: Migration Filters

**Input**: `specs/015-migration-filters/`
**Prerequisites**: 011-object-mapping (ObjectMapping model, API routes), 000-connector-interface (ConnectorAdapter)

---

## Phase 1: Schema & Library

**Purpose**: Database model, operator definitions, and validation utilities.

- [ ] T001 Add MigrationFilter model to `prisma/schema.prisma` per data-model.md. Add FilterOperator enum. Add relation from ObjectMapping to MigrationFilter (one-to-many, cascade delete). Add index on MigrationFilter.objectMappingId. Run `npx prisma migrate dev --name add-migration-filters`.
- [ ] T002 [P] Add FilterCondition type and optional `getFilteredRecordCount` method to `src/lib/types/connector.ts` per data-model.md. The method is optional (gated by implementation, not capabilities).
- [ ] T003 [P] Create operator definitions at `src/features/migration-filters/lib/filter-operators.ts`. Export `FILTER_OPERATORS` array with metadata for each operator: value (enum string), label (French: "Est egal a", "N'est pas egal a", "Contient", "Commence par", "Se termine par", "Superieur a", "Inferieur a", "Apres le", "Avant le"), applicableTypes (string[] of recommended field types). Export `isValidOperator(op: string): boolean`.
- [ ] T004 [P] Create filter validation at `src/features/migration-filters/lib/filter-validation.ts`. Export `validateFilter(input: CreateFilterInput, sourceFields: ConnectorField[]): { valid: boolean, error?: string, warning?: string }`. Checks: field exists in source schema (hard error if not), operator is valid (hard error), type-operator compatibility (soft warning). Date value format check for DATE_AFTER/DATE_BEFORE (soft warning if not ISO 8601).
- [ ] T005 [P] Create shared types at `src/features/migration-filters/types.ts`. Export `FilterOperator`, `FilterItem`, `CreateFilterInput`, `FilterListResponse`, `FilterEstimate` per contracts/api.md.

**Checkpoint**: Prisma migrated, operator definitions compile, validation function is unit-testable.

---

## Phase 2: Service & API Routes

**Purpose**: Server-side filter CRUD and record count estimation.

- [ ] T006 Create filter service at `src/features/migration-filters/services/filter-service.ts`. Implement: `listFilters(objectMappingId: string): Promise<FilterListResponse>` (returns filters + count), `createFilter(objectMappingId: string, input: CreateFilterInput): Promise<FilterItem & { warning?: string }>` (validates via validateFilter, creates in DB, logs audit), `deleteFilter(filterId: string): Promise<void>` (deletes, logs audit), `estimateCount(objectMappingId: string): Promise<FilterEstimate>` (fetches filters, calls connector's getFilteredRecordCount if available, falls back to getRecordCount for total, handles unreachable source gracefully).
- [ ] T007 Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/filters/route.ts`: GET handler calls `listFilters()`, returns 200. POST handler validates body, calls `createFilter()`, returns 201 (with warning if applicable). Returns 422 if field does not exist.
- [ ] T008 [P] Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/filters/[filterId]/route.ts`: DELETE handler calls `deleteFilter()`, returns 204. Returns 404 if filter not found.
- [ ] T009 [P] Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/filters/estimate/route.ts`: GET handler calls `estimateCount()`, returns 200 (always, even when estimate is unavailable -- the response body indicates availability).

**Checkpoint**: All API routes respond correctly. Test with curl: list (empty), create filter, list (1 filter), estimate count, delete filter, estimate (no filters = total count).

---

## Phase 3: UI Components

**Purpose**: Filter panel with builder form, filter rows, and estimated count display.

- [ ] T010 Create `use-filters` hook at `src/features/migration-filters/hooks/use-filters.ts`. Fetches filters via GET route. Provides `{ filters, count, isLoading, error, addFilter, removeFilter }`. `addFilter` calls POST and mutates the list. `removeFilter` calls DELETE and mutates. Accepts `objectMappingId` and `planId`.
- [ ] T011 [P] Create `use-filter-estimate` hook at `src/features/migration-filters/hooks/use-filter-estimate.ts`. Fetches estimate via GET route. Provides `{ estimate, isLoading, error, refresh }`. Auto-refreshes when a `version` counter (incremented by useFilters after add/remove) changes. Debounces requests by 1s.
- [ ] T012 Create filter row component at `src/features/migration-filters/components/filter-row.tsx`. Displays a single filter: source field name (bold), operator (French label from filter-operators), value (quoted), and a delete icon button. Calls `removeFilter` on delete. Shows warning badge if the filter has a `warning` field.
- [ ] T013 Create filter form component at `src/features/migration-filters/components/filter-form.tsx`. Inline form with: source field dropdown (populated from source object schema), operator dropdown (from FILTER_OPERATORS), value text input. For DATE_AFTER/DATE_BEFORE operators, the value input switches to a date picker (shadcn/ui DatePicker or simple input[type=date]). Add button calls `addFilter`. Resets form on success.
- [ ] T014 Create filter panel component at `src/features/migration-filters/components/filter-panel.tsx`. Renders: heading "Filtres de migration", list of FilterRow components (or "Aucun filtre defini" if empty), FilterForm at the bottom, estimated record count display ("~4 200 sur 12 500 enregistrements" or "Estimation indisponible"). Collapsible section using shadcn/ui Collapsible. Shows "AND" connector between filter rows. Uses `useFilters()` and `useFilterEstimate()`.

**Checkpoint**: Filter panel renders correctly, filters can be added/removed, estimated count updates after changes.

---

## Phase 4: Integration

**Purpose**: Wire the filter panel into the field mapping page and the filter count into the object detail modal.

- [ ] T015 Integrate filter panel into field mapping page. In the field mapping page (012), render `<FilterPanel>` above the field mapping table for the current object mapping. Pass the `objectMappingId` and `planId`. The panel is rendered for each object pair tab.
- [ ] T016 [P] Expose filter count for 011 object detail modal. Ensure the `GET /filters` endpoint's `count` field is available to the object detail modal (A3). The modal can either call the filters API directly or receive the count as a prop from the field mapping page. Verify the "N migration filters" section in A3 displays the correct count.

**Checkpoint**: Filter panel appears above the field mapping table. Adding/removing filters updates the estimated count. Object detail modal shows the correct filter count.

---

## Phase 5: Tests

**Purpose**: Verify filter operators, validation, CRUD, and estimation.

- [ ] T017 Create unit test `tests/unit/migration-filters/filter-operators.test.ts`. Test: all 9 operators have valid metadata, `isValidOperator` returns true for valid and false for invalid.
- [ ] T018 [P] Create unit test `tests/unit/migration-filters/filter-validation.test.ts`. Test: valid filter passes, non-existent field fails with error, invalid operator fails, date operator on text field produces warning (not error), valid date format accepted, invalid date format produces warning.
- [ ] T019 Create integration test `tests/integration/migration-filters/filter-crud.test.ts`. Test against real Postgres: create filter (verify persistence), list filters (verify ordering), delete filter (verify removal), cascade delete when object mapping is deleted. Verify audit logs for create and delete. Test estimate endpoint with mock connector (verify count is returned). Test estimate when source is unreachable (verify graceful fallback).

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Schema & Library): No deps beyond 011 existing -- start immediately
- **Phase 2** (Service & API): Depends on Phase 1 (Prisma model + validation)
- **Phase 3** (UI): Depends on Phase 2 (API routes for hooks)
- **Phase 4** (Integration): Depends on Phase 3 (filter panel functional) + 012 field mapping page
- **Phase 5** (Tests): Unit tests can start after Phase 1; integration tests after Phase 2

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003 | T004 | T005] parallel
Phase 2: T006 first, then [T007 | T008 | T009] parallel
Phase 3: [T010 | T011] parallel, then T012, then T013, then T014
Phase 4: [T015 | T016] parallel
Phase 5: [T017 | T018] parallel (unit), then T019 (integration)
```

### FR Coverage

| FR | Task(s) | Phase |
|----|---------|-------|
| FR-001 (Create filters with field+operator+value) | T001, T005, T006, T007, T013 | 1, 2, 3 |
| FR-002 (9 supported operators) | T003, T005, T013 | 1, 3 |
| FR-003 (AND logic combination) | T006, T009, T014 | 2, 3 |
| FR-004 (Estimated record count) | T002, T006, T009, T011, T014 | 1, 2, 3 |
| FR-005 (Validate source field exists) | T004, T006, T007 | 1, 2 |
| FR-006 (Remove individual filters + recount) | T006, T008, T010, T012 | 2, 3 |
| FR-007 (Audit trail) | T006 | 2 |
