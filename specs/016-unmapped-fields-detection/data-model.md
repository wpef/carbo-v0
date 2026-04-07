# Data Model: Unmapped Fields Detection

## Prisma Schema Additions

```prisma
model FieldExclusion {
  id                String   @id @default(uuid())
  objectMappingId   String
  sourceFieldName   String
  reason            String?
  createdAt         DateTime @default(now())

  objectMapping     ObjectMapping @relation(fields: [objectMappingId], references: [id], onDelete: Cascade)

  @@unique([objectMappingId, sourceFieldName])
  @@index([objectMappingId])
}
```

## Entity Relationships

```
ObjectMapping (1) ──► (N) FieldExclusion
```

## Key Constraints

- **Unique per ObjectMapping**: Each source field can be excluded at most once per ObjectMapping. Enforced by `@@unique([objectMappingId, sourceFieldName])`.
- **Optional reason**: The consultant can provide a reason for exclusion (e.g., "System field, not relevant to migration"). Optional for speed but recommended for audit trail quality.
- **No updatedAt**: Exclusions are created or deleted, never updated. The reason is set at creation time.

## Computed Data (Not Stored)

The following are computed in real-time by UnmappedFieldsService, not stored in DB:

- **Unmapped source fields**: `allSourceFields - mappedSourceFields - excludedSourceFields`
- **Unmapped required destination properties**: `allRequiredDestFields - mappedDestFields`
- **Fields to validate count**: `len(unmappedSourceFields)` (used by Object Detail Modal, 011)

## Notes

- The FieldExclusion table is lightweight (only tracks the exclusion decision). The field metadata (name, type, etc.) comes from the schema snapshot and is resolved at render time.
- Cascade deletion: deleting an ObjectMapping cascades to all its FieldExclusions.
- If a FieldMapping is created for a previously excluded field, the FieldExclusion row is deleted by the FieldMappingService (012) at creation time.
