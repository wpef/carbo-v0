# Data Model: Destination Schema Retrieval

## Shared Prisma Models

Destination schema reuses the same models as source (003). The `side` discriminator on `SchemaSnapshot` distinguishes source from destination. No new tables are introduced.

### SchemaSnapshot (shared with 003)

```prisma
model SchemaSnapshot {
  id            String         @id @default(cuid())
  connectionId  String
  side          String         // 'source' | 'destination'
  status        String         // 'CURRENT' | 'PREVIOUS'
  retrievedAt   DateTime       @default(now())
  objectCount   Int
  objects       SchemaObject[]
  connection    ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@unique([connectionId, side, status])
  @@index([connectionId, side])
}
```

The unique constraint `[connectionId, side, status]` ensures at most one CURRENT and one PREVIOUS snapshot per connection per side.

### SchemaObject (shared with 003)

```prisma
model SchemaObject {
  id          String        @id @default(cuid())
  snapshotId  String
  apiName     String
  label       String
  description String?
  isCustom    Boolean
  isSelected  Boolean       @default(true)   // Always true for destination
  fields      ObjectField[]
  snapshot    SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@unique([snapshotId, apiName])
}
```

For destination, `isSelected` is always `true` (no selection step).

### ObjectField (shared with 005/008)

```prisma
model ObjectField {
  id               String       @id @default(cuid())
  objectId         String
  snapshotId       String
  apiName          String
  label            String
  dataType         String
  isRequired       Boolean
  isReadOnly       Boolean
  isUnique         Boolean
  isAccessible     Boolean      @default(true)
  referenceTo      String?
  relationshipType String?      // 'lookup' | 'master-detail' | 'external'
  picklistValues   Json?        // string[] for picklist fields
  object           SchemaObject @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@unique([objectId, apiName])
}
```

## In-Memory Types (not persisted)

### DriftReport (defined in 003, reused here)

```typescript
// src/lib/types/drift.ts — single source of truth from spec 003

interface DriftReport {
  connectionId: string
  role: 'source' | 'destination'
  checkedAt: Date
  status: 'ok' | 'drift' | 'unavailable'
  changes: DriftChange[]
  severitySummary: { critical: number; warning: number; info: number }
  reason?: string  // when status='unavailable'
}

interface DriftChange {
  type: DriftTypeId
  objectApiName: string
  fieldApiName?: string
  before?: unknown
  after?: unknown
  severity: 'info' | 'warning' | 'critical'
  affectsMapping: boolean
}

type DriftTypeId =
  | 'OBJECT_ADDED'
  | 'OBJECT_REMOVED'
  | 'FIELD_ADDED'
  | 'FIELD_REMOVED'
  | 'FIELD_TYPE_CHANGED'
  | 'FIELD_BECAME_REQUIRED'
  | 'FIELD_BECAME_OPTIONAL'
  | 'FIELD_LABEL_CHANGED'
  | 'PICKLIST_VALUE_ADDED'
  | 'PICKLIST_VALUE_REMOVED'
  | 'FIELD_READONLY_CHANGED'
  | 'FIELD_UNIQUE_CHANGED'
```

### Destination Severity Overrides

Applied as a post-processing step by `destination-drift.ts`:

| DriftTypeId | Default severity | Destination override | Condition |
|---|---|---|---|
| `FIELD_BECAME_REQUIRED` | warning | warning (confirmed) | Always on destination |
| `FIELD_READONLY_CHANGED` | warning | warning | Only when `after.isReadOnly === true` |
| `FIELD_UNIQUE_CHANGED` | warning | warning | Only when `after.isUnique === true` |

These overrides do not change the canonical severity values (they are already `warning` in the 003 taxonomy), but the destination drift wrapper ensures they are never downgraded and adds contextual metadata (e.g., `"write will fail"` message) for the banner.

## Relationships

```
MigrationPlan (1) --> (0..1) ConnectorConnection [destinationConnectionId]
ConnectorConnection (1) --> (0..2) SchemaSnapshot [side='destination', status IN ('CURRENT','PREVIOUS')]
SchemaSnapshot (1) --> (N) SchemaObject
SchemaObject (1) --> (N) ObjectField
```

## Snapshot Rotation Logic

```
On refresh:
  1. DELETE snapshot WHERE connectionId=? AND side='destination' AND status='PREVIOUS'
  2. UPDATE snapshot SET status='PREVIOUS' WHERE connectionId=? AND side='destination' AND status='CURRENT'
  3. INSERT new snapshot with status='CURRENT'
  4. INSERT all objects + fields for new snapshot
  Steps 1-4 in a single Prisma transaction
```
