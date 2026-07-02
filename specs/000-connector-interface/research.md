# Research: Connector Interface

## Decision 1: Single File vs Multi-File

**Decision**: Single file `src/lib/types/connector.ts`.

**Rationale**: 12 types is small enough for one file (~150 lines). Splitting creates import overhead for a package with no runtime. All types are tightly related (a connector's vocabulary).

**Alternatives**: One file per type (too granular), barrel re-export (unnecessary indirection).

## Decision 2: Data Types as Strings

**Decision**: `dataType` field is `string`, not a union/enum.

**Rationale**: Spec explicitly requires system-agnostic design. Salesforce has ~30 field types, HubSpot has ~15, and they don't overlap cleanly. A closed enum would break on every new connector. The type compatibility matrix (012) normalizes raw types into 5 canonical categories at the mapping layer — the connector interface stays permissive.

**Alternatives**: Union type of known values (breaks open/closed), branded string (unnecessary complexity).

## Decision 3: Method Signatures as Interface vs Abstract Class

**Decision**: TypeScript `interface` for the adapter contract (`ConnectorAdapter`).

**Rationale**: FR-011 requires "pure TypeScript types with no runtime implementation." An abstract class would add runtime code to the bundle. An interface is erased at compile time.

**Alternatives**: Abstract class (violates FR-011), type alias with function signatures (less discoverable).

## Decision 4: Pagination Convention

**Decision**: 1-indexed pagination per FR-012.

**Rationale**: Captured from live test bug — 0-indexed page silently drops first page of records. Convention is enforced end-to-end: API route validates `page >= 1`, adapter implements `(page-1)*pageSize` offset, UI hook initializes `page=1`.

## Decision 5: ConnectorAdapter Interface Shape

**Decision**: Single `ConnectorAdapter` interface with required + optional methods.

Required: `connect`, `disconnect`, `getSchema`, `getFields`, `getRecords`, `getRecordCount`, `getFieldStats`.
Optional (gated by capabilities): `createObject`, `createField`.

**Rationale**: Mirrors FR-010. Optional methods are typed but their absence is checked via capability flags at runtime, not via separate interfaces.
