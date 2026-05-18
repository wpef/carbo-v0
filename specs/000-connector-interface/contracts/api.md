# Contracts: Connector Interface

## TypeScript Interface Contract

The connector interface is the contract itself. Any class or object implementing `ConnectorAdapter` satisfies the contract. There are no HTTP API routes for this feature — it is consumed in-process by downstream features.

### Contract Verification

A contract test suite validates any implementation:

```typescript
function assertValidAdapter(adapter: ConnectorAdapter): void {
  // Compile-time: TypeScript enforces method signatures
  // Runtime: contract test suite verifies:
  //   1. capabilities flags are set
  //   2. connect() returns ConnectorConnection with valid status
  //   3. getSchema() returns ConnectorSchema with objects array
  //   4. getFields() returns ConnectorField[] with required properties
  //   5. getRecords(_, _, 1, 10) returns PaginatedRecords with currentPage=1 (FR-012)
  //   6. getFieldStats() returns FieldStats[] matching requested field names
  //   7. If canWriteSchema=false, createObject/createField are undefined
  //   8. If canWriteSchema=true, createObject/createField return valid types
}
```

### Mock Adapter (for testing)

A `DemoAdapter` implementing `ConnectorAdapter` is provided for development and testing. It uses in-memory data and requires no external connections.

Location: `src/lib/adapters/demo/demo-adapter.ts`
