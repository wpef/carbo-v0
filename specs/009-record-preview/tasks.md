# Tasks: Record Preview

**Input**: `specs/009-record-preview/`
**Prerequisites**: 000 (ConnectorAdapter types), 001 (MigrationPlan), 002/006 (ConnectorConnection), 005/008 (ObjectField persisted)

## Phase 1: Service Layer & Utilities

- [ ] T001 Create `src/features/009-record-preview/lib/cell-formatters.ts`: utility functions for record cell display. `classifyCellValue(value: unknown, fieldMeta: FieldMetadataEntry): CellValue` — classifies raw value into typed CellValue with display string. Handles: null -> `{type:"null", display:"null"}`, empty string -> `{type:"empty", display:"\"\""}`, binary/Uint8Array -> `{type:"binary", display:"[binary data]"}`, string > 200 chars -> truncated with `isTruncated=true` and `fullValue` set, numbers/booleans -> typed with `String()` display, reference fields (when `fieldMeta.referenceTo` is set) -> `{type:"reference"}`. Export `formatRecords(records: ConnectorRecord[], fieldMetadata: FieldMetadataEntry[]): FormattedRecord[]`.
- [ ] T002 Create `src/features/009-record-preview/services/record-preview-service.ts` with two functions:
  - `fetchRecordPage(planId: string, side: 'source'|'destination', objectApiName: string, page: number, pageSize: number): Promise<RecordPreviewResponse>` — resolves connection for plan+side, loads adapter, loads field metadata from ObjectField, calls `adapter.getRecords()`, transforms via `formatRecords()`, logs audit event `RECORD_PREVIEW_VIEWED`, returns response.
  - `fetchRecordCount(planId: string, side: 'source'|'destination', objectApiName: string): Promise<number>` — resolves connection, calls `adapter.getRecordCount()`.
  Include console logging: fetch start (object, page, pageSize), fetch duration, record count, errors.
- [ ] T003 [P] Create `src/features/009-record-preview/lib/record-preview-types.ts`: export all feature-specific types — `RecordPreviewRequest`, `RecordPreviewResponse`, `FormattedRecord`, `CellValue`, `FieldMetadataEntry`, `RecordCountResponse`, `PageSizeOption`, `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`. Per data-model.md.

**Checkpoint**: Service can fetch records from demo adapter, format them, return typed response.

---

## Phase 2: API Routes

- [ ] T004 Create `src/app/api/plans/[planId]/[side]/records/[objectApiName]/route.ts`:
  - GET: validate `side` (source|destination), validate query params `page` (>= 1, default 1) and `pageSize` (25|50|100, default 50). Call `fetchRecordPage()`. Return 200 with `RecordPreviewResponse`. Return 400 for invalid params, 404 for missing plan/connection/object, 502 for connector errors.
- [ ] T005 [P] Create `src/app/api/plans/[planId]/[side]/records/[objectApiName]/count/route.ts`:
  - GET: validate `side`. Call `fetchRecordCount()`. Return 200 with `RecordCountResponse`. Return 404/502 on error.

**Checkpoint**: API routes return paginated records and count. Audit trail entry logged on every record page view.

---

## Phase 3: UI Components

- [ ] T006 Create `src/features/009-record-preview/components/expandable-text.tsx`: renders text truncated at 200 chars with "..." suffix. If truncated, renders a shadcn/ui Popover with the full text on click. If not truncated, renders text directly. Props: `value: string`, `maxLength?: number` (default 200).
- [ ] T007 Create `src/features/009-record-preview/components/record-cell.tsx`: renders a single table cell based on `CellValue`. Styling by type: null -> italic muted `null`, empty -> muted `""`, binary -> muted `[binary data]`, reference -> value with link icon prefix, text with `isTruncated` -> `ExpandableText`, default -> plain text. Props: `value: CellValue`.
- [ ] T008 Create `src/features/009-record-preview/components/record-count-badge.tsx`: displays total record count as a shadcn/ui Badge. Shows skeleton while loading. Props: `count: number | null`, `isLoading: boolean`.
- [ ] T009 Create `src/features/009-record-preview/components/pagination-controls.tsx`: Previous button, Next button, page indicator ("Page X of Y"), page size selector (dropdown: 25/50/100). Previous disabled on page 1; Next disabled when `hasNextPage=false`. Page size change calls `onPageSizeChange` which resets to page 1 (edge case). Props: `page`, `pageSize`, `hasNextPage`, `hasPreviousPage`, `totalCount`, `onNextPage`, `onPreviousPage`, `onPageSizeChange`.
- [ ] T010 Create `src/features/009-record-preview/components/record-table.tsx`: data table using TanStack Table. Dynamic columns generated from `fieldMetadata` (one column per field, header = field label, cell renderer = `RecordCell`). Integrates `PaginationControls` below the table and `RecordCountBadge` above. Handles zero records: "No records found" message. Handles single record: pagination controls hidden. Shows loading skeleton while fetching. Shows error state with retry button.

