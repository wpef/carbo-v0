# Contracts: Field Mapping API

## REST Endpoints

All endpoints are Next.js Route Handlers under `app/api/plans/[planId]/field-mappings/`.

---

### GET /api/plans/[planId]/field-mappings?objectMappingId={id}

List all field mappings for a specific object mapping, enriched with computed link status.

**Query parameters**:
- `objectMappingId` (required): ID of the parent ObjectMapping.

**Response** `200 OK`:
```typescript
{
  mappings: FieldMappingWithStatus[]
}
```

Where `FieldMappingWithStatus` includes computed `linkStatus`, `hasLogic`, `isLogicValidated`, `logicSectionType`, and `driftFlag` per data-model.md.

**Error responses**:
- `400 Bad Request` — Missing `objectMappingId`.
- `404 Not Found` — Plan or ObjectMapping does not exist.

---

### POST /api/plans/[planId]/field-mappings

Create a new field mapping (manual link).

**Request body**:
```typescript
{
  objectMappingId: string
  sourceFieldName: string        // apiName of the source field
  destinationFieldName: string   // apiName of the destination field
}
```

**Validation**:
- `objectMappingId` must belong to the plan.
- `sourceFieldName` must exist in the source object's fields (via snapshot).
- `destinationFieldName` must exist in the destination object's fields (via snapshot).
- The source field must not already be mapped within this object mapping (1:1 constraint).
- The destination field must not already be mapped within this object mapping (1:1 constraint).

**Response** `201 Created`:
```typescript
{
  mapping: FieldMappingWithStatus
}
```

The response includes the computed `compatibilityStatus` (from the type matrix) and initial `linkStatus` (RED_SOLID for COMPATIBLE/WARNING, RED_DASHED for INCOMPATIBLE).

**Error responses**:
- `400 Bad Request` — Validation failed (missing fields, field not in schema).
- `404 Not Found` — Plan or ObjectMapping does not exist.
- `409 Conflict` — Source or destination field already mapped (1:1 violation).

**Side effects**:
- AuditLog entry: `{ action: 'FIELD_MAPPING_CREATED', entityType: 'FieldMapping', entityId: <id>, details: { objectMappingId, sourceFieldName, destinationFieldName, sourceFieldType, destinationFieldType, compatibilityStatus, manual: true } }`

---

### DELETE /api/plans/[planId]/field-mappings/[fieldMappingId]

Remove a field mapping with cascade deletion of migration logic.

**Response** `200 OK`:
```typescript
{
  deleted: {
    fieldMapping: { id: string; sourceFieldName: string; destinationFieldName: string }
    hadMigrationLogic: boolean
  }
}
```

**Error responses**:
- `404 Not Found` — FieldMapping, ObjectMapping, or Plan does not exist.

**Side effects**:
- Cascade delete: MigrationLogic (and its children: ValueEquivalence, ClassificationPrompt).
- AuditLog entry: `{ action: 'FIELD_MAPPING_DELETED', entityType: 'FieldMapping', entityId: <id>, details: { sourceFieldName, destinationFieldName, hadMigrationLogic } }`

---

### POST /api/plans/[planId]/field-mappings/auto-match

Trigger auto-match for native field correspondences on a specific object mapping. Runs only if `fieldAutoMatchedAt IS NULL`.

**Request body**:
```typescript
{
  objectMappingId: string
}
```

**Response** `200 OK`:
```typescript
{
  result: AutoMatchResult
}
```

Where `AutoMatchResult`:
```typescript
{
  createdMappings: FieldMappingRow[]
  skippedFields: { source: string; dest: string; reason: string }[]
  alreadyMatchedAt: string | null  // non-null if auto-match already ran (no-op)
}
```

**Behavior**:
- If `fieldAutoMatchedAt` is non-null: returns `alreadyMatchedAt` timestamp, creates nothing.
- If `fieldAutoMatchedAt` is null: runs registry pairs + name-based fallback, creates mappings, sets `fieldAutoMatchedAt = NOW()` in the same transaction (FR-006).
- Registry pairs take precedence. Name fallback only matches fields not already covered.
- Skipped fields include: already-mapped fields, fields with no match, fields excluded by the registry.

