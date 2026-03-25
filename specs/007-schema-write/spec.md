# Feature Specification: Schema Write

**Feature**: 007-schema-write
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 001-connection, 000-connector-interface

## User Story (atomic)

As a consultant, I can create new objects and properties in the destination directly from Carbo-v0, so that I can prepare the destination schema to receive migrated data without leaving the application.

**Independent Test**: A consultant connected to a destination system creates a new property on an existing object (specifying label, name, type, group), then creates a new custom object (specifying name and primary property). Both operations succeed and the created elements are visible in the destination system. The operations are logged in the audit trail.

**Acceptance Scenarios**:

1. **Given** a destination connection where canWriteSchema is true, **When** the consultant opens the schema write interface, **Then** the system allows creating new properties and new custom objects.
2. **Given** a destination connection where canWriteSchema is false, **When** the consultant looks for schema write options, **Then** schema write features are not available and the consultant sees a message explaining that this connector does not support schema modification.
3. **Given** valid property details (label, name, type, group), **When** the consultant submits the create property form, **Then** the property is created in the destination system and a confirmation is displayed.
4. **Given** valid custom object details (name, primary property), **When** the consultant submits the create object form, **Then** the object is created in the destination and a confirmation is displayed.
5. **Given** a property name that already exists on the target object, **When** the consultant tries to create it, **Then** the system displays a validation error before making the API call (pre-validation) or a clear error from the system (post-validation).
6. **Given** any schema write operation (success or failure), **When** the operation completes, **Then** it is logged to the audit trail with: operation type, target object, property details, result, and timestamp.

## Edge Cases

- The property name conflicts with a reserved word in the destination system: the system displays a clear error message from the destination.
- The destination system has tier/plan limitations on custom objects or properties: the system surfaces the error clearly (e.g., "Custom object limit reached").
- The destination system is temporarily unavailable during the write: the system reports the error and allows retry.
- The consultant creates a property with a type not supported by the destination: the system validates type compatibility before submitting and rejects invalid types.
- The consultant creates an object and then refreshes the schema: the newly created object appears in the refreshed schema.
- The property group specified does not exist in the destination: the system either creates the group or reports an error, depending on the connector adapter's behavior.
- Network drops during a write operation: the system reports the failure. The consultant can check the destination to see if the operation partially completed.

## Functional Requirements

- **FR-001**: The system MUST check the canWriteSchema capability flag before offering schema write features. If false, schema write MUST NOT be available.
- **FR-002**: The system MUST allow creating new properties on existing objects, with: label, internal name, data type, and group (if supported by the destination).
- **FR-003**: The system MUST allow creating new custom objects, with: name and a primary property definition.
- **FR-004**: The system MUST validate inputs before submitting to the destination: name uniqueness (against known schema), type compatibility (against destination's supported types), and required fields.
- **FR-005**: The system MUST display clear error messages for all failure scenarios: name conflicts, tier limitations, invalid types, network errors, and system-specific errors.
- **FR-006**: Every schema write operation (success or failure) MUST be logged to the audit trail with: operation type (createObject, createProperty), target, details, result, timestamp, and consultant identity.
- **FR-007**: After a successful schema write, the system MUST offer to refresh the local schema snapshot to include the newly created elements.
- **FR-008**: The system MUST NOT allow schema writes on source connections, only on destination connections.

## Key Entities

- **SchemaWriteOperation**: Audit record of a schema modification. Fields: id, connectionId, operationType (CREATE_OBJECT | CREATE_PROPERTY), targetObjectApiName (for properties), details (JSON: name, label, type, group), result (SUCCESS | ERROR), errorMessage (optional), createdAt.

## Success Criteria

- **SC-001**: A property creation round-trip (submit form to confirmation) completes in under 10 seconds.
- **SC-002**: A custom object creation round-trip completes in under 15 seconds.
- **SC-003**: 100% of schema write operations are logged in the audit trail, including failures.
- **SC-004**: Pre-validation catches name conflicts and invalid types before making API calls (when the information is available locally).
- **SC-005**: Schema write features are invisible for connectors that do not support them (canWriteSchema=false).

## Assumptions

- Not all connector adapters support schema writes. The feature is gated by the canWriteSchema capability flag.
- Schema writes are only available for destination connections, not source connections.
- The connector adapter implements createObject and createField methods when canWriteSchema is true.
- Property types available for creation are defined by the destination connector (e.g., string, number, date, boolean, enumeration).
- The consultant is responsible for ensuring that schema modifications align with the migration plan; the system does not enforce this automatically.
- The system does not support deleting or modifying existing objects/properties in this feature (create only).
