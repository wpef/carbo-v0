# Contracts: Object Mapping API

## REST Endpoints

All endpoints are Next.js Route Handlers under `app/api/plans/[planId]/object-mappings/`.

---

### GET /api/plans/[planId]/object-mappings

List all object mappings for a migration plan.

**Response** `200 OK`:
```typescript
{
  mappings: ObjectMappingRow[]
}
```

**Error responses**:
- `404 Not Found` — Plan does not exist.

---

### POST /api/plans/[planId]/object-mappings

Create a new object mapping (manual link).

**Request body**:
```typescript
{
  sourceObjectName: string       // apiName of the source object
  destinationObjectName: string  // apiName of the destination object
}
```

**Validation**:
- `sourceObjectName` must exist in the source schema snapshot.
- `destinationObjectName` must exist in the destination schema snapshot.
- The pair `(planId, sourceObjectName, destinationObjectName)` must not already exist (FR-006).

**Response** `201 Created`:
```typescript
{
  mapping: ObjectMappingRow
  warnings: string[]  // e.g., ["Fan-in: destination 'Contact' is already linked to another source object"]
}
```

**Error responses**:
- `400 Bad Request` — Validation failed (missing fields, object not in schema).
- `404 Not Found` — Plan does not exist.
- `409 Conflict` — Duplicate mapping already exists.

**Side effects**:
- AuditLog entry: `{ action: 'OBJECT_MAPPING_CREATED', entityType: 'ObjectMapping', entityId: <id>, details: { sourceObjectName, destinationObjectName, manual: true } }`

---

### DELETE /api/plans/[planId]/object-mappings/[mappingId]

Remove an object mapping with cascade delete of all child data.

**Response** `200 OK`:
```typescript
{
  deleted: {
    objectMapping: { id: string; sourceObjectName: string; destinationObjectName: string }
    fieldMappingsCount: number
    migrationFiltersCount: number
  }
}
```

**Error responses**:
- `404 Not Found` — Mapping or plan does not exist.

**Side effects**:
- Cascade delete: FieldMappings, MigrationLogic, ValueEquivalences, ClassificationPrompts, MigrationFilters.
- AuditLog entry: `{ action: 'OBJECT_MAPPING_DELETED', entityType: 'ObjectMapping', entityId: <id>, details: { sourceObjectName, destinationObjectName, cascadedFieldMappings: <count>, cascadedFilters: <count> } }`

---

### POST /api/plans/[planId]/object-mappings/auto-link

Trigger auto-link for predictable object pairs. Runs only if `objectAutoLinkedAt IS NULL`.

**Request body**: None (adapter types are inferred from plan connections).

**Response** `200 OK`:
```typescript
{
  result: AutoLinkResult
}
```

Where `AutoLinkResult`:
```typescript
{
  createdMappings: ObjectMappingRow[]
  skippedPairs: { source: string; dest: string; reason: string }[]
  alreadyLinkedAt: string | null  // non-null if auto-link was already run (no-op)
}
```

**Behavior**:
- If `objectAutoLinkedAt` is non-null: returns `alreadyLinkedAt` timestamp, creates nothing.
- If `objectAutoLinkedAt` is null: creates mappings for all predictable pairs, sets `objectAutoLinkedAt = NOW()` in the same transaction (FR-004).
- Pairs where one side does not exist in the current schema are skipped (returned in `skippedPairs`).
- Pairs that already exist as manual mappings are skipped.

**Side effects**:
- AuditLog entry: `{ action: 'AUTO_LINK_EXECUTED', entityType: 'MigrationPlan', entityId: <planId>, details: { createdCount, skippedCount, pairs: [...] } }`

---

### GET /api/plans/[planId]/object-mappings/[mappingId]/stats

Fetch aggregated stats for the object detail modal (A3).

**Response** `200 OK`:
```typescript
{
  stats: ObjectMappingWithStats
}
```

**Error responses**:
- `404 Not Found` — Mapping or plan does not exist.

**Notes**:
- `sourceRecordCount` and `destRecordCount` are fetched from the connector adapter (cached per session).
- `totalSourceFields`, `mappedFieldCount`, `validatedFieldCount` are computed from database queries.
- `filterCount` is a simple count query on `MigrationFilter`.

---

## Service Layer Contract

```typescript
interface ObjectMappingService {
  /** List all object mappings for a plan */
  listMappings(planId: string): Promise<ObjectMappingRow[]>

  /** Create a manual object mapping */
  createMapping(
    planId: string,
    sourceObjectName: string,
    destinationObjectName: string
  ): Promise<{ mapping: ObjectMappingRow; warnings: string[] }>

  /** Delete an object mapping with cascade */
  deleteMapping(
    planId: string,
    mappingId: string
  ): Promise<{ fieldMappingsCount: number; filtersCount: number }>

  /** Execute auto-link (one-shot, gated by objectAutoLinkedAt) */
  autoLink(planId: string): Promise<AutoLinkResult>

  /** Fetch stats for detail modal */
  getMappingStats(planId: string, mappingId: string): Promise<ObjectMappingWithStats>
}
```
