# Data Model: Connector Interface

## Type Definitions

All types are compile-time only (no Prisma, no database). Defined in `src/lib/types/connector.ts`.

### ConnectorConnection (FR-001)

```typescript
interface ConnectorConnection {
  id: string
  name: string
  type: string              // e.g. "salesforce", "hubspot"
  status: 'CONNECTED' | 'EXPIRED' | 'ERROR'
  config: Record<string, unknown>
}
```

### ConnectorSchema (FR-002)

```typescript
interface ConnectorSchema {
  objects: ConnectorObject[]
}
```

### ConnectorObject (FR-003)

```typescript
interface ConnectorObject {
  apiName: string
  label: string
  description?: string
  isCustom: boolean
  isSelected: boolean
}
```

### ConnectorField (FR-004)

```typescript
interface ConnectorField {
  apiName: string
  label: string
  dataType: string          // system-specific, normalized by mapping layer
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  referenceTo?: string      // target object apiName for lookups
  relationshipType?: 'lookup' | 'master-detail' | 'external'
}
```

### ConnectorRecord (FR-005)

```typescript
type ConnectorRecord = Record<string, unknown>
```

### FieldStats (FR-006)

```typescript
interface FieldStats {
  fieldApiName: string
  nullCount: number
  distinctCount: number
  sampleValues: unknown[]   // up to 5 unique values
}
```

### PaginatedRecords (FR-007)

```typescript
interface PaginatedRecords {
  records: ConnectorRecord[]
  totalCount: number
  pageSize: number
  currentPage: number       // 1-indexed (FR-012)
  hasNextPage: boolean
}
```

### SchemaDiffResult (FR-008)

```typescript
interface SchemaDiffResult {
  addedObjects: string[]
  removedObjects: string[]
  modifiedObjects: {
    apiName: string
    addedFields: string[]
    removedFields: string[]
    modifiedFields: {
      apiName: string
      changes: Record<string, { before: unknown; after: unknown }>
    }[]
  }[]
}
```

### ConnectorCapabilities (FR-009)

```typescript
interface ConnectorCapabilities {
  canRead: boolean
  canWrite: boolean
  canWriteSchema: boolean
}
```

### ConnectorAdapter (FR-010)

```typescript
interface ConnectorAdapter {
  readonly capabilities: ConnectorCapabilities

  // Connection
  connect(config: Record<string, unknown>): Promise<ConnectorConnection>
  disconnect(connectionId: string): Promise<void>

  // Read (required)
  getSchema(connectionId: string): Promise<ConnectorSchema>
  getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]>
  /** page is 1-indexed (FR-012). page=1 returns the first pageSize records. */
  getRecords(connectionId: string, objectApiName: string, page: number, pageSize: number): Promise<PaginatedRecords>
  getRecordCount(connectionId: string, objectApiName: string): Promise<number>
  getFieldStats(connectionId: string, objectApiName: string, fieldApiNames: string[]): Promise<FieldStats[]>

  // Write (optional — gated by capabilities.canWriteSchema)
  createObject?(connectionId: string, object: { apiName: string; label: string; description?: string }): Promise<ConnectorObject>
  createField?(connectionId: string, objectApiName: string, field: Omit<ConnectorField, 'isReadOnly' | 'isUnique'>): Promise<ConnectorField>
}
```

## Relationships

```
ConnectorSchema (1) ──► (N) ConnectorObject
ConnectorObject (1) ──► (N) ConnectorField
ConnectorObject (1) ──► (N) ConnectorRecord (via getRecords)
ConnectorField  (1) ──► (0..1) FieldStats (via getFieldStats)
```
