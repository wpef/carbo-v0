# Research: Connector Interface

## Decision: Single file vs. multiple files for types

**Chosen**: Single `types.ts` file.

**Rationale**: All types are tightly coupled (ConnectorField references ConnectorObject, etc.). Splitting into multiple files adds import complexity with no benefit. The total is ~200 lines of pure type definitions.

**Rejected**: One file per type (e.g., `connection.ts`, `schema.ts`, `field.ts`). Overhead of 8+ files for simple type exports is not justified.

## Decision: Interface vs. abstract class for ConnectorAdapter

**Chosen**: TypeScript `interface` for ConnectorAdapter.

**Rationale**: FR-011 mandates "pure TypeScript types and interfaces with no runtime implementation." An interface has zero runtime footprint. Abstract classes generate JavaScript code and create an inheritance dependency.

**Rejected**: Abstract class. Would violate FR-011 (no runtime implementation) and add unnecessary coupling.

## Decision: Data types as string vs. enum

**Chosen**: `dataType: string` (free-form string like "text", "number", "date", "picklist", "lookup").

**Rationale**: Per spec assumptions, types are represented as strings to accommodate system-specific types (Salesforce's "encrypted text", HubSpot's "calculation"). An enum would require constant updates for each new connector.

**Rejected**: Union type or enum. Too rigid for unknown/future connector types.

## Decision: Capability flags placement

**Chosen**: Capability flags (`canRead`, `canWrite`, `canWriteSchema`) are properties on the `ConnectorAdapter` interface, not a separate type.

**Rationale**: Every adapter must declare capabilities. Placing them directly on the adapter interface ensures they are always present and co-located with the methods they gate.

## Decision: Generic config for ConnectorConnection

**Chosen**: `config: Record<string, unknown>` on ConnectorConnection.

**Rationale**: Each connector has different auth config (OAuth tokens, API keys, instance URLs). A generic record allows adapter-specific config without polluting the shared interface. Each adapter narrows this type internally.

## Constraint: No runtime dependencies

The types package MUST have zero `import` statements from external packages. All types are self-contained. This ensures any project can import the connector interface without pulling in jsforce, @hubspot/api-client, or any other adapter dependency.

## Constraint: Method signatures must be async

All ConnectorAdapter methods (connect, getSchema, getRecords, etc.) return `Promise<T>` since every real adapter performs network I/O. This is baked into the interface so adapters don't have to wrap synchronous returns.
