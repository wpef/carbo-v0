# Data Model: Source Field Retrieval

## Prisma Schema

```prisma
model ObjectField {
  id               String   @id @default(cuid())
  objectId         String                          // References SchemaObject.id
  snapshotId       String                          // Denormalized for efficient queries
  apiName          String
  label            String
  dataType         String                          // String representation from adapter (e.g., "string", "picklist", "lookup")
  isRequired       Boolean  @default(false)
  isReadOnly       Boolean  @default(false)
  isUnique         Boolean  @default(false)
  isAccessible     Boolean  @default(true)         // False if blocked by field-level security
  referenceTo      String?                         // API name of referenced object (for relationships)
  relationshipType String?                         // "Lookup", "MasterDetail", etc.
  createdAt        DateTime @default(now())

  object           SchemaObject @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@unique([objectId, apiName])
  @@index([objectId])
  @@index([snapshotId])
}
```

## Relationships

- `SchemaObject` 1:N `ObjectField` (an object has many fields)
- Cascade delete: deleting a SchemaObject removes all its fields

## Notes

- `@@unique([objectId, apiName])` prevents duplicate fields within the same object.
- `snapshotId` is denormalized from `SchemaObject.snapshotId` for efficient queries like "get all fields for this snapshot" without joining through SchemaObject.
- `dataType` is a free-form string, not an enum. Preserves system-specific types (e.g., Salesforce "reference", "currency", "multipicklist").
- `referenceTo` and `relationshipType` are nullable. Only populated for relationship fields.
- `isAccessible` defaults to true. Set to false when the adapter reports a field-level security restriction.

## TypeScript Types

```typescript
// Retrieval result for a single object
interface ObjectFieldResult {
  objectApiName: string
  objectId: string
  status: "success" | "error"
  fieldCount: number
  error?: string
}

// Batch retrieval result
interface FieldRetrievalResult {
  succeeded: ObjectFieldResult[]
  failed: ObjectFieldResult[]
  totalFields: number
  duration: number  // milliseconds
}
```
