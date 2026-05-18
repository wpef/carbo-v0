# Quickstart: Connector Interface

## What this feature provides

TypeScript types and interfaces that define the contract for all connectors. No runtime code.

## How to use

```typescript
import type {
  ConnectorAdapter,
  ConnectorConnection,
  ConnectorSchema,
  ConnectorObject,
  ConnectorField,
  ConnectorRecord,
  FieldStats,
  PaginatedRecords,
  SchemaDiffResult,
  ConnectorCapabilities,
} from '@/lib/types/connector'
```

## Implementing a new connector

1. Create a file at `src/lib/adapters/<name>/<name>-adapter.ts`
2. Implement `ConnectorAdapter` interface
3. Set capability flags
4. Register in the adapter registry

```typescript
import type { ConnectorAdapter } from '@/lib/types/connector'

export const myAdapter: ConnectorAdapter = {
  capabilities: { canRead: true, canWrite: false, canWriteSchema: false },
  async connect(config) { /* ... */ },
  async disconnect(connectionId) { /* ... */ },
  async getSchema(connectionId) { /* ... */ },
  async getFields(connectionId, objectApiName) { /* ... */ },
  async getRecords(connectionId, objectApiName, page, pageSize) { /* ... */ },
  async getRecordCount(connectionId, objectApiName) { /* ... */ },
  async getFieldStats(connectionId, objectApiName, fieldApiNames) { /* ... */ },
}
```

## Dependencies

- **Depends on**: Nothing
- **Used by**: 001 (Migration Plan), 002 (Source Connection), 003 (Source Schema), 004-010, adapters/salesforce, adapters/hubspot
