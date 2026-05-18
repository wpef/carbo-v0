# Data Model: Source Schema Retrieval

## Prisma Models

### SchemaSnapshot (FR-003, FR-004)

```prisma
model SchemaSnapshot {
  id            String   @id @default(cuid())
  connectionId  String
  role          String   // "source" | "destination" — shared table for both sides
  status        String   // "CURRENT" | "PREVIOUS"
  objectCount   Int
  retrievedAt   DateTime @default(now())

  // Relations
  connection    ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  objects       SchemaObject[]

  @@unique([connectionId, status])   // At most one CURRENT and one PREVIOUS per connection
  @@index([connectionId])
}
```

### SchemaObject (FR-001, FR-002)

```prisma
model SchemaObject {
  id          String   @id @default(cuid())
  snapshotId  String
  apiName     String
  label       String
  description String?
  isCustom    Boolean

  // Relations
  snapshot    SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  fields      ObjectField[]  // Populated by feature 005

  @@unique([snapshotId, apiName])   // No duplicate objects within a snapshot
  @@index([snapshotId])
}
```

### ObjectField (defined in 005, referenced here for completeness)

```prisma
model ObjectField {
  id                String   @id @default(cuid())
  objectId          String
  snapshotId        String
  apiName           String
  label             String
  dataType          String
  isRequired        Boolean
  isReadOnly        Boolean
  isUnique          Boolean
  isAccessible      Boolean  @default(true)
  referenceTo       String?
  relationshipType  String?  // "lookup" | "master-detail" | "external"

  // Relations
  object    SchemaObject   @relation(fields: [objectId], references: [id], onDelete: Cascade)
  snapshot  SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@unique([objectId, apiName])
  @@index([objectId])
  @@index([snapshotId])
}
```

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
  role: 'source' | 'destination'
  checkedAt: string             // ISO 8601
  status: 'ok' | 'drift' | 'unavailable'
  changes: DriftChange[]
  severitySummary: {
    critical: number
    warning: number
    info: number
  }
  reason?: string               // populated when status='unavailable'
}
```

## Relationships

```
ConnectorConnection (1) ──► (0..2) SchemaSnapshot  [CURRENT + PREVIOUS]
SchemaSnapshot      (1) ──► (N)    SchemaObject
SchemaObject        (1) ──► (N)    ObjectField     [populated by 005]

DriftReport (in-memory) references:
  - SchemaSnapshot (CURRENT) for stored state
  - ConnectorAdapter.getSchema() for live state
  - ObjectMapping / FieldMapping for affectsMapping flag
```

## Cascade Behavior

| Parent deleted | Child behavior |
|---|---|
| ConnectorConnection | All SchemaSnapshots cascade-deleted |
| SchemaSnapshot | All SchemaObjects cascade-deleted |
| SchemaObject | All ObjectFields cascade-deleted |
