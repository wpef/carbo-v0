# Tasks: Field Stats

**Input**: `specs/010-field-stats/`
**Prerequisites**: 009-record-preview (useRecordPreview hook, record-preview component, fetched records in state), 000-connector-interface (FieldStats type)

## Phase 1: US1 — Compute and Display Field Stats (P1)

**Goal**: Per-field stats (null count, distinct count, sample values) computed from fetched records and displayed alongside the record preview.

**Independent Test**: Load record preview, toggle "Show field stats", see accurate stats per field with scope label.

- [ ] T001 Create `computeFieldStats` utility `src/utils/compute-field-stats.ts` — pure function: takes `ConnectorRecord[]`, returns `FieldStats[]`. Single-pass: iterate all records, for each field count nulls, track distinct values (Set, capped at 1000), collect first 5 unique non-null samples. Detect binary placeholders (`"[binary data]"`) and mark as N/A. Handle sparse records (fields present in some records but not others)
- [ ] T002 Create unit tests `tests/unit/utils/compute-field-stats.test.ts` — test cases: normal data, all nulls, all same value, high cardinality, empty records array, sparse records, binary field, mixed types
- [ ] T003 Create field stats row component `src/components/records/field-stats-row.tsx` — renders one row above the record table. Per-column cell showing: null count (with percentage), distinct count, up to 5 sample values as chips/tags. Binary fields show "N/A". Includes scope label: "Based on N records (page M)"
- [ ] T004 Extend `src/hooks/use-record-preview.ts` — after records are fetched, call `computeFieldStats(records)` and expose `fieldStats` in hook return value. Recompute on every page change
- [ ] T005 Extend `src/components/records/record-preview.tsx` — add "Show field stats" toggle button. When toggled on, render `field-stats-row` component above the record table. Display scope label from hook state

## Phase 2: Polish

- [ ] T006 Handle zero-record edge case — when records array is empty, display "No data to analyze" instead of stats row. Disable the toggle
- [ ] T007 Truncate sample values at 100 characters in `src/components/records/field-stats-row.tsx` — long sample values get ellipsis with title attribute showing full value

---

## Dependencies & Execution Order

- **Phase 1**: T001 first (utility function). T002 in parallel with T001 (TDD: write tests, then implement). T003 depends on T001 (needs FieldStats type shape). T004 depends on T001 + 009 hook. T005 depends on T003 + T004.
- **Phase 2** (T006-T007): Depends on T005.
