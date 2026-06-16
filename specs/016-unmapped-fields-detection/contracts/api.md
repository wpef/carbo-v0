# API Contracts: Unmapped Fields Detection

## Base URL

All routes are Next.js Route Handlers nested under the object mapping resource:
`/api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields`

---

## GET /api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields

**Purpose**: Get unmapped fields report with coverage statistics (FR-001, FR-002).

**Response** `200 OK`:
```json
{
  "unmappedSourceFields": [
    {
      "apiName": "string",
      "label": "string",
      "dataType": "string",
      "isRequired": false
    }
  ],
  "excludedSourceFields": [
    {
      "id": "string (uuid)",
      "sourceFieldName": "string",
      "reason": "string | null",
      "createdAt": "ISO 8601"
    }
  ],
  "unmappedRequiredDestFields": [
    {
      "apiName": "string",
      "label": "string",
      "dataType": "string",
      "isRequired": true
    }
  ],
  "sourceCoverage": 80,
  "destinationRequiredCoverage": 75,
  "totalSourceFields": 25,
  "mappedSourceFields": 17,
  "totalRequiredDestFields": 8,
  "mappedRequiredDestFields": 6,
  "fieldsRemainingToValidate": 7,
  "isComplete": false
}
```

**Notes**: Coverage percentages are rounded to the nearest integer. `unmappedSourceFields` excludes fields that are either mapped or intentionally excluded. `unmappedRequiredDestFields` only includes destination fields marked as `isRequired` in the schema. `fieldsRemainingToValidate` is the count of unmapped source fields + unmapped required destination fields -- used by the 011 object detail modal (A3). `isComplete` is true when both coverages are 100%.

**Audit**: No audit log for read operations.

---

## GET /api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields/exclusions

**Purpose**: List all field exclusions for an object mapping (FR-003, FR-005).

**Response** `200 OK`:
```json
{
  "exclusions": [
    {
      "id": "string (uuid)",
      "objectMappingId": "string",
      "sourceFieldName": "string",
      "reason": "string | null",
      "createdAt": "ISO 8601"
    }
  ],
  "count": 3
}
```

**Notes**: Returns an empty array if no exclusions exist. Ordered by `createdAt` ascending.

**Audit**: No audit log for read operations.

---

## POST /api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields/exclusions

**Purpose**: Exclude one or more source fields from the mapping (FR-003, FR-004).

**Request Body** (single exclusion):
```json
{
  "sourceFieldName": "string (required)",
  "reason": "string (optional)"
}
```

**Request Body** (bulk exclusion):
```json
{
  "exclusions": [
    {
      "sourceFieldName": "string (required)",
      "reason": "string (optional)"
    }
  ]
}
```

**Response** `201 Created` (single):
```json
{
  "id": "string (uuid)",
  "objectMappingId": "string",
  "sourceFieldName": "string",
  "reason": "string | null",
  "createdAt": "ISO 8601"
}
```

**Response** `201 Created` (bulk):
```json
{
  "exclusions": [
    {
      "id": "string (uuid)",
      "objectMappingId": "string",
      "sourceFieldName": "string",
      "reason": "string | null",
      "createdAt": "ISO 8601"
    }
  ],
  "count": 5
}
```

**Validation**:
- `sourceFieldName` must be a non-empty string (or each entry in the `exclusions` array).
- The source field must exist in the source object's schema.
- The source field must not already be mapped (a mapped field should not be excluded).
- The source field must not already be excluded (unique constraint on `objectMappingId + sourceFieldName`).

**Errors**:
- `400 Bad Request`: Missing required fields. Body: `{ "error": "string" }`.
- `404 Not Found`: Object mapping does not exist.
- `409 Conflict`: Field is already excluded. Body: `{ "error": "Field 'xyz' is already excluded" }`.
- `422 Unprocessable Entity`: Field is currently mapped. Body: `{ "error": "Field 'xyz' is mapped -- remove the mapping first" }`.

**Audit**: Logs `FIELD_EXCLUDED` (single) or `FIELDS_EXCLUDED_BULK` (bulk) with `entityType: "FieldExclusion"`, `entityId: <exclusion id(s)>`, `details: { objectMappingId, sourceFieldNames, reasons }`.

---

## DELETE /api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields/exclusions/[exclusionId]

**Purpose**: Reverse an exclusion -- the field returns to the unmapped warning list (FR-003).

**Response** `204 No Content`: Empty body.

**Errors**:
- `404 Not Found`: Exclusion does not exist. Body: `{ "error": "Exclusion not found" }`.

**Audit**: Logs `FIELD_UNEXCLUDED` with `entityType: "FieldExclusion"`, `entityId: <exclusion id>`, `details: { objectMappingId, sourceFieldName }`.

---

## Error Response Format

All error responses follow a consistent shape:

```json
{
  "error": "string (human-readable message)"
}
```

HTTP status codes used: `400` (validation), `404` (not found), `409` (conflict -- already excluded), `422` (semantic validation -- field is mapped), `500` (internal server error).

---

## TypeScript Types (shared)

```typescript
// src/features/unmapped-fields/types.ts

interface FieldInfo {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
}

interface FieldExclusionItem {
  id: string
  objectMappingId: string
  sourceFieldName: string
  reason: string | null
  createdAt: string
}

interface UnmappedFieldsReport {
  unmappedSourceFields: FieldInfo[]
  excludedSourceFields: FieldExclusionItem[]
  unmappedRequiredDestFields: FieldInfo[]
  sourceCoverage: number
  destinationRequiredCoverage: number
  totalSourceFields: number
  mappedSourceFields: number
  totalRequiredDestFields: number
  mappedRequiredDestFields: number
  fieldsRemainingToValidate: number
  isComplete: boolean
}

interface CreateExclusionInput {
  sourceFieldName: string
  reason?: string
}

interface BulkExclusionInput {
  exclusions: CreateExclusionInput[]
}

interface ExclusionListResponse {
  exclusions: FieldExclusionItem[]
  count: number
}
```
