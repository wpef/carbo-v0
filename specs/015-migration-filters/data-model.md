# Data Model: Migration Filters

## Prisma Schema

### MigrationFilter (FR-001, FR-002, FR-003)

```prisma
enum FilterOperator {
  EQUALS
  NOT_EQUALS
  CONTAINS
  NOT_CONTAINS
  STARTS_WITH
  ENDS_WITH
  GREATER_THAN
  LESS_THAN
  IS_NULL
  DATE_AFTER
  DATE_BEFORE
}

model MigrationFilter {
  id              String         @id @default(uuid())
  objectMappingId String
  fieldApiName    String
  operator        FilterOperator
  value           String?
  isActive        Boolean        @default(true)  // FR: toggle a filter on/off without deleting it

  objectMapping ObjectMapping @relation(fields: [objectMappingId], references: [id], onDelete: Cascade)
}
```

> **Note**: `MigrationFilter` has **no `createdAt` or `updatedAt` columns** in the implemented schema.
> The service DTO includes placeholder timestamps for API compatibility, but they are not persisted.
> The field referencing the source schema is `fieldApiName` (not `sourceFieldName`).


### Connector Interface Extension (FilterCondition type)

```typescript
// Added to src/lib/types/connector.ts

interface FilterCondition {
  fieldName: string
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GREATER_THAN' | 'LESS_THAN' | 'IS_NULL' | 'DATE_AFTER' | 'DATE_BEFORE'
  value: string
}

// Optional method added to ConnectorAdapter
interface ConnectorAdapter {
  // ... existing methods ...

  /** Optional: count records matching filter conditions. If not implemented, total count is returned. */
  getFilteredRecordCount?(connectionId: string, objectApiName: string, filters: FilterCondition[]): Promise<number>
}
```

## Field Descriptions

### MigrationFilter

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. |
| `objectMappingId` | `String` | FK to the parent ObjectMapping. Cascade-deleted when the object mapping is removed. |
| `fieldApiName` | `String` | The API name of the source field this filter applies to. Must exist in the source object's schema (FR-005). |
| `operator` | `FilterOperator` | The comparison operator. One of 11 supported operators (FR-002). |
| `value` | `String?` | The comparison value. Nullable — `IS_NULL` operator requires no value. Always stored as string; type coercion is handled at query time by the connector. Date values are expected in ISO 8601 format (YYYY-MM-DD). |
| `isActive` | `Boolean` | When false, the filter is ignored at query time (toggle on/off without deleting). |

## Relationships

```
ObjectMapping (1) ──► (N) MigrationFilter    (cascade delete)
```

**Note**: MigrationFilter has no children. It is a leaf entity belonging to ObjectMapping. When an object mapping is deleted (011 FR-011), all its filters are cascade-deleted automatically.

## Constraints

- No uniqueness constraint on `(objectMappingId, fieldApiName, operator, value)` — the same filter can technically be added twice (the spec does not explicitly forbid duplicates, but the UI should prevent it with a client-side check).
- `value` is nullable. `IS_NULL` operator requires `value = null`. Other operators store the value as a plain string; type coercion is handled at the connector query layer.
- There is no limit on the number of filters per object mapping (edge case: "20+ filters supported without limit").
- No `@@index` directive on `objectMappingId` in the implemented schema (index implicitly created via the FK constraint by PostgreSQL).

## Indexes

- No explicit `@@index` in the implemented Prisma schema. The FK on `objectMappingId` generates an implicit index for filter listing and estimation queries.

## Integration Points

### ObjectMapping relation update

The ObjectMapping model (defined in 011) carries the reverse relation as `filters`:

```prisma
model ObjectMapping {
  // ... existing fields ...
  filters MigrationFilter[]
}
```

### 011 Object Detail Modal (A3)

The "migration filter count" section in the object detail modal (011 FR-008) is derived from `MigrationFilter.count({ where: { objectMappingId } })`. Feature 011 owns the UI rendering; this feature provides the data.