**Checkpoint**: All UI components render correctly in isolation.

---

## Phase 4: Client Hooks

- [ ] T011 Create `src/features/009-record-preview/hooks/use-records.ts`: client hook managing record page state. Fetches `GET /api/plans/[planId]/[side]/records/[objectApiName]?page=N&pageSize=M`. Exposes: `records`, `fieldMetadata`, `page`, `pageSize`, `hasNextPage`, `hasPreviousPage`, `isLoading`, `error`, `goToNextPage()`, `goToPreviousPage()`, `setPageSize(size)` (resets page to 1), `retry()`. Uses `useEffect` or SWR/React Query for fetching (prefer native fetch + useState for simplicity per Principle II).
- [ ] T012 [P] Create `src/features/009-record-preview/hooks/use-record-count.ts`: client hook fetching `GET /api/plans/[planId]/[side]/records/[objectApiName]/count`. Exposes: `totalCount`, `isLoading`, `error`. Fetches once on mount.

**Checkpoint**: Hooks functional; page navigation triggers re-fetch; page size change resets to page 1.

---

## Phase 5: Page Integration

- [ ] T013 Create `src/app/plans/[planId]/[side]/preview/[objectApiName]/page.tsx`: server component shell that renders the record preview client component. Passes `planId`, `side`, `objectApiName` from route params. The client component uses `useRecords` + `useRecordCount` hooks and renders `RecordTable`.

**Checkpoint**: Full page functional -- consultant can browse paginated records with all display rules applied.

---

## Phase 6: Tests

- [ ] T014 Create `tests/unit/features/009-record-preview/cell-formatters.test.ts`: unit tests for `classifyCellValue` and `formatRecords`. Test cases: null value, empty string, short text, long text (>200 chars, verify truncation), number, boolean, binary (Uint8Array), reference field (with referenceTo set), unknown type. Verify display strings and type classification.
- [ ] T015 [P] Create `tests/integration/features/009-record-preview/record-preview-service.test.ts`: integration tests using demo adapter. Test cases: fetch first page (page=1, pageSize=50) returns correct record count and formatted records; fetch with different page sizes; page beyond last page returns empty records with hasNextPage=false; object with zero records; record count matches adapter; audit trail entry created.
- [ ] T016 [P] Create `tests/e2e/features/009-record-preview/record-preview.spec.ts`: Playwright E2E test. Open record preview for a demo object -> verify table renders with column headers from field metadata -> verify null values display as "null" -> verify pagination controls -> navigate to next page -> verify page indicator updates -> change page size -> verify reset to page 1.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Service + Utilities): No deps within this feature -- start immediately
- **Phase 2** (API Routes): Depends on Phase 1 (service exists)
- **Phase 3** (UI Components): No deps on Phases 1-2 (components are presentational, use props)
- **Phase 4** (Client Hooks): Depends on Phase 2 (API routes exist to call)
- **Phase 5** (Page Integration): Depends on Phases 3 + 4 (components + hooks)
- **Phase 6** (Tests): Unit tests (T014) can start after Phase 1; integration (T015) after Phase 2; E2E (T016) after Phase 5

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003] parallel (T002 uses T001's formatters + T003's types)
          Note: T001 and T003 can also run in parallel; T002 depends on both
Phase 2: [T004 | T005] parallel (after T002)
Phase 3: [T006 | T007 | T008 | T009] parallel, then T010 (depends on T007 + T008 + T009)
          Phase 3 can start in parallel with Phase 2
Phase 4: [T011 | T012] parallel (after Phase 2)
Phase 5: T013 (after T010 + T011 + T012)
Phase 6: T014 (after T001), [T015 | T016] (after T013)
```
