# Data Model: Source Schema Retrieval

## Prisma Models

### SchemaSnapshot (FR-003, FR-004)

```prisma
model SchemaSnapshot {
  id           String         @id @default(uuid())
  connectionId String
  side         SnapshotSide                        // SOURCE or DESTINATION (typed enum, not a string)
  status       SnapshotStatus @default(CURRENT)    // CURRENT or PREVIOUS (typed enum)
  fetchedAt    DateTime       @default(now())

  // Relations
  connection   ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  objects      SchemaObject[]

  @@unique([connectionId, side, status])           // at most one CURRENT and one PREVIOUS per connection+side
}

enum SnapshotSide {
  SOURCE
  DESTINATION
}

enum SnapshotStatus {
  CURRENT
  PREVIOUS
}
```

> `objectCount` is NOT stored — it is derived at query time from the `objects` relation count.
> `retrievedAt` is named `fetchedAt` in the implementation.
> `role` was renamed to `side` (typed `SnapshotSide` enum). The unique constraint now includes `side` so both SOURCE and DESTINATION can coexist per connection.

### SchemaObject (FR-001, FR-002)

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
  fields      ObjectField[]  // Populated by feature 005

  @@unique([snapshotId, apiName])   // No duplicate objects within a snapshot
}
```

> `isCustom` defaults to `false`. No `isSelected` field — object selection is a separate `ObjectSelection` table (feature 004, not a column on `SchemaObject`).

### ObjectField (defined in 005, referenced here for completeness)

```prisma
model ObjectField {
  id               String  @id @default(uuid())
  objectId         String
  snapshotId       String
  apiName          String
  label            String
  dataType         String
  isRequired       Boolean @default(false)
  isReadOnly       Boolean @default(false)
  isUnique         Boolean @default(false)
  isAccessible     Boolean @default(true)
  referenceTo      String?
  relationshipType String?                    // "lookup" | "master-detail" | "external"
  picklistValues   String?                    // JSON array — consumed by 013 D1 value-equivalence

  // Relations
  object   SchemaObject @relation(fields: [objectId], references: [id], onDelete: Cascade)

  @@unique([objectId, apiName])
}
```

> `ObjectField` has a single parent relation through `SchemaObject` (via `objectId`). The `snapshotId` is stored for query efficiency but there is no separate Prisma relation to `SchemaSnapshot` on `ObjectField` — cascade comes from `SchemaObject`.

## TypeScript Types (in-memory, not persisted)

### DriftModificationType (FR-013 — canonical taxonomy)

```typescript
// src/features/003-source-schema-retrieval/types/drift.ts

export const DRIFT_MODIFICATION_TYPES = {
  OBJECT_ADDED:           { severity: 'info' },
  OBJECT_REMOVED:         { severity: 'critical' },
  FIELD_ADDED:            { severity: 'info' },
  FIELD_REMOVED:          { severity: 'critical' },
  FIELD_TYPE_CHANGED:     { severity: 'critical' },  // default; downgraded to 'info' if compatible
  FIELD_BECAME_REQUIRED:  { severity: 'warning' },
  FIELD_BECAME_OPTIONAL:  { severity: 'info' },
  FIELD_LABEL_CHANGED:    { severity: 'info' },
  PICKLIST_VALUE_ADDED:   { severity: 'warning' },   // if D1 equivalence exists
  PICKLIST_VALUE_REMOVED: { severity: 'warning' },   // if D1 equivalence exists
  FIELD_READONLY_CHANGED: { severity: 'warning' },
  FIELD_UNIQUE_CHANGED:   { severity: 'warning' },
} as const

export type DriftModificationType = keyof typeof DRIFT_MODIFICATION_TYPES
export type DriftSeverity = 'info' | 'warning' | 'critical'
```

### DriftChange (FR-013)

```typescript
export interface DriftChange {
  type: DriftModificationType
  objectApiName: string
  fieldApiName?: string         // absent for object-level changes
  before?: unknown
  after?: unknown
  severity: DriftSeverity
  affectsMapping: boolean       // true if an existing ObjectMapping/FieldMapping references this
}
```

### DriftReport (FR-012, FR-015)

```typescript
export interface DriftReport {
  connectionId: string
  side: 'source' | 'destination'   // matches SnapshotSide enum (renamed from 'role')
  checkedAt: string                 // ISO 8601
  status: 'ok' | 'drift' | 'unavailable'
  changes: DriftChange[]
  severitySummary: {
    critical: number
    warning: number
    info: number
  }
  reason?: string                   // populated when status='unavailable'
}
```

## Relationships

```
ConnectorConnection (1) ──► (0..4) SchemaSnapshot  [CURRENT + PREVIOUS, per side SOURCE/DESTINATION]
SchemaSnapshot      (1) ──► (N)    SchemaObject
SchemaObject        (1) ──► (N)    ObjectField     [populated by 005]

DriftReport (in-memory) references:
  - SchemaSnapshot (CURRENT, matching side) for stored state
  - ConnectorAdapter.getSchema() for live state
  - ObjectMapping / FieldMapping for affectsMapping flag
```

## Cascade Behavior

| Parent deleted | Child behavior |
|---|---|
| ConnectorConnection | All SchemaSnapshots cascade-deleted |
| SchemaSnapshot | All SchemaObjects cascade-deleted |
| SchemaObject | All ObjectFields cascade-deleted |
