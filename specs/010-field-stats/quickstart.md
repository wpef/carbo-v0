# Quickstart: Field Stats

## What this feature provides

Per-field data quality statistics computed from records displayed in the record preview (009). Shows null count (with percentage), distinct value count, and up to 5 sample unique values for each field. Helps the consultant spot null-heavy fields, low-cardinality fields, and unexpected patterns before creating the mapping plan.

## Prerequisites

- Feature 009 (Record Preview) -- records are loaded and visible in the preview table
- Records are fetched (at least one page loaded)

## How stats are computed

Stats are computed client-side from the currently displayed records. No API call is made. When the consultant navigates to a new page or changes the page size, stats recompute from the new record set.

```typescript
// Pure computation function (no side effects)
import { computeFieldStats } from '@/features/010-field-stats/lib/compute-field-stats'

const result = computeFieldStats(records, fieldMetadata, totalCount)
// result.stats: ComputedFieldStats[] -- one entry per field
// result.scope: { analyzedCount, totalCount, isFullDataset, label }
```

## How to use the React hook

```typescript
import { useFieldStats } from '@/features/010-field-stats/hooks/use-field-stats'

function RecordPreviewWithStats({ planId, side, objectApiName }) {
  // From 009's hook
  const { records, fieldMetadata } = useRecords({ planId, side, objectApiName })
  const { totalCount } = useRecordCount({ planId, side, objectApiName })

  // Compute stats (memoized -- recomputes only when records change)
  const { stats, scope, isComputing } = useFieldStats(records, fieldMetadata, totalCount)

  return (
    <>
      <RecordTable records={records} fieldMetadata={fieldMetadata} />
      <FieldStatsPanel stats={stats} scope={scope} isComputing={isComputing} />
    </>
  )
}
```

## Key types

```typescript
// ComputedFieldStats -- per-field stats with display metadata
interface ComputedFieldStats {
  fieldApiName: string
  nullCount: number
  distinctCount: number
  sampleValues: unknown[]          // up to 5 unique non-null values
  totalRecords: number
  nullPercentage: number           // e.g., 33.3
  isComputable: boolean            // false for binary fields
  truncatedSampleValues: string[]  // stringified, max 100 chars each
}

// StatsScope -- scope labeling
interface StatsScope {
  analyzedCount: number
  totalCount: number | null
  isFullDataset: boolean
  label: string                    // e.g., "Based on 50 of 10,000 records"
}

// FieldStatsResult -- full return type
interface FieldStatsResult {
  stats: ComputedFieldStats[]
  scope: StatsScope
}
```

## UI behavior

- Stats panel appears below the record table, with one stat card per field column
- Each card shows: null count (red if >50%), distinct count, sample values as chips
- Scope label always visible at the top: "Based on N records" or "Based on N of M records" (FR-003)
- Binary/blob fields: card shows "N/A" (FR-005)
- Zero records: "No data to analyze" message instead of empty stats
- All-null field: null count = total, distinct count = 0, no sample values (acceptance scenario 3)
- All-same-value field: distinct count = 1, single sample value (acceptance scenario 2)
- High cardinality: distinct count shown, only first 5 unique values displayed
- Long sample values: truncated at 100 characters with "..." (FR-006)
- Stats panel is collapsible (collapsed by default to avoid overwhelming the view)
- Stats recompute on every page navigation (new records -> new stats)

## Dependencies

- **Depends on**: 000 (FieldStats type), 009 (Record Preview -- provides records and field metadata)
- **Used by**: None currently. Future: mapping suggestions could leverage field stats to recommend transformations.
