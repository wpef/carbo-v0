# Research: Field Stats

## Key Decisions

### 1. Client-Side vs. Server-Side Computation

**Decision**: Client-side only.

Per spec FR-002: "Stats MUST be computed client-side from records already fetched for the record preview. No additional API call is required."

The records are already in the React state from the `useRecordPreview` hook. The stats function iterates over them in-memory. For 100 records with 200 fields, this is ~20,000 iterations — trivial for modern browsers (sub-100ms).

### 2. Stats Scope: Current Page vs. Accumulated Pages

**Decision**: Current page only (with clear scope label).

The spec says: "computed from the fetched records (the current page or accumulated pages), and the scope is clearly indicated." For v0, we compute from the current page only. The scope label reads: "Based on N records (page M of total T)".

Future enhancement could accumulate records across navigated pages, but this adds complexity (memory management, invalidation) that is out of scope.

### 3. Computation Algorithm

**Decision**: Single-pass iteration over records.

```typescript
function computeFieldStats(records: ConnectorRecord[]): FieldStats[] {
  // For each field across all records:
  // 1. Count nulls (value === null || value === undefined)
  // 2. Track distinct values using a Set (up to a cap to avoid memory issues)
  // 3. Collect first 5 unique non-null values as samples
  // Binary/blob detection: skip fields where value appears to be binary
}
```

The function returns one `FieldStats` per field. Fields are discovered from the union of all keys across all records (handles sparse records where some fields are absent).

### 4. Binary/Blob Detection

**Decision**: Check if value matches `"[binary data]"` placeholder (set by the record preview service in 009). If so, return `{ nullCount: 0, distinctCount: 0, sampleValues: [], isBinary: true }` with "N/A" display.

### 5. Display Position

**Decision**: Collapsible stats row rendered above the record table, toggled by a "Show field stats" button. Each column header can also expand to show its stats inline.

The stats row shows a horizontal summary: one cell per field column with null count, distinct count, and sample values. This aligns stats with their respective columns.

### 6. Sample Value Truncation

**Decision**: Truncate sample values at 100 characters for display. Same pattern as record table truncation.

## Trade-offs

| Choice | Pro | Con |
|--------|-----|-----|
| Client-side only | No API call, instant | Stats limited to fetched page |
| Current page scope | Simple, predictable | Doesn't reflect full dataset |
| Single-pass algorithm | O(n*f) performance, simple | Set memory for high-cardinality fields |
| Distinct value cap (1000) | Prevents memory bloat | Distinct count may say "1000+" for very high cardinality |