**Side effects**:
- AuditLog entry: `{ action: 'AUTO_MATCH_EXECUTED', entityType: 'ObjectMapping', entityId: <objectMappingId>, details: { createdCount, skippedCount, registryPairs, nameFallbackPairs } }`

---

### GET /api/plans/[planId]/field-mappings/unmapped?objectMappingId={id}

Get unmapped fields for both source and destination sides of an object mapping.

**Query parameters**:
- `objectMappingId` (required): ID of the parent ObjectMapping.

**Response** `200 OK`:
```typescript
{
  unmappedSource: UnmappedField[]
  unmappedDestination: UnmappedField[]
  totalSourceFields: number
  totalDestFields: number
  mappedCount: number
}
```

**Error responses**:
- `400 Bad Request` — Missing `objectMappingId`.
- `404 Not Found` — Plan or ObjectMapping does not exist.

---

### GET /api/plans/[planId]/field-mappings/preview?objectMappingId={id}&recordIndex={n}

Get a migration preview for a source record showing before/after field values.

**Query parameters**:
- `objectMappingId` (required): ID of the parent ObjectMapping.
- `recordIndex` (optional, default 0): Index of the source record to preview (0-24).

**Response** `200 OK`:
```typescript
{
  records: {
    id: string
    label: string
  }[]
  preview: MigrationPreviewRecord | null  // null if no field mappings exist
}
```

Where `MigrationPreviewRecord`:
```typescript
{
  recordId: string
  label: string
  fields: {
    sourceFieldName: string
    sourceValue: unknown
    destFieldName: string
    destValue: unknown
    isTransformed: boolean
  }[]
}
```

**Behavior**:
- Loads 25 source records via `getRecords(connectionId, objectApiName, 1, 25)`.
- For each mapped field, applies value equivalences (if any) from MigrationLogic.
- Returns `null` preview if no field mappings exist (sidebar shows placeholder).

**Error responses**:
- `400 Bad Request` — Missing `objectMappingId`.
- `404 Not Found` — Plan, ObjectMapping, or source connection does not exist.

---

## Service Layer Contract

```typescript
interface FieldMappingService {
  /** List all field mappings for an object mapping with computed statuses */
  listMappings(planId: string, objectMappingId: string): Promise<FieldMappingWithStatus[]>

  /** Create a manual field mapping */
  createMapping(
    planId: string,
    objectMappingId: string,
    sourceFieldName: string,
    destinationFieldName: string
  ): Promise<FieldMappingWithStatus>

  /** Delete a field mapping with cascade */
  deleteMapping(
    planId: string,
    fieldMappingId: string
  ): Promise<{ hadMigrationLogic: boolean }>

  /** Execute auto-match (one-shot, gated by fieldAutoMatchedAt) */
  autoMatch(planId: string, objectMappingId: string): Promise<AutoMatchResult>

  /** Get unmapped fields for both sides */
  getUnmappedFields(planId: string, objectMappingId: string): Promise<{
    unmappedSource: UnmappedField[]
    unmappedDestination: UnmappedField[]
    totalSourceFields: number
    totalDestFields: number
    mappedCount: number
  }>

  /** Get migration preview for a source record */
  getPreview(
    planId: string,
    objectMappingId: string,
    recordIndex: number
  ): Promise<{ records: { id: string; label: string }[]; preview: MigrationPreviewRecord | null }>
}
```

### Type Compatibility Service

```typescript
interface TypeCompatibilityService {
  /** Normalize a raw connector type to one of the 5 canonical categories */
  normalizeType(rawType: string): NormalizedType

  /** Check compatibility between two raw types */
  checkCompatibility(sourceRawType: string, destRawType: string): CompatibilityStatus

  /** Get the migration logic section type for a given compatibility */
  getLogicSectionType(
    sourceNormalizedType: NormalizedType,
    destNormalizedType: NormalizedType
  ): 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL'
}
```

### LinkStatus Computation Service

```typescript
interface LinkStatusService {
  /** Compute the link status for a field mapping */
  computeLinkStatus(
    mapping: FieldMappingRow,
    hasLogic: boolean,
    isLogicValidated: boolean,
    existsInSchema: boolean
  ): LinkStatus
}
```
