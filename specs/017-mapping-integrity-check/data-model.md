# Data Model: Mapping Integrity Check

## Prisma Schema Additions

```prisma
model IntegrityIssue {
  id                String    @id @default(uuid())
  migrationPlanId   String
  entityType        String    // OBJECT_MAPPING | FIELD_MAPPING | MIGRATION_FILTER
  entityId          String
  issueType         String    // SOURCE_OBJECT_DELETED | DESTINATION_OBJECT_DELETED | SOURCE_FIELD_DELETED | DESTINATION_FIELD_DELETED | TYPE_CHANGE_INCOMPATIBLE | REFERENCED_FIELD_DELETED
  description       String
  detectedAt        DateTime  @default(now())
  resolvedAt        DateTime?

  migrationPlan     MigrationPlan @relation(fields: [migrationPlanId], references: [id], onDelete: Cascade)

  @@unique([entityType, entityId, issueType])
  @@index([migrationPlanId])
  @@index([entityId])
}
```

## Entity Relationships

```
MigrationPlan (1) ──► (N) IntegrityIssue
```

## Key Constraints

- **Unique per entity + issue type**: `@@unique([entityType, entityId, issueType])` prevents duplicate issues for the same entity and issue type. A single FieldMapping can have multiple issues (e.g., both SOURCE_FIELD_DELETED and TYPE_CHANGE_INCOMPATIBLE after different refreshes -- though in practice a deleted field would supersede a type change).
- **Soft resolution**: `resolvedAt` is set when the issue is resolved (mapping removed or remapped). Resolved issues are kept for audit trail. Active issues are those where `resolvedAt IS NULL`.
- **entityId references**: `entityId` is a foreign key to ObjectMapping.id, FieldMapping.id, or MigrationFilter.id depending on `entityType`. Not enforced by Prisma (polymorphic reference), but validated by the service.

## Issue Types

| issueType | Applies to | Description |
|-----------|------------|-------------|
| SOURCE_OBJECT_DELETED | ObjectMapping | Source object no longer exists in schema |
| DESTINATION_OBJECT_DELETED | ObjectMapping | Destination object no longer exists in schema |
| SOURCE_FIELD_DELETED | FieldMapping | Source field no longer exists in source object |
| DESTINATION_FIELD_DELETED | FieldMapping | Destination field no longer exists in dest object |
| TYPE_CHANGE_INCOMPATIBLE | FieldMapping | Field type changed, breaking compatibility |
| REFERENCED_FIELD_DELETED | MigrationFilter | Filter references a deleted source field |

## Notes

- IntegrityIssues are created by the IntegrityCheckService and resolved either automatically (when the consultant fixes the mapping) or manually (on re-check).
- Cascade: deleting a MigrationPlan cascades to all its IntegrityIssues.
- The `description` field provides a human-readable explanation (e.g., "Source field 'CustomField__c' no longer exists in Contact schema") for display in the UI and audit trail.
