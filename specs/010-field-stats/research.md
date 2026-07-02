# Research: Field Stats

## Decision 1: Computation Location — Client-Side vs Server-Side

**Decision**: Client-side only. Stats are computed in the browser from records already fetched by 009.

**Rationale**: FR-002 explicitly requires "computed client-side from records already fetched for the record preview. No additional API call is required." The fetched records are already in memory (009's hook state). Computing stats client-side avoids a round-trip, keeps the feature self-contained, and aligns with the spec's assumption that stats represent a sample (the currently fetched page or accumulated pages), not the full dataset.

**Alternatives**: Server-side computation via a dedicated API route (violates FR-002), connector-level `getFieldStats()` call (exists on ConnectorAdapter but is meant for future full-dataset stats, out of scope per spec assumption).

## Decision 2: Scope of Computation — Current Page vs Accumulated Pages

**Decision**: Current page only (the records currently visible in the preview).

**Rationale**: The spec states "computed from the fetched records (the current page or accumulated pages)" and the simplest correct implementation computes stats from whatever records are in the current page. Accumulating across pages would require maintaining a growing record buffer across navigations, increasing memory usage and adding complexity. The scope label (FR-003) makes the sample size explicit -- the consultant always knows what the stats represent.

**Future**: If accumulated-page stats are desired, the hook can be extended with an optional `accumulatedRecords` buffer. This is explicitly out of scope per spec assumption ("Future enhancements may add full-dataset stats").

**Alternatives**: Accumulate records across pages (memory growth, complexity for unclear benefit), use `ConnectorAdapter.getFieldStats()` for full-dataset stats (out of scope).

## Decision 3: Display Format — Inline vs Panel vs Tooltip

**Decision**: Panel below the record table, with per-column stat cards aligned to table columns.

**Rationale**: FR-004 requires stats "alongside or below the record preview, associated with each field column." A panel below the table with per-column cards provides a clear visual association between each column header and its stats. Tooltips would hide the information behind hover interactions (less discoverable). Inline stats within column headers would clutter the table.

**Implementation**: `field-stats-panel.tsx` renders a horizontal row of `field-stat-column.tsx` cards, one per field, aligned to the table columns above. Each card shows: null count (with percentage), distinct count, and sample values (up to 5). The panel is collapsible to avoid overwhelming the view.

**Alternatives**: Tooltips on column headers (less discoverable, requires hover), stats in a sidebar (breaks column association), inline in each column header (cluttered).

## Decision 4: Sample Values Display

**Decision**: Show up to 5 unique non-null values, truncated at 100 characters per value.

**Rationale**: FR-001 specifies "up to 5 unique non-null values." FR-006 specifies truncation at "a reasonable display length (e.g., 100 characters per value)." Five values provide enough variety to spot patterns (e.g., all values are "Active"/"Inactive" for a status field) without overwhelming the display.

**Implementation**: `computeFieldStats()` collects unique non-null values in insertion order (Set), stops at 5. Each value is stringified (`String(value)`) and truncated at 100 characters with "..." suffix if exceeded.

## Decision 5: Binary/Blob Field Handling

**Decision**: Skip stats computation for binary/blob fields. Display "N/A" in the stats panel.

**Rationale**: FR-005 requires "N/A" for non-computable fields. Binary data cannot be meaningfully counted for distinct values or sampled. The field type is detected from `FieldMetadataEntry.dataType` or by checking if the raw value is a `Uint8Array` or similar binary type.

**Implementation**: `computeFieldStats()` checks if all values for a field are binary (or if the field's `dataType` indicates binary). If so, returns `{ nullCount: 0, distinctCount: 0, sampleValues: [] }` with a `isComputable: false` flag. The UI renders "N/A" when this flag is set.

## Decision 6: Memoization Strategy

**Decision**: Memoize stats computation with `useMemo`, keyed on the records array reference.

**Rationale**: Stats should recompute when the records change (page navigation, page size change) but not on every render. Since the records array comes from 009's hook state, its reference changes only when new records are fetched. `useMemo` with the records array as a dependency provides correct invalidation with zero overhead.

**Alternatives**: Manual caching with a Map (unnecessary complexity), Web Worker for computation (overkill for <1s computation on 100 records).

## Decision 7: Zero Records Handling

**Decision**: When zero records are fetched, display "No data to analyze" instead of empty stats.

**Rationale**: Edge case from spec: "An object has zero records: stats are not available." A clear message avoids confusion (are stats loading? broken? or genuinely empty?).
