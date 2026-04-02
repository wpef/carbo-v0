# Data Model: Schema Write

## Prisma Entity

```prisma
model SchemaWriteOperation {
  id                  String   @id @default(cuid())
  connectionId        String
  operationType       String   // CREATE_OBJECT | CREATE_FIELD | MODIFY_FIELD
  targetObjectApiName String
  details             String   // JSON: { name, type, values?, description?, group? }
  result              String   // SUCCESS | ERROR
  errorMessage        String?
  createdAt           DateTime @default(now())

  // Relationships
  connection          Connection @relation(fields: [connectionId], references: [id])

  @@index([connectionId])
  @@index([createdAt])
}
```

## Notes

- `operationType` is a string enum: `CREATE_OBJECT`, `CREATE_FIELD`, `MODIFY_FIELD`.
- `details` stores a JSON string with the operation specifics. Structure depends on `operationType`:
  - `CREATE_FIELD`: `{ name, type, picklistValues?, description?, group? }`
  - `MODIFY_FIELD`: `{ name?, type?, picklistValues?, description?, group? }` (only changed fields)
  - `CREATE_OBJECT`: `{ name, primaryPropertyName, primaryPropertyType }`
- `result` is either `SUCCESS` or `ERROR`.
- `errorMessage` is null on success, contains the error details on failure.
- This entity serves as the **audit trail** for all schema modifications (Principle VI).
- No relationship to MappingPlan directly -- the plan context is inferred via the connection.
