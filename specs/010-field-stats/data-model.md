# Data Model: Field Stats

## Prisma Schema Additions

None. Field stats are computed client-side from fetched records and are never persisted. No database tables or migrations are required for this feature.

## Runtime TypeScript Types

The core `FieldStats` type comes from `src/lib/types/connector.ts` (000). Feature-specific types are defined in `src/features/010-field-stats/lib/field-stats-types.ts`.

### FieldStats (from 000, unchanged)

```typescript
// Re-exported from @/lib/types/connector
interface FieldStats {
  fieldApiName: string
  nullCount: number
  distinctCount: number
  sampleValues: unknown[]   // up to 5 unique non-null values
}
```

### ComputedFieldStats (feature-specific extension)

```typescript
// Extends FieldStats with display-specific metadata
interface ComputedFieldStats extends FieldStats {
  totalRecords: number            // Number of records analyzed
  nullPercentage: number          // nullCount / totalRecords * 100, rounded to 1 decimal
  isComputable: boolean           // false for binary/blob fields (FR-005)
  truncatedSampleValues: string[] // sampleValues stringified and truncated at 100 chars (FR-006)
}
```

### FieldStatsResult

```typescript
// Return type of computeFieldStats()
interface FieldStatsResult {
  stats: ComputedFieldStats[]     // One entry per field
  scope: StatsScope               // Scope metadata for labeling
}
```

### StatsScope

```typescript
// Metadata about the scope of stats computation (FR-003)
interface StatsScope {
  analyzedCount: number           // Number of records used for stats
  totalCount: number | null       // Total records in the object (from 009's count), null if unknown
  isFullDataset: boolean          // true if analyzedCount === totalCount
  label: string                   // e.g., "Based on 50 of 10,000 records" or "Based on 50 records (full dataset)"
}
```

### StatsDisplayConfig

```typescript
// Configuration for stats display
interface StatsDisplayConfig {
  maxSampleValues: number         // Default: 5 (FR-001)
  maxSampleValueLength: number    // Default: 100 characters (FR-006)
  showPercentages: boolean        // Default: true
}

const DEFAULT_STATS_CONFIG: StatsDisplayConfig = {
  maxSampleValues: 5,
  maxSampleValueLength: 100,
  showPercentages: true,
}
```

## Relationships (Runtime)

```
Records from 009 (FormattedRecord[])
    |
    v
computeFieldStats(records, fieldMetadata, totalCount?)
    |
    v
FieldStatsResult { stats: ComputedFieldStats[], scope: StatsScope }
    |
    v
FieldStatsPanel (UI) -> FieldStatColumn (per field) + StatsScopeLabel
```

## Notes

- `ComputedFieldStats` extends `FieldStats` from 000 rather than replacing it. The base type is used by the connector adapter interface; the extended type adds display concerns.
- `sampleValues` on `FieldStats` contains raw values (`unknown[]`). `truncatedSampleValues` on `ComputedFieldStats` contains stringified, truncated versions for display.
- `StatsScope.totalCount` is nullable because the total count comes from a separate call (009's `useRecordCount` hook) that may not have resolved yet. If null, the label omits "of M" (e.g., "Based on 50 records").
- All types are runtime-only. No persistence, no Prisma models, no migrations.
