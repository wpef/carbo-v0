# Data Model: Source Schema Retrieval

## Prisma Schema

```prisma
model SchemaSnapshot {
  id            String   @id @default(cuid())
  connectionId  String
  status        String   @default("CURRENT")   // CURRENT | PREVIOUS
  objectCount   Int      @default(0)
  retrievedAt   DateTime @default(now())
  createdAt     DateTime @default(now())

  connection    SourceConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  objects       SchemaObject[]

  @@index([connectionId, status])
}

model SchemaObject {
  id          String  @id @default(cuid())
  snapshotId  String
  apiName     String
  label       String
  description String  @default("")
  isCustom    Boolean @default(false)

  snapshot    SchemaSnapshot    @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  selections  ObjectSelection[]
  fields      ObjectField[]

  @@unique([snapshotId, apiName])
  @@index([snapshotId])
}
```

## Relationships

- `SourceConnection` 1:N `SchemaSnapshot` (max 2 per connection via application logic)
- `SchemaSnapshot` 1:N `SchemaObject`
- `SchemaObject` 1:N `ObjectSelection` (created by 004)
- `SchemaObject` 1:N `ObjectField` (created by 005)

## Notes

- `@@unique([snapshotId, apiName])` prevents duplicate objects within the same snapshot.
- `@@index([connectionId, status])` enables fast lookup of CURRENT snapshot for a connection.
- `onDelete: Cascade` ensures deleting a connection removes all snapshots, and deleting a snapshot removes all its objects.
- `objectCount` is denormalized for quick display without counting related objects.

## Diff Type (TypeScript, not persisted)

```typescript
interface SchemaDiff {
  added: SchemaObject[]
  removed: SchemaObject[]
  modified: { current: SchemaObject; previous: SchemaObject; changes: string[] }[]
  unchanged: number
}
```
