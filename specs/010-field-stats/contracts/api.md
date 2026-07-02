# Contracts: Field Stats

## No API Routes

This feature has no HTTP API routes. Stats are computed entirely client-side from records already in memory (FR-002). There are no server-side endpoints, no database operations, and no additional network calls.

## Computation Contract

The contract for this feature is the pure function `computeFieldStats()`. Any caller providing records and field metadata receives accurate stats.

### Function Signature

```typescript
/**
 * Compute per-field statistics from a set of records.
 *
 * @param records - Array of raw records (ConnectorRecord[]) from the connector adapter
 * @param fieldMetadata - Field metadata entries (from ObjectField, via 009's FieldMetadataEntry)
 * @param totalCount - Total record count for the object (optional, for scope labeling)
 * @param config - Display configuration (optional, defaults to DEFAULT_STATS_CONFIG)
 * @returns FieldStatsResult with per-field stats and scope metadata
 */
function computeFieldStats(
  records: ConnectorRecord[],
  fieldMetadata: FieldMetadataEntry[],
  totalCount?: number | null,
  config?: Partial<StatsDisplayConfig>
): FieldStatsResult
```

### Contract Guarantees

| Guarantee | Description |
|-----------|-------------|
| Null count accuracy | `stats[i].nullCount` equals the exact count of records where `record[fieldApiName]` is `null` or `undefined` |
| Distinct count accuracy | `stats[i].distinctCount` equals the number of unique non-null values for that field (SC-002) |
| Sample values limit | `stats[i].sampleValues.length <= config.maxSampleValues` (default 5) |
| Sample values uniqueness | All values in `sampleValues` are unique |
| Sample values non-null | No null values appear in `sampleValues` |
| Truncation | `stats[i].truncatedSampleValues[j].length <= config.maxSampleValueLength` (default 100) |
| Binary fields | If all values for a field are binary, `isComputable = false`, `nullCount = 0`, `distinctCount = 0`, `sampleValues = []` |
| Empty records | If `records.length === 0`, returns empty `stats[]` array with `scope.analyzedCount = 0` |
| Scope label | `scope.label` always reflects the analyzed count and total (if known) |
| Null percentage | `stats[i].nullPercentage = Math.round(nullCount / totalRecords * 1000) / 10` (one decimal) |
| Idempotent | Same inputs always produce the same outputs (pure function) |

### Example Input/Output

**Input**:
```typescript
const records = [
  { Name: "Alice", Email: "alice@ex.com", Phone: null, Status: "Active" },
  { Name: "Bob", Email: null, Phone: null, Status: "Active" },
  { Name: "Charlie", Email: "charlie@ex.com", Phone: "+1234", Status: "Inactive" },
]

const fieldMetadata = [
  { apiName: "Name", label: "Name", dataType: "string", referenceTo: null, relationshipType: null },
  { apiName: "Email", label: "Email", dataType: "string", referenceTo: null, relationshipType: null },
  { apiName: "Phone", label: "Phone", dataType: "string", referenceTo: null, relationshipType: null },
  { apiName: "Status", label: "Status", dataType: "string", referenceTo: null, relationshipType: null },
]
```

**Output**:
```typescript
{
  stats: [
    {
      fieldApiName: "Name",
      nullCount: 0,
      distinctCount: 3,
      sampleValues: ["Alice", "Bob", "Charlie"],
      totalRecords: 3,
      nullPercentage: 0,
      isComputable: true,
      truncatedSampleValues: ["Alice", "Bob", "Charlie"]
    },
    {
      fieldApiName: "Email",
      nullCount: 1,
      distinctCount: 2,
      sampleValues: ["alice@ex.com", "charlie@ex.com"],
      totalRecords: 3,
      nullPercentage: 33.3,
      isComputable: true,
      truncatedSampleValues: ["alice@ex.com", "charlie@ex.com"]
    },
    {
      fieldApiName: "Phone",
      nullCount: 2,
      distinctCount: 1,
      sampleValues: ["+1234"],
      totalRecords: 3,
      nullPercentage: 66.7,
      isComputable: true,
      truncatedSampleValues: ["+1234"]
    },
    {
      fieldApiName: "Status",
      nullCount: 0,
      distinctCount: 2,
      sampleValues: ["Active", "Inactive"],
      totalRecords: 3,
      nullPercentage: 0,
      isComputable: true,
      truncatedSampleValues: ["Active", "Inactive"]
    }
  ],
  scope: {
    analyzedCount: 3,
    totalCount: 15000,
    isFullDataset: false,
    label: "Based on 3 of 15,000 records"
  }
}
```

## Integration Contract with 009

The field stats feature reads data from 009's `useRecords` hook but does not modify it:

```typescript
// In the record preview page (009's page.tsx or a wrapper)
const { records, fieldMetadata, totalCount } = useRecords(...)
const { stats, scope } = useFieldStats(records, fieldMetadata, totalCount)
```

The `useFieldStats` hook wraps `computeFieldStats()` with memoization. It re-computes stats only when the records array reference changes (page navigation or page size change).
