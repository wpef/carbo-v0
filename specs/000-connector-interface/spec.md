# Feature Specification: Connector Interface

**Feature**: 000-connector-interface
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: None (foundation)

## User Story (atomic)

As a developer, I can implement a new connector by following the interface contract, so that every connector exposes the same capabilities (connect, read schema, read records, optionally write schema) and the rest of the application can work with any system without knowing its specifics.

**Independent Test**: A developer creates a mock connector that implements all required interfaces. The mock passes a compile-time type check and satisfies a contract test suite that validates every method signature and return type.

**Acceptance Scenarios**:

1. **Given** the connector interface package, **When** a developer implements all required interfaces (ConnectorConnection, ConnectorSchema, ConnectorObject, ConnectorField), **Then** the implementation compiles without errors and is accepted by the type system.
2. **Given** a connector implementation, **When** it declares capability flags (canRead, canWrite, canWriteSchema), **Then** the application can query these flags to enable or disable features at runtime.
3. **Given** a connector that sets canWriteSchema to false, **When** the application checks capabilities, **Then** schema write operations are not offered for that connector.
4. **Given** the interface definitions, **When** a developer reviews ConnectorField, **Then** it includes all metadata needed for mapping: apiName, label, dataType, isRequired, isReadOnly, isUnique, and relationship info.
5. **Given** a new connector implementation, **When** it is registered with the application, **Then** it is usable for connection, schema retrieval, and record reading without any changes to application code.

## Edge Cases

- A connector implements only read capabilities (canRead=true, canWrite=false, canWriteSchema=false): the application must not offer write or schema-write operations for that connector.
- A connector returns an unknown or unmappable data type for a field: the type is preserved as-is (string representation) and flagged for manual review during mapping.
- A connector has zero objects in its schema: the interface returns an empty array, not an error.
- A connector field has no label (only API name): the interface uses the API name as a fallback display value.

## Functional Requirements

- **FR-001**: The interface MUST define a `ConnectorConnection` type with: id, name, type (string identifier for the system), status (CONNECTED, EXPIRED, ERROR), and a generic config object.
- **FR-002**: The interface MUST define a `ConnectorSchema` type representing a snapshot of a system's schema, containing a list of `ConnectorObject` entries.
- **FR-003**: The interface MUST define a `ConnectorObject` type with: apiName, label, description (optional), isCustom, and isSelected.
- **FR-004**: The interface MUST define a `ConnectorField` type with: apiName, label, dataType (string), isRequired, isReadOnly, isUnique, and optional relationship metadata (referenceTo, relationshipType).
- **FR-005**: The interface MUST define a `ConnectorRecord` type representing a single data row as a key-value map (field API name to value).
- **FR-006**: The interface MUST define a `FieldStats` type with: fieldApiName, nullCount, distinctCount, and sampleValues (array of up to 5 unique values).
- **FR-007**: The interface MUST define a `PaginatedRecords` type with: records (array of ConnectorRecord), totalCount, pageSize, currentPage, and hasNextPage.
- **FR-008**: The interface MUST define a `SchemaDiffResult` type with: addedObjects, removedObjects, modifiedObjects (each containing field-level diffs).
- **FR-009**: The interface MUST define capability flags: canRead (boolean), canWrite (boolean), canWriteSchema (boolean). Every connector MUST declare these.
- **FR-010**: The interface MUST define method signatures for: connect, disconnect, getSchema, getFields, getRecords, getRecordCount, getFieldStats. Optional: createObject, createField (only when canWriteSchema is true).
- **FR-011**: The interface MUST be pure TypeScript types and interfaces with no runtime implementation. No concrete classes, no dependencies.

## Key Entities

- **ConnectorConnection**: Identity and status of a connection to an external system.
- **ConnectorSchema**: Snapshot of a system's full object list.
- **ConnectorObject**: A single object (table/entity) in a system's schema.
- **ConnectorField**: A single field (column/property) on an object.
- **ConnectorRecord**: A single data row, represented as a key-value map.
- **FieldStats**: Per-field data quality statistics.
- **PaginatedRecords**: A page of records with navigation metadata.
- **SchemaDiffResult**: Structural differences between two schema snapshots.

## Success Criteria

- **SC-001**: A mock connector implementing all interfaces passes compile-time type checking with zero errors.
- **SC-002**: The interface package has zero runtime dependencies.
- **SC-003**: All downstream features (001-007) can be built against these interfaces without referencing any specific connector implementation.
- **SC-004**: A contract test suite validates that any implementation satisfies all method signatures and return types.

## Assumptions

- TypeScript is the implementation language for all interfaces.
- The interface is system-agnostic: it works equally for Salesforce, HubSpot, Airtable, or any future connector.
- Data types are represented as strings (e.g., "text", "number", "date", "boolean", "picklist", "lookup") rather than an exhaustive enum, to accommodate system-specific types.
- The interface does not prescribe authentication mechanisms; each connector handles auth internally.
