# API Contracts: Migration Filters

## Base URL

All routes are Next.js Route Handlers nested under the object mapping resource:
`/api/plans/[planId]/object-mappings/[objectMappingId]/filters`

---

## GET /api/plans/[planId]/object-mappings/[objectMappingId]/filters

**Purpose**: List all migration filters for an object mapping (FR-001, FR-003).

**Response** `200 OK`:
```json
{
  "filters": [
    {
      "id": "string (uuid)",
      "objectMappingId": "string",
      "fieldApiName": "string",
      "fieldLabel": "string (optional, enriched from schema snapshot)",
      "operator": "EQUALS | NOT_EQUALS | CONTAINS | NOT_CONTAINS | STARTS_WITH | ENDS_WITH | GREATER_THAN | LESS_THAN | IS_NULL | DATE_AFTER | DATE_BEFORE",
      "value": "string | null",
      "isActive": "boolean"
    }
  ],
  "count": 2
}
```

**Notes**: Returns an empty array if no filters exist. The `count` field is a convenience for the 011 object detail modal (A3). Filters are ordered by `id` ascending (insertion order). `MigrationFilter` has no `createdAt`/`updatedAt` columns in the DB; these fields are omitted from the stored record.

**Audit**: No audit log for read operations.

---

## POST /api/plans/[planId]/object-mappings/[objectMappingId]/filters

**Purpose**: Create a new migration filter (FR-001, FR-005).

**Request Body**:
```json
{
  "fieldApiName": "string (required)",
  "operator": "string (required, must be a valid FilterOperator)",
  "value": "string (optional, null for IS_NULL operator)"
}
```

**Response** `201 Created`:
```json
{
  "id": "string (uuid)",
  "objectMappingId": "string",
  "fieldApiName": "string",
  "operator": "string",
  "value": "string | null",
  "isActive": true
}
```

**Validation**:
- `fieldApiName` must be a non-empty string.
- `fieldApiName` must exist in the source object's schema (FR-005). The service fetches the source object's fields from the schema snapshot and validates presence.
- `operator` must be one of the 11 supported operators (FR-002).
- `value` is optional. `IS_NULL` requires no value. For date operators (DATE_AFTER, DATE_BEFORE), the value should be ISO 8601 format (YYYY-MM-DD) — a warning is returned if the format is invalid, but creation is not blocked.
- Type-operator compatibility is checked: if the operator is a date operator on a non-date field (or vice versa), a `warning` field is included in the response but creation proceeds (spec edge case).

**Errors**:
- `400 Bad Request`: Missing required fields or invalid operator. Body: `{ "error": "string" }`.
- `404 Not Found`: Object mapping does not exist.
- `422 Unprocessable Entity`: Source field does not exist in the source schema. Body: `{ "error": "Le champ 'xyz' n'existe pas dans l'objet source 'Contact'" }`.

**Response with warning** `201 Created`:
```json
{
  "id": "string (uuid)",
  "objectMappingId": "string",
  "fieldApiName": "string",
  "operator": "string",
  "value": "string | null",
  "isActive": true,
  "warning": "Operator DATE_AFTER may not be compatible with field type 'text'"
}
```

**Audit**: Logs `FILTER_CREATED` with `entityType: "MigrationFilter"`, `entityId: <filter id>`, `details: { objectMappingId, fieldApiName, operator, value }`.

---

## DELETE /api/plans/[planId]/object-mappings/[objectMappingId]/filters/[filterId]

**Purpose**: Remove a migration filter (FR-006).

**Response** `204 No Content`: Empty body.

**Errors**:
- `404 Not Found`: Filter or object mapping does not exist. Body: `{ "error": "Filter not found" }`.

**Audit**: Logs `FILTER_REMOVED` with `entityType: "MigrationFilter"`, `entityId: <filter id>`, `details: { objectMappingId, fieldApiName, operator, value }`.

---

## GET /api/plans/[planId]/object-mappings/[objectMappingId]/filters/estimate

**Purpose**: Get the estimated record count matching all active filters (FR-004).

**Response** `200 OK`:
```json
{
  "estimatedCount": 4200,
  "totalCount": 12500,
  "isFiltered": true,
  "isEstimateAvailable": true
}
```

**Response** (source unreachable):
```json
{
  "estimatedCount": null,
  "totalCount": null,
  "isFiltered": true,
  "isEstimateAvailable": false,
  "message": "Estimate unavailable -- source system is unreachable"
}
```

**Response** (no filters):
```json
{
  "estimatedCount": 12500,
  "totalCount": 12500,
  "isFiltered": false,
  "isEstimateAvailable": true
}
```

**Notes**: The endpoint queries the source connector via `getFilteredRecordCount()` if available, or falls back to `getRecordCount()` for the total count. When no filters exist, `estimatedCount` equals `totalCount` and `isFiltered` is false. The `totalCount` is always the unfiltered count (useful for showing "~4,200 of 12,500 records"). If the source connector is unreachable, `isEstimateAvailable` is false and a human-readable `message` is included.

**Audit**: No audit log for estimation requests.

---

## Error Response Format

All error responses follow a consistent shape:

```json
{
  "error": "string (human-readable message)"
}
```

HTTP status codes used: `400` (validation), `404` (not found), `422` (semantic validation -- field does not exist), `500` (internal server error).

---

## TypeScript Types (shared)

```typescript
// src/features/filters/types.ts

type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_NULL'
  | 'DATE_AFTER'
  | 'DATE_BEFORE'

interface FilterItem {
  id: string
  objectMappingId: string
  fieldApiName: string
  fieldLabel?: string      // enriched from schema snapshot (optional)
  operator: FilterOperator
  value: string | null
  isActive: boolean
  warning?: string
  // Note: not persisted in DB — included for API backward compat
  createdAt?: string
  updatedAt?: string
}

interface CreateFilterInput {
  fieldApiName: string
  operator: FilterOperator
  value?: string
}

interface UpdateFilterInput {
  operator?: FilterOperator
  value?: string | null
  isActive?: boolean
}

interface FilterListResponse {
  filters: FilterItem[]
  count: number
}

interface FilterableField {
  apiName: string
  label: string
  dataType: string
}

interface FilterEstimate {
  estimatedCount: number | null
  totalCount: number | null
  isFiltered: boolean
  isEstimateAvailable: boolean
  message?: string
}
```
