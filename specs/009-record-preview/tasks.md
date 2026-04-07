# Tasks: Record Preview

**Input**: `specs/009-record-preview/`
**Prerequisites**: 005-source-field-retrieval OR 008-destination-field-retrieval (at least one connected system with schema + fields), 000-connector-interface (PaginatedRecords, ConnectorRecord types)

## Phase 1: Setup — Adapter Record Methods

- [ ] T001 [P] Implement Salesforce `getRecords(objectApiName, page, pageSize)` in `src/lib/connectors/adapters/salesforce/index.ts` — SOQL query with LIMIT/OFFSET, resolve relationship fields via Name subquery, return `PaginatedRecords`
- [ ] T002 [P] Implement Salesforce `getRecordCount(objectApiName)` in `src/lib/connectors/adapters/salesforce/index.ts` — `SELECT COUNT() FROM Object`
- [ ] T003 [P] Implement HubSpot `getRecords(objectApiName, page, pageSize)` in `src/lib/connectors/adapters/hubspot/index.ts` — CRM search API with `limit` + `after` cursor, translate page number to cursor position, return `PaginatedRecords`
- [ ] T004 [P] Implement HubSpot `getRecordCount(objectApiName)` in `src/lib/connectors/adapters/hubspot/index.ts` — search with `limit: 0` to get total
- [ ] T005 [P] Implement demo adapter `getRecords()` and `getRecordCount()` for both source and destination demo adapters — return realistic seeded records (varied types, nulls, empty strings, long text, relationship references)

## Phase 2: US1 — Paginated Record Preview (P1)

**Goal**: Consultant sees a paginated table of records for any connected object.

**Independent Test**: GET `/api/plans/:id/records/Contact?role=source&page=1&pageSize=50` returns records with all field values.

- [ ] T006 Create record preview service `src/lib/services/record-preview.service.ts` — `getRecords(planId, objectApiName, role, page, pageSize)`: resolves connection from plan by role, gets adapter instance, calls `getRecords()`, handles binary field detection (replace with placeholder), logs to audit trail
- [ ] T007 Create route handler `src/app/api/plans/[planId]/records/[objectApiName]/route.ts` — GET with query params (role, page, pageSize). Validates params, delegates to service. Error responses per contract
- [ ] T008 Create record table component `src/components/records/record-table.tsx` — renders records as table rows. Null values shown as styled "null" badge. Empty strings as empty cell. Long text truncated at 200 chars with "Show more" toggle. Binary as "[binary data]" placeholder
- [ ] T009 Create pagination controls component `src/components/records/pagination-controls.tsx` — Previous/Next buttons, current page indicator (e.g., "Page 2 of 309"), page size selector dropdown (25, 50, 100), total record count display
- [ ] T010 Create `useRecordPreview` hook `src/hooks/use-record-preview.ts` — manages state: records, totalCount, currentPage, pageSize, loading, error. Fetches from API on page/pageSize change. Caches totalCount after first fetch. Resets to page 1 on pageSize change
- [ ] T011 Create record preview component `src/components/records/record-preview.tsx` — composes record-table + pagination-controls. Uses `useRecordPreview` hook. Shows loading skeleton during fetch, error state with retry button, "No records found" for empty objects

## Phase 3: US2 — Edge Cases & Polish (P2)

**Goal**: Handle zero records, single record, very large objects gracefully.

- [ ] T012 Handle zero-record objects in `src/components/records/record-preview.tsx` — display "No records found" with total count 0, hide pagination controls
- [ ] T013 Handle network errors in `src/hooks/use-record-preview.ts` — on fetch failure, display error message, preserve current page state, show retry button

---

## Dependencies & Execution Order

- **Phase 1** (T001-T005): All parallel. Adapter implementations independent of each other.
- **Phase 2** (T006-T011): T006 first (service). T007 depends on T006. T008-T009 parallel (UI components). T010 depends on T007 (needs API). T011 depends on T008 + T009 + T010.
- **Phase 3** (T012-T013): Depends on T011 (preview component exists).
