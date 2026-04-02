# Data Model: Source Connection

## Prisma Schema

```prisma
model SourceConnection {
  id            String   @id @default(cuid())
  planId        String   @unique
  adapterType   String                          // "salesforce" | "hubspot" | "demo"
  status        String   @default("PENDING")    // PENDING | CONNECTED | EXPIRED | ERROR
  config        String   @default("{}")         // JSON blob: adapter-specific config (encrypted at rest)
  connectedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  plan              MigrationPlan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  schemaSnapshots   SchemaSnapshot[]
}
```

## Relationships

- `MigrationPlan` 1:0..1 `SourceConnection` (a plan has at most one source connection)
- `SourceConnection` 1:N `SchemaSnapshot` (created by 003, cascade-deleted on disconnect)

## Notes

- `planId` is `@unique` because a plan has exactly one source connection.
- `config` stores adapter-specific credentials as a JSON string. For demo adapter, this is `{}`.
- `status` uses string enum values matching ConnectorConnection.status from 000-connector-interface.
- `onDelete: Cascade` on the plan relation ensures deleting a plan removes the connection.
- Schema snapshots, object selections, and field metadata are cascade-deleted through the snapshot chain (003 -> 004 -> 005).
