# Data Model: Migration Filters

## Prisma Schema Additions

```prisma
model MigrationFilter {
  id                String   @id @default(uuid())
  objectMappingId   String
  sourceFieldName   String
  operator          String   // EQUALS | NOT_EQUALS | CONTAINS | STARTS_WITH | ENDS_WITH | GREATER_THAN | LESS_THAN | DATE_AFTER | DATE_BEFORE
  value             String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  objectMapping     ObjectMapping @relation(fields: [objectMappingId], references: [id], onDelete: Cascade)

  @@index([objectMappingId])
}
```

## Entity Relationships

```
ObjectMapping (1) ──► (N) MigrationFilter
```

## Key Constraints

- **No limit**: An ObjectMapping can have any number of filters (spec says 20+ supported).
- **No uniqueness constraint on (objectMappingId, sourceFieldName, operator)**: The same field can have multiple filters (e.g., "CreatedDate DATE_AFTER 2020-01-01" AND "CreatedDate DATE_BEFORE 2025-01-01").
- **Value is always a string**: The filter value is stored as a string regardless of field type. Type coercion is the responsibility of the connector at execution time. Dates are stored as ISO 8601 strings (YYYY-MM-DD).

## Notes

- Cascade deletion: deleting an ObjectMapping (011) cascades to all its MigrationFilters.
- The `sourceFieldName` references a field from the source schema snapshot. If that field is later deleted during a schema refresh, the integrity check (017) will flag this filter as broken.
- Filters apply to source records only. There is no destination filter concept.
