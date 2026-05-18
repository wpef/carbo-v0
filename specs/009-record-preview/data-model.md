# Data Model: Record Preview

## Prisma Schema Additions

None. Records are fetched on-demand via the connector adapter and are not persisted in the local database. The feature uses existing Prisma models (`MigrationPlan`, `ConnectorConnection`, `SchemaObject`, `ObjectField`) for plan/connection resolution and field metadata only.

## Runtime TypeScript Types

All types below are defined in the feature module. The core types (`ConnectorRecord`, `PaginatedRecords`) come from `src/lib/types/connector.ts` (000).

### RecordPreviewRequest

```typescript
// Used by the API route to validate query parameters
interface RecordPreviewRequest {
  planId: string
  side: 'source' | 'destination'
  objectApiName: string
  page: number        // 1-indexed (FR-012 from 000)
  pageSize: number    // 25 | 50 | 100 (FR-002)
}
```

### RecordPreviewResponse

```typescript
// API response shape for GET /api/plans/[planId]/[side]/records/[objectApiName]
interface RecordPreviewResponse {
  objectApiName: string
  objectLabel: string
  records: FormattedRecord[]
  totalCount: number
  pageSize: number
  currentPage: number    // 1-indexed
  hasNextPage: boolean
  hasPreviousPage: boolean
  fieldMetadata: FieldMetadataEntry[]
}
```

### FormattedRecord

```typescript
// A single record with display-ready values
type FormattedRecord = Record<string, CellValue>

// A cell value with type information for rendering
interface CellValue {
  raw: unknown                          // Original value from the connector
  display: string                       // Formatted display string
  type: 'null' | 'empty' | 'text' | 'number' | 'boolean' | 'reference' | 'binary' | 'unknown'
  isTruncated: boolean                  // True if display was truncated (FR-007)
  fullValue?: string                    // Full text when truncated
}
```

### FieldMetadataEntry

```typescript
// Lightweight field metadata for column headers and cell rendering
interface FieldMetadataEntry {
  apiName: string
  label: string
  dataType: string
  referenceTo: string | null
  relationshipType: string | null
}
```

### RecordCountResponse

```typescript
// API response shape for GET /api/plans/[planId]/[side]/records/[objectApiName]/count
interface RecordCountResponse {
  objectApiName: string
  totalCount: number
}
```

### PageSizeOption

```typescript
// Page size options per FR-002
type PageSizeOption = 25 | 50 | 100
const PAGE_SIZE_OPTIONS: PageSizeOption[] = [25, 50, 100]
const DEFAULT_PAGE_SIZE: PageSizeOption = 50
```

## Relationships (Runtime)

```
MigrationPlan (1) ---> (1) ConnectorConnection (source or destination, resolved by side)
ConnectorConnection ---> ConnectorAdapter.getRecords() ---> PaginatedRecords
ConnectorConnection ---> ConnectorAdapter.getRecordCount() ---> number
SchemaObject (1) ---> (N) ObjectField (used for FieldMetadataEntry[])
PaginatedRecords.records ---> FormattedRecord[] (via cell-formatters.ts)
```

## Notes

- `FormattedRecord` is an enriched version of `ConnectorRecord`. The service transforms raw `Record<string, unknown>` into display-ready `CellValue` objects with type classification and truncation.
- `FieldMetadataEntry` is derived from persisted `ObjectField` rows (from 005/008). It provides just enough metadata for the preview to render column headers and cell badges.
- No new database tables or migrations are required for this feature.
