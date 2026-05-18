# Tasks: Field Stats

**Input**: `specs/010-field-stats/`
**Prerequisites**: 009 (Record Preview -- records fetched and displayed)

## Phase 1: Computation Logic

- [ ] T001 Create `src/features/010-field-stats/lib/field-stats-types.ts`: export all feature-specific types -- `ComputedFieldStats`, `FieldStatsResult`, `StatsScope`, `StatsDisplayConfig`, `DEFAULT_STATS_CONFIG`. Per data-model.md.
- [ ] T002 Create `src/features/010-field-stats/lib/compute-field-stats.ts`: pure function `computeFieldStats(records: ConnectorRecord[], fieldMetadata: FieldMetadataEntry[], totalCount?: number | null, config?: Partial<StatsDisplayConfig>): FieldStatsResult`. Implementation:
  - For each field in `fieldMetadata`:
    - Count nulls: iterate records, count where `record[fieldApiName]` is `null` or `undefined`
    - Count distinct: collect unique non-null values in a Set
    - Sample values: take first 5 unique values from the Set
    - Detect binary: if all non-null values are `Uint8Array` or field `dataType` matches binary types, set `isComputable=false`
    - Compute `nullPercentage`: `Math.round(nullCount / records.length * 1000) / 10`
    - Stringify and truncate sample values at `config.maxSampleValueLength` (100) with "..." suffix
  - Build `StatsScope`: `analyzedCount = records.length`, `totalCount` from param, `isFullDataset = analyzedCount === totalCount`, `label` formatted string
  - Handle zero records: return empty stats array with `scope.analyzedCount = 0`
  - Add `console.log` on computation: field count, record count, computation duration (Principle VII)

**Checkpoint**: Pure function computes correct stats from mock data. No UI, no hooks yet.

---

## Phase 2: React Hook

- [ ] T003 Create `src/features/010-field-stats/hooks/use-field-stats.ts`: React hook wrapping `computeFieldStats()` with `useMemo`. Inputs: `records: ConnectorRecord[]`, `fieldMetadata: FieldMetadataEntry[]`, `totalCount: number | null`. Returns: `{ stats: ComputedFieldStats[], scope: StatsScope, isComputing: boolean }`. Memoized on `records` reference (recomputes only when records array changes). Sets `isComputing=true` during computation (for potential future async support). Logs computation time to console.

**Checkpoint**: Hook recomputes stats on page change, stable between re-renders.

---

## Phase 3: UI Components

- [ ] T004 Create `src/features/010-field-stats/components/stats-scope-label.tsx`: displays the scope label from `StatsScope`. Renders as a muted text line: "Based on {analyzedCount} records" or "Based on {analyzedCount} of {totalCount} records". When `isFullDataset=true`, appends "(full dataset)". Props: `scope: StatsScope`.
- [ ] T005 [P] Create `src/features/010-field-stats/components/field-stat-column.tsx`: per-field stat card. Displays:
  - Null count as "N nulls (X%)" -- red text if percentage > 50%
  - Distinct count as "N distinct values"
  - Sample values as shadcn/ui Badge chips (up to 5), each truncated at 100 chars
  - If `isComputable=false`: displays "N/A" in muted text
  Props: `stat: ComputedFieldStats`.
- [ ] T006 Create `src/features/010-field-stats/components/field-stats-panel.tsx`: panel container rendering:
  - `StatsScopeLabel` at the top
  - Horizontal scrollable row of `FieldStatColumn` cards, one per field, aligned to the table columns
  - Collapsible with a toggle button (collapsed by default)
  - Zero records: renders "No data to analyze" message
  - Loading state: skeleton placeholders while `isComputing=true`
  Props: `stats: ComputedFieldStats[]`, `scope: StatsScope`, `isComputing: boolean`.

**Checkpoint**: UI components render correctly in isolation with mock stats data.

---

## Phase 4: Integration with 009

- [ ] T007 Update `src/app/plans/[planId]/[side]/preview/[objectApiName]/page.tsx` (from 009, T013): compose `FieldStatsPanel` below the `RecordTable`. Pass records and fieldMetadata from 009's `useRecords` hook into 010's `useFieldStats` hook. Pass `totalCount` from 009's `useRecordCount` hook.

**Checkpoint**: Stats panel visible below record table. Stats update on page navigation. Scope label shows correct counts.

---

## Phase 5: Tests

- [ ] T008 Create `tests/unit/features/010-field-stats/compute-field-stats.test.ts`: unit tests for `computeFieldStats()`. Test cases:
  - Standard case: mixed nulls and values -> correct null count, distinct count, sample values
  - All nulls: nullCount = recordCount, distinctCount = 0, sampleValues = []
  - All same value: distinctCount = 1, sampleValues = [singleValue]
  - High cardinality (all unique): distinctCount = recordCount, sampleValues.length = 5
  - Long sample values (>100 chars): truncated with "..."
  - Binary field: isComputable = false
  - Zero records: empty stats, scope.analyzedCount = 0
  - Null percentage accuracy: verify rounding to 1 decimal
  - Performance: 100 records x 200 fields completes in <1s (SC-001)
- [ ] T009 [P] Create `tests/e2e/features/010-field-stats/field-stats.spec.ts`: Playwright E2E test. Open record preview for a demo object -> expand stats panel -> verify null counts visible per field -> verify scope label shows "Based on 50 records" -> navigate to next page -> verify stats recompute -> verify binary field shows "N/A".

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Computation Logic): No deps within this feature -- start immediately (requires 009 types available)
- **Phase 2** (React Hook): Depends on Phase 1 (pure function exists)
- **Phase 3** (UI Components): Depends on Phase 1 (types exist for props)
- **Phase 4** (Integration): Depends on Phases 2 + 3 (hook + components exist) and 009 T013 (page exists)
- **Phase 5** (Tests): Unit tests (T008) after Phase 1; E2E (T009) after Phase 4

### Parallel Opportunities

```
Phase 1: T001 first, then T002 (uses types from T001)
Phase 2: T003 (after T002)
Phase 3: [T004 | T005] parallel, then T006 (depends on T004 + T005)
          Phase 3 can start in parallel with Phase 2 (components only need types from T001)
Phase 4: T007 (after T003 + T006 + 009-T013)
Phase 5: T008 (after T002), T009 (after T007)
```
