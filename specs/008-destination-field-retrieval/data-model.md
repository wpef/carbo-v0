# Data Model: Destination Field Retrieval

## Prisma Model: ObjectField (reused from 005)

Destination fields reuse the same `ObjectField` model defined by feature 005. No new table is needed. Fields are naturally scoped to the destination connection via the `snapshotId` -> `SchemaSnapshot` -> `ConnectorConnection` chain.

```prisma
model ObjectField {
  id               String   @id @default(cuid())
  objectId         String
  snapshotId       String
  apiName          String
  label            String
  dataType         String
  isRequired       Boolean  @default(false)
  isReadOnly       Boolean  @default(false)
  isUnique         Boolean  @default(false)
  isAccessible     Boolean  @default(true)
  referenceTo      String?
  relationshipType String?
  createdAt        DateTime @default(now())

  object   SchemaObject   @relation(fields: [objectId], references: [id], onDelete: Cascade)
  snapshot SchemaSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@unique([objectId, apiName])
  @@index([snapshotId])
}
```

### Column Mapping to Spec FRs

| Column | FR | Description |
|--------|-----|-------------|
| `apiName` | FR-002 | API name of the field |
| `label` | FR-002 | Display label |
| `dataType` | FR-002 | System-specific data type string |
| `isRequired` | FR-002 | Whether the field is mandatory |
| `isReadOnly` | FR-002 | Whether the field is read-only (critical for destination) |
| `isAccessible` | (005 FR-004) | Field-level security flag (inherited from 005 pattern) |
| `referenceTo` | (005 FR-003) | Referenced object for lookup fields |
| `relationshipType` | (005 FR-003) | Relationship type (lookup, master-detail, external) |

### Destination-Specific Notes

- `isReadOnly` is especially important for destination fields: a read-only destination field cannot be written to during migration execution. The UI must badge these prominently.
- `isRequired` for destination fields means the migration must supply a value. The UI must badge these with a warning-level visual.
- `isAccessible` carries over from 005: a destination field marked as inaccessible (e.g., HubSpot calculated fields) must be displayed with a "no access" badge and flagged as non-writable.

## Relationships

```
ConnectorConnection (destination)
  └── SchemaSnapshot (CURRENT)
        └── SchemaObject (1:N)
              └── ObjectField (1:N)   <-- this feature populates these
```

## AuditLog Entry (FR-003)

Field retrieval is logged using the existing `AuditLog` model (from 001):

```typescript
{
  planId: string
  action: 'DESTINATION_FIELDS_RETRIEVED'
  entityType: 'SchemaSnapshot'
  entityId: snapshotId
  details: {
    connectionId: string
    objectCount: number
    totalFieldCount: number
    failedObjects: string[]     // apiNames of objects where retrieval failed
    durationMs: number
  }
}
```

## Type Definitions (TypeScript)

```typescript
// Adapter return type (from 000-connector-interface)
import type { ConnectorField } from '@/lib/types/connector'

// Service input/output
interface RetrieveFieldsParams {
  connectionId: string
  snapshotId: string
  planId: string
}

interface RetrieveFieldsResult {
  totalFields: number
  objectResults: {
    objectApiName: string
    fieldCount: number
    status: 'success' | 'error'
    error?: string
  }[]
}
```
