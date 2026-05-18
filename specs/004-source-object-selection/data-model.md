# Data Model: Source Object Selection

## Prisma Model

### ObjectSelection (FR-007)

```prisma
model ObjectSelection {
  id              String   @id @default(uuid())
  connectionId    String
  snapshotId      String
  objectApiName   String
  isSelected      Boolean  @default(false)
  selectedAt      DateTime?
  selectedBy      String?  // consultant identifier (future multi-user)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  connection      ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  snapshot        SchemaSnapshot      @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  // Constraints
  @@unique([connectionId, snapshotId, objectApiName])
  @@index([connectionId, snapshotId])
  @@map("object_selections")
}
```

**Notes**:
- Unique constraint on `(connectionId, snapshotId, objectApiName)` enables upsert on toggle.
- `onDelete: Cascade` on both relations: deleting a connection or snapshot cleans up selections automatically.
- `selectedAt` is set when `isSelected` transitions to `true`; null when `false`.
- `selectedBy` is nullable for now (single-consultant tenant); prepared for future multi-user.

## TypeScript Types

### ObjectSelectionRow (API response)

```typescript
/** A single object in the selection list, combining schema metadata + selection state */
interface ObjectSelectionRow {
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
  isSelected: boolean
  /** 'custom' | 'business' | 'system' — derived from isCustom + common business objects list */
  category: 'custom' | 'business' | 'system'
}
```

### ObjectExpandResult (FR-005)

```typescript
/** On-demand expand response for a single object */
interface ObjectExpandResult {
  objectApiName: string
  recordCount: number
  fields: ConnectorField[]
  sampleRecords: ConnectorRecord[]  // 3-5 records
}
```

### SelectionSummary (FR-009)

```typescript
interface SelectionSummary {
  selectedCount: number
  totalCount: number
  /** Count of selected objects that no longer exist in the current snapshot (orphaned) */
  orphanedCount: number
}
```

### SaveSelectionPayload (PUT body)

```typescript
interface SaveSelectionPayload {
  selections: Array<{
    objectApiName: string
    isSelected: boolean
  }>
}
```

### CommonBusinessObjectsConfig

```typescript
/** Per-connector-type list of common business object API names */
type CommonBusinessObjectsConfig = Record<string, string[]>

// Example:
const config: CommonBusinessObjectsConfig = {
  salesforce: ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event'],
  hubspot: ['contacts', 'companies', 'deals', 'tickets', 'line_items'],
  demo: ['Contact', 'Account', 'Deal'],
}
```

## Relationships

```
MigrationPlan (1) --> (0..1) ConnectorConnection (source)
ConnectorConnection (1) --> (N) SchemaSnapshot
SchemaSnapshot (1) --> (N) SchemaObject
SchemaSnapshot (1) --> (N) ObjectSelection
ConnectorConnection (1) --> (N) ObjectSelection

ObjectSelection.objectApiName references SchemaObject.apiName (logical, not FK)
```

## Selection Lifecycle

```
1. Schema snapshot created (003)
   └─> If first snapshot for this connection:
       └─> Compute defaults (isCustom + common business objects) -> bulk insert ObjectSelection rows
   └─> If replacing existing snapshot:
       └─> Migrate: copy selections from old snapshot for objects that still exist
       └─> Apply defaults for newly added objects
       └─> Flag orphaned selections (object removed from new snapshot)

2. Consultant toggles selection (004)
   └─> Upsert ObjectSelection row (isSelected, selectedAt)
   └─> Log to audit trail

3. Consultant uses bulk action (004)
   └─> PUT with array of { objectApiName, isSelected } for all visible objects
   └─> Upsert in transaction
   └─> Log to audit trail

4. Connection deleted (002)
   └─> Cascade delete all ObjectSelection rows via Prisma relation
```
