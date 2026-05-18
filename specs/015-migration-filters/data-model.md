# Data Model: Migration Filters

## Prisma Schema

### MigrationFilter (FR-001, FR-002, FR-003)

```prisma
enum FilterOperator {
  EQUALS
  NOT_EQUALS
  CONTAINS
  STARTS_WITH
  ENDS_WITH
  GREATER_THAN
  LESS_THAN
  DATE_AFTER
  DATE_BEFORE
}

model MigrationFilter {
  id              String          @id @default(cuid())
  objectMappingId String
  objectMapping   ObjectMapping   @relation(fields: [objectMappingId], references: [id], onDelete: Cascade)

  sourceFieldName String
  operator        FilterOperator
  value           String

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([objectMappingId])
  @@map("migration_filters")
}
```

### Connector Interface Extension (FilterCondition type)

```typescript
// Added to src/lib/types/connector.ts

interface FilterCondition {
  fieldName: string
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GREATER_THAN' | 'LESS_THAN' | 'DATE_AFTER' | 'DATE_BEFORE'
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
| `id` | `String (cuid)` | Unique identifier. |
| `objectMappingId` | `String` | FK to the parent ObjectMapping. Cascade-deleted when the object mapping is removed. |
| `sourceFieldName` | `String` | The API name of the source field this filter applies to. Must exist in the source object's schema (FR-005). |
| `operator` | `FilterOperator` | The comparison operator. One of 9 supported operators (FR-002). |
| `value` | `String` | The comparison value. Always stored as string; type coercion is handled at query time by the connector. Date values are expected in ISO 8601 format (YYYY-MM-DD). |
| `createdAt` | `DateTime` | Record creation timestamp. |
| `updatedAt` | `DateTime` | Last modification timestamp. Auto-managed by Prisma. |

## Relationships

```
ObjectMapping (1) ──► (N) MigrationFilter    (cascade delete)
```

**Note**: MigrationFilter has no children. It is a leaf entity belonging to ObjectMapping. When an object mapping is deleted (011 FR-011), all its filters are cascade-deleted automatically.

## Constraints

- No uniqueness constraint on `(objectMappingId, sourceFieldName, operator, value)` -- the same filter can technically be added twice (the spec does not explicitly forbid duplicates, but the UI should prevent it with a client-side check).
- `value` is stored as a plain string. Special characters (quotes, backslashes) are stored as-is -- escaping is handled at the connector query layer, not at storage time (edge case from spec).
- There is no limit on the number of filters per object mapping (edge case: "20+ filters supported without limit").

## Indexes

- `MigrationFilter.objectMappingId` -- query all filters for an object mapping (used by both the filter panel and the estimation endpoint).

## Integration Points

### ObjectMapping relation update

The ObjectMapping model (defined in 011) needs to add the reverse relation:

```prisma
model ObjectMapping {
  // ... existing fields ...
  migrationFilters  MigrationFilter[]
}
```

### 011 Object Detail Modal (A3)

The "migration filter count" section in the object detail modal (011 FR-008) is derived from `MigrationFilter.count({ where: { objectMappingId } })`. Feature 011 owns the UI rendering; this feature provides the data.
