# Data Model: Object Mapping

## Prisma Schema Additions

```prisma
model ObjectMapping {
  id                    String   @id @default(uuid())
  migrationPlanId       String
  sourceObjectName      String
  destinationObjectName String
  autoCreated           Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  migrationPlan         MigrationPlan    @relation(fields: [migrationPlanId], references: [id], onDelete: Cascade)
  fieldMappings         FieldMapping[]
  migrationFilters      MigrationFilter[]
  fieldExclusions       FieldExclusion[]

  @@unique([migrationPlanId, sourceObjectName, destinationObjectName])
  @@index([migrationPlanId])
}
```

## Entity Relationships

```
MigrationPlan (1) ──► (N) ObjectMapping
ObjectMapping (1) ──► (N) FieldMapping      [012]
ObjectMapping (1) ──► (N) MigrationFilter   [015]
ObjectMapping (1) ──► (N) FieldExclusion    [016]
```

## Key Constraints

- **Unique per plan**: A given (sourceObjectName, destinationObjectName) pair can only exist once per MigrationPlan. Enforced by `@@unique`.
- **Fan-out allowed**: The same sourceObjectName can appear in multiple ObjectMappings (with different destinationObjectNames).
- **Fan-in allowed**: The same destinationObjectName can appear in multiple ObjectMappings (with different sourceObjectNames). Flagged with a UI warning but not prevented.
- **Cascade safety net**: `onDelete: Cascade` on the MigrationPlan relation ensures orphan cleanup if the plan is deleted. Service-level cascade is the primary deletion path for individual ObjectMappings (for audit trail logging).

## Notes

- `sourceObjectName` and `destinationObjectName` store the object's apiName from the connector schema, not internal IDs. This decouples mapping from schema snapshot versions.
- `autoCreated` is a flag for UI display purposes (e.g., showing an "auto" badge). It does not affect behavior -- auto-created and manual links are treated identically for deletion.
