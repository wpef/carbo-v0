# Data Model: Field Mapping

## Prisma Schema Additions

```prisma
model FieldMapping {
  id                    String   @id @default(uuid())
  objectMappingId       String
  sourceFieldName       String
  destinationFieldName  String
  sourceFieldType       String
  destinationFieldType  String
  compatibilityStatus   String   @default("COMPATIBLE")  // COMPATIBLE | WARNING | INCOMPATIBLE
  autoCreated           Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  objectMapping         ObjectMapping   @relation(fields: [objectMappingId], references: [id], onDelete: Cascade)
  migrationLogic        MigrationLogic?

  @@unique([objectMappingId, sourceFieldName])
  @@unique([objectMappingId, destinationFieldName])
  @@index([objectMappingId])
}
```

## Entity Relationships

```
ObjectMapping (1) ──► (N) FieldMapping
FieldMapping  (1) ──► (0..1) MigrationLogic  [013]
```

## Key Constraints

- **One-to-one per ObjectMapping**: Enforced by two unique indexes -- each source field maps to at most one destination, and each destination receives at most one source, within the same ObjectMapping.
- **Cross-ObjectMapping reuse**: The same sourceFieldName CAN appear in multiple ObjectMappings (e.g., "Email" in Contact-to-Contacts and Contact-to-Leads). The unique constraint is scoped to objectMappingId.
- **Type fields are stored**: `sourceFieldType` and `destinationFieldType` are stored at creation time (snapshot). Used for compatibility matrix lookup and integrity check (017) when types change.
- **compatibilityStatus**: Computed at creation time via the type compatibility matrix. Stored for efficient querying (avoids recomputing on every list render). Updated by integrity check (017) if types change.

## Notes

- `autoCreated` tracks whether the mapping was created by auto-matching (US3). Displayed as a badge in the UI. Does not affect deletion behavior.
- The `migrationLogic` relation is optional (0..1). A FieldMapping can exist without migration logic (link status = RED_SOLID).
- Cascade: deleting a FieldMapping deletes its MigrationLogic. Deleting an ObjectMapping cascades to all FieldMappings.
