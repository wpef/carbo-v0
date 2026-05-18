# Quickstart: Record Preview

## What this feature provides

A paginated, read-only data table showing actual records from any selected source or destination object. The consultant can browse records page by page, see total record count, inspect null/empty values explicitly, view relationship references, and expand long text values. Records are fetched on-demand via the connector adapter and are never persisted locally.

## Prerequisites

- Feature 001 (Migration Plan) -- plan exists
- Feature 002 (Source Connection) or 006 (Destination Connection) -- connection in CONNECTED status
- Feature 003/007 (Schema Retrieval) -- CURRENT snapshot with objects
- Feature 005/008 (Field Retrieval) -- fields persisted for the target object (used for column headers and metadata)

## How to open the record preview

The record preview is accessed per object, from the schema/field exploration UI:

```typescript
// Navigate to the record preview page
router.push(`/plans/${planId}/source/preview/${objectApiName}`)
// or for destination:
router.push(`/plans/${planId}/destination/preview/${objectApiName}`)
```

## How to fetch records programmatically

```typescript
// Fetch a page of records (via API route)
const res = await fetch(
  `/api/plans/${planId}/source/records/${objectApiName}?page=1&pageSize=50`
)
const data: RecordPreviewResponse = await res.json()
// data.records: FormattedRecord[] with CellValue objects
// data.totalCount, data.currentPage, data.hasNextPage, data.hasPreviousPage

// Fetch total record count separately
const countRes = await fetch(
  `/api/plans/${planId}/source/records/${objectApiName}/count`
)
const { totalCount }: RecordCountResponse = await countRes.json()
```

## How to use the React hooks

```typescript
import { useRecords } from '@/features/009-record-preview/hooks/use-records'
import { useRecordCount } from '@/features/009-record-preview/hooks/use-record-count'

function RecordPreviewPage({ planId, side, objectApiName }) {
  const {
    records,
    fieldMetadata,
    page,
    pageSize,
    hasNextPage,
    hasPreviousPage,
    isLoading,
    error,
    goToNextPage,
    goToPreviousPage,
    setPageSize,
  } = useRecords({ planId, side, objectApiName })

  const { totalCount, isLoading: countLoading } = useRecordCount({
    planId, side, objectApiName
  })

  // Render RecordTable component with these values
}
```

## Key types

```typescript
// CellValue — enriched cell for display
interface CellValue {
  raw: unknown
  display: string
  type: 'null' | 'empty' | 'text' | 'number' | 'boolean' | 'reference' | 'binary' | 'unknown'
  isTruncated: boolean
  fullValue?: string
}

// FormattedRecord — one row of display-ready cells
type FormattedRecord = Record<string, CellValue>

// RecordPreviewResponse — API response
interface RecordPreviewResponse {
  objectApiName: string
  objectLabel: string
  records: FormattedRecord[]
  totalCount: number
  pageSize: number
  currentPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  fieldMetadata: FieldMetadataEntry[]
}
```

## UI behavior

- Default page size is 50 records; options are 25, 50, 100 (FR-002)
- Pagination: Previous/Next buttons + current page indicator (FR-003)
- Total record count displayed as a badge (FR-004)
- Null values: styled italic `null` label (FR-005)
- Empty strings: styled `""` indicator (FR-005)
- Binary/blob fields: `[binary data]` placeholder (edge case)
- Long text (>200 chars): truncated with "..." and an expand popover (FR-007)
- Relationship fields: display resolved reference with a relationship icon (FR-006)
- Zero records: "No records found" message with count of 0 (edge case)
- Single record: pagination controls hidden (edge case)
- Page size change: resets to page 1 (edge case)
- Network error: error message with retry button, current page state preserved (edge case)

## Dependencies

- **Depends on**: 000 (ConnectorAdapter.getRecords, getRecordCount, PaginatedRecords, ConnectorRecord), 001 (MigrationPlan), 002/006 (ConnectorConnection), 005/008 (ObjectField for field metadata)
- **Used by**: 010 (Field Stats -- computed from records fetched here)
