# Quickstart: Connector Interface

## Prerequisites

- Node.js 18+
- TypeScript 5.x (installed with the project)

## No environment variables needed

This feature is pure types with no runtime behavior.

## Validate types compile

```bash
npx tsc --noEmit src/lib/connectors/types.ts
```

## Run contract tests

```bash
npx vitest run tests/unit/connectors/contract.test.ts
```

The contract test creates a mock adapter implementing all interfaces and verifies:
1. The mock compiles without errors (type-level validation).
2. All required methods exist and return the correct types.
3. Capability flags are declared.
4. A mock with `canWriteSchema=false` can omit `createObject` and `createField`.

## Use in downstream features

```typescript
import type {
  ConnectorAdapter,
  ConnectorConnection,
  ConnectorSchema,
  ConnectorObject,
  ConnectorField,
  ConnectorRecord,
  PaginatedRecords,
  FieldStats,
  SchemaDiffResult,
} from '@/lib/connectors';
```

All imports are type-only. No runtime code is pulled in.
