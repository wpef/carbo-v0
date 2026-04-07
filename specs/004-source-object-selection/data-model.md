# Data Model: Source Object Selection

## Prisma Schema

```prisma
model ObjectSelection {
  id            String   @id @default(cuid())
  snapshotId    String
  objectId      String                          // References SchemaObject.id
  objectApiName String                          // Denormalized for easy lookup
  isSelected    Boolean  @default(false)
  selectedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  snapshot      SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  object        SchemaObject   @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@unique([snapshotId, objectId])
  @@index([snapshotId, isSelected])
}
```

## Relationships

- `SchemaSnapshot` 1:N `ObjectSelection` (one selection set per snapshot)
- `SchemaObject` 1:1 `ObjectSelection` (each object has exactly one selection record per snapshot)

## Notes

- `@@unique([snapshotId, objectId])` prevents duplicate selection records.
- `@@index([snapshotId, isSelected])` enables efficient "get selected objects for snapshot" queries.
- `objectApiName` is denormalized from `SchemaObject.apiName` to simplify selection migration across snapshots (match by apiName when objectId changes).
- `selectedAt` records when the object was selected (null if never selected). Used for audit.
- `onDelete: Cascade` on both relations: deleting a snapshot or object removes the selection.

## Selection State Flow

```
Schema retrieved (003) 
  → initDefaultSelection() creates ObjectSelection rows
  → Custom objects + common business objects: isSelected=true
  → System/internal objects: isSelected=false

Consultant toggles selection (004)
  → PATCH updates isSelected + selectedAt

Schema refreshed (003 again)
  → migrateSelection(oldSnapshotId, newSnapshotId)
  → Matching apiNames: copy isSelected from old
  → New objects: apply defaults
  → Removed objects: delete old selections
```
