# Data Model: Source Field Retrieval

## Prisma Schema Additions

### ObjectField (FR-002, FR-003, FR-004, FR-005)

```prisma
model ObjectField {
  id               String   @id @default(cuid())
  objectId         String
  snapshotId       String
  apiName          String
  label            String
  dataType         String          // System-specific type, preserved as-is (e.g., "string", "reference", "picklist")
  isRequired       Boolean  @default(false)
  isReadOnly       Boolean  @default(false)
  isUnique         Boolean  @default(false)
  isAccessible     Boolean  @default(true)   // FR-004: false for field-level security restricted fields
  referenceTo      String?                   // FR-003: target object apiName for relationships
  relationshipType String?                   // FR-003: "lookup" | "master-detail" | "external"
  createdAt        DateTime @default(now())

  // Relations
  object           SchemaObject @relation(fields: [objectId], references: [id], onDelete: Cascade)
  snapshot         SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@unique([objectId, apiName])              // One field per apiName per object
  @@index([snapshotId])
  @@index([objectId])
}
```

### SchemaObject (existing, from 003 — relation added)

```prisma
model SchemaObject {
  id          String   @id @default(cuid())
  snapshotId  String
  apiName     String
  label       String
  description String?
  isCustom    Boolean  @default(false)
  isSelected  Boolean  @default(false)      // From 004

  // Relations
  snapshot    SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  fields      ObjectField[]                 // NEW: added by 005

  @@unique([snapshotId, apiName])
  @@index([snapshotId])
}
```

### SchemaSnapshot (existing, from 003 — relation added)

```prisma
model SchemaSnapshot {
  id           String   @id @default(cuid())
  connectionId String
  status       String                       // "CURRENT" | "PREVIOUS"
  retrievedAt  DateTime @default(now())
  objectCount  Int      @default(0)

  // Relations
  connection   ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  objects      SchemaObject[]
  fields       ObjectField[]                // NEW: added by 005 (direct access for queries)

  @@index([connectionId, status])
}
```

## Relationships

```
SchemaSnapshot (1) ──► (N) SchemaObject ──► (N) ObjectField
                  └──────────────────────────► (N) ObjectField (denormalized snapshotId for direct queries)
```

- `ObjectField.objectId` → `SchemaObject.id` (cascade delete: removing an object removes its fields)
- `ObjectField.snapshotId` → `SchemaSnapshot.id` (cascade delete: removing a snapshot removes all fields)
- `@@unique([objectId, apiName])` ensures no duplicate fields per object

## Type Mapping: ConnectorField → ObjectField

```typescript
// ConnectorField (from 000, in-memory) → ObjectField (Prisma, persisted)
function toObjectFieldData(
  connectorField: ConnectorField,
  objectId: string,
  snapshotId: string
): Prisma.ObjectFieldCreateInput {
  return {
    objectId,
    snapshotId,
    apiName: connectorField.apiName,
    label: connectorField.label || connectorField.apiName,  // Edge case: no label → use apiName
    dataType: connectorField.dataType,
    isRequired: connectorField.isRequired,
    isReadOnly: connectorField.isReadOnly,
    isUnique: connectorField.isUnique,
    isAccessible: connectorField.isAccessible ?? true,      // Defaults to true if not provided
    referenceTo: connectorField.referenceTo ?? null,
    relationshipType: connectorField.relationshipType ?? null,
  }
}
```

## Notes

- The `snapshotId` on `ObjectField` is technically redundant (derivable via `object.snapshotId`) but is included for query efficiency: listing all fields in a snapshot without joining through `SchemaObject`.
- `dataType` is a plain string, not an enum — preserves system-specific types (see research.md, Decision 5).
- `isAccessible` is not part of the original `ConnectorField` interface (000). It is added as an optional field (`isAccessible?: boolean`) on the connector type and defaults to `true` at the persistence layer.
