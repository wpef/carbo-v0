# Data Model: Source Field Retrieval

## Prisma Schema Additions

### ObjectField (FR-002, FR-003, FR-004, FR-005)

```prisma
model ObjectField {
  id               String  @id @default(uuid())
  objectId         String
  snapshotId       String                     // denormalized for query efficiency (derived from object.snapshotId)
  apiName          String
  label            String
  dataType         String                     // system-specific type, preserved as-is (e.g., "string", "reference", "picklist")
  isRequired       Boolean @default(false)
  isReadOnly       Boolean @default(false)
  isUnique         Boolean @default(false)
  isAccessible     Boolean @default(true)     // FR-004: false for field-level security restricted fields
  referenceTo      String?                    // FR-003: target object apiName for relationships
  relationshipType String?                    // FR-003: "lookup" | "master-detail" | "external"
  picklistValues   String?                    // JSON array of picklist values; consumed by 013 D1 value-equivalence

  // Relations
  object   SchemaObject @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@unique([objectId, apiName])               // one field per apiName per object
}
```

> `createdAt` is NOT stored on `ObjectField` — fields are recreated wholesale on each retrieval (upsert pattern). The `snapshot` relation to `SchemaSnapshot` is intentionally omitted: cascade comes from `SchemaObject`; `snapshotId` is a plain denormalised column only.

### SchemaObject (existing, from 003 — referenced for context)

```prisma
model SchemaObject {
  id          String  @id @default(uuid())
  snapshotId  String
  apiName     String
  label       String
  description String?
  isCustom    Boolean @default(false)

  // Relations
  snapshot    SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  fields      ObjectField[]  // populated by this feature (005)

  @@unique([snapshotId, apiName])
}
```

> `isSelected` is NOT a column on `SchemaObject`. Object selection is tracked in the separate `ObjectSelection` table (feature 004). No `@@index` directives — the `@@unique` constraint already covers the primary lookup patterns.

### ObjectSelection (feature 004 — separate table, not a column on SchemaObject)

```prisma
model ObjectSelection {
  id            String  @id @default(uuid())
  connectionId  String
  snapshotId    String
  objectApiName String
  isSelected    Boolean @default(true)

  @@unique([connectionId, snapshotId, objectApiName])
}
```

> This is the source of truth for which objects are selected. The POST field-retrieval route reads `ObjectSelection` rows (not a hypothetical `SchemaObject.isSelected` column) to determine which objects to describe.

### SchemaSnapshot (existing, from 003 — referenced for context)

```prisma
model SchemaSnapshot {
  id           String         @id @default(uuid())
  connectionId String
  side         SnapshotSide
  status       SnapshotStatus @default(CURRENT)
  fetchedAt    DateTime       @default(now())

  connection   ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  objects      SchemaObject[]

  @@unique([connectionId, side, status])
}
```

> No direct `fields ObjectField[]` relation on `SchemaSnapshot` — fields are reached via `snapshot.objects[n].fields`. `objectCount` and `retrievedAt` are not stored columns; use `_count.objects` and `fetchedAt` respectively.

## Relationships

```
SchemaSnapshot (1) ──► (N) SchemaObject ──► (N) ObjectField
```

- `ObjectField.objectId` → `SchemaObject.id` (cascade delete: removing an object removes its fields)
- `ObjectField.snapshotId` is a denormalized column for efficient snapshot-scoped queries; there is no Prisma relation from `ObjectField` to `SchemaSnapshot`
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
    picklistValues: connectorField.picklistValues           // JSON-serialized string array, or null
      ? JSON.stringify(connectorField.picklistValues)
      : null,
  }
}
```

## Notes

- The `snapshotId` on `ObjectField` is technically redundant (derivable via `object.snapshotId`) but is included for query efficiency: listing all fields in a snapshot without joining through `SchemaObject`.
- `dataType` is a plain string, not an enum — preserves system-specific types (see research.md, Decision 5).
- `isAccessible` is not part of the original `ConnectorField` interface (000). It is added as an optional field (`isAccessible?: boolean`) on the connector type and defaults to `true` at the persistence layer.
