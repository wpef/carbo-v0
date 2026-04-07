# Tasks: Migration Filters

**Input**: Design documents from `specs/015-migration-filters/`
**Prerequisites**: Feature 011 (Object Mapping) implemented

## Phase 1: Setup

- [ ] T001 [P] Add MigrationFilter model to `prisma/schema.prisma` with fields (id, objectMappingId, sourceFieldName, operator, value, timestamps), index on objectMappingId, relation to ObjectMapping with cascade. Run `npx prisma migrate dev --name add-migration-filter`.
- [ ] T002 [P] Extend mapping types in `src/lib/types/mapping.ts`: MigrationFilterDTO, CreateMigrationFilterInput, FilterOperator enum (EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GREATER_THAN, LESS_THAN, DATE_AFTER, DATE_BEFORE), FilterEstimateResponse.

---

## Phase 2: Foundational (Service Layer)

- [ ] T003 Create MigrationFilterService in `src/lib/services/migration-filter.ts`: list(objectMappingId), create(objectMappingId, input) with field validation against source schema snapshot, delete(filterId). Logs all operations to audit trail.
- [ ] T004 Create FilterEstimationService in `src/lib/services/filter-estimation.ts`: `estimate(objectMappingId)` fetches active filters, converts to connector-compatible format, calls source adapter's getRecordCount. Returns estimated count or null with error message if unavailable. Logs estimation queries.

**Checkpoint**: Service layer complete.

---

## Phase 3: Single User Story - Filter Management (Priority: P1)

**Goal**: Full filter CRUD with estimated record count.

### Implementation

- [ ] T005 Create API route handlers in `src/app/api/plans/[planId]/object-mappings/[mappingId]/filters/route.ts`: GET (list filters), POST (create with field validation).
- [ ] T006 [P] Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/filters/[filterId]/route.ts`: DELETE (remove filter).
- [ ] T007 [P] Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/filters/estimate/route.ts`: GET (estimated record count via FilterEstimationService).
- [ ] T008 Create React hook in `src/hooks/use-migration-filters.ts`: fetches filters for an object mapping, provides create/delete actions, triggers estimation after changes.
- [ ] T009 [P] Create FilterRow component in `src/components/mapping/FilterRow.tsx`: displays field name, operator (human-readable), value, delete button. "AND" label between rows.
- [ ] T010 [P] Create FilterForm component in `src/components/mapping/FilterForm.tsx`: field picker (dropdown of source fields from schema), operator picker (filtered by field type hints), value input (text for most, date picker for DATE_AFTER/DATE_BEFORE). Submit button.
- [ ] T011 Create MigrationFilterPanel component in `src/components/mapping/MigrationFilterPanel.tsx`: renders FilterRows, "AND" separators, FilterForm at bottom, estimated record count display (with loading state and "estimate unavailable" fallback). Integrates with use-migration-filters hook.

**Checkpoint**: Full filter workflow complete. Consultant can add/remove filters and see estimated counts.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): Parallel.
- **Phase 2** (T003-T004): Depends on Phase 1. T003 and T004 are parallel (different files).
- **Phase 3** (T005-T011): Depends on Phase 2. T005 first, T006/T007 parallel, T008 next, T009/T010 parallel, T011 last.

### Parallel Opportunities

```
Phase 1: T001 | T002 (parallel)
Phase 2: T003 | T004 (parallel)
Phase 3: T006 | T007 (parallel), T009 | T010 (parallel)
```
