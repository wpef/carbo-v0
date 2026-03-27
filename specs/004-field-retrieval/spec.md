# Feature Specification: Field Retrieval

**Feature**: 004-field-retrieval
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 003-object-selection

## User Story (atomic)

As a consultant, I can see all fields for my selected objects with their types and constraints, so that I can understand the data structure before creating a mapping plan.

**Independent Test**: A consultant with selected objects triggers field retrieval, selects an object, and sees all its fields listed with label, API name, data type, required/optional, unique, read-only status, and relationship info. Inaccessible fields are shown with a "no access" badge.

**Acceptance Scenarios**:

1. **Given** confirmed object selection with at least one selected object, **When** field retrieval is triggered, **Then** the system retrieves field metadata only for selected objects (not the entire schema) and displays all fields per object.
2. **Given** a selected object, **When** the consultant views its fields, **Then** each field displays: label, API name, data type, required/optional, unique, read-only, and relationship info (if applicable).
3. **Given** a field that is inaccessible due to field-level security, **When** the consultant views the field list, **Then** the field is still listed but clearly marked with a "no access" badge.
4. **Given** a field with a relationship (e.g., lookup, foreign key), **When** the consultant views the field, **Then** the relationship target (referenced object) and relationship type are displayed.
5. **Given** a selected object with many fields (100+), **When** the consultant views the field list, **Then** all fields are displayed without truncation or silent omission.

## Edge Cases

- A selected object has zero fields (edge case for some systems): the system displays "No fields found" without error.
- A field has an unknown or system-specific data type not in the common set: the type is displayed as reported by the system with a visual indicator that it may require special handling during mapping.
- A field has no label (only an API name): the API name is used as the display label.
- Field retrieval fails for one object but succeeds for others: the system reports the failure for the specific object and displays fields for the objects that succeeded.
- The consultant changes the object selection after field retrieval: fields are retrieved for newly selected objects and discarded for deselected ones.
- A field is both required and read-only: both constraints are displayed, as this may indicate an auto-generated field (e.g., system ID).

## Functional Requirements

- **FR-001**: The system MUST retrieve field metadata only for objects where isSelected=true, not for the entire schema.
- **FR-002**: For each field, the system MUST retrieve and display: apiName, label, dataType, isRequired, isReadOnly, isUnique.
- **FR-003**: For fields with relationships, the system MUST retrieve and display: the referenced object (referenceTo) and the relationship type.
- **FR-004**: Fields that are inaccessible due to field-level security MUST be listed with a "no access" badge. They MUST NOT be silently omitted.
- **FR-005**: The system MUST persist retrieved field metadata in the database, linked to the schema snapshot and object.
- **FR-006**: The system MUST handle partial failures gracefully: if field retrieval fails for one object, it MUST succeed for others and report the failure.
- **FR-007**: The system MUST log field retrieval events (success, failure, field count per object) to the audit trail.
- **FR-008**: The system MUST update persisted fields when the consultant modifies the object selection (add fields for newly selected objects, remove fields for deselected objects).

## Key Entities

- **ObjectField**: A field within a selected object. Fields: id, objectId, snapshotId, apiName, label, dataType, isRequired, isReadOnly, isUnique, isAccessible, referenceTo (optional), relationshipType (optional).

## Success Criteria

- **SC-001**: Field retrieval for 50 selected objects completes in under 60 seconds.
- **SC-002**: 100% of fields reported by the connector adapter are present in the retrieved metadata (no silent omissions, including inaccessible fields).
- **SC-003**: All field retrieval events are traceable in the audit trail.
- **SC-004**: Re-selecting an object after deselection triggers a fresh field retrieval.

## Assumptions

- The connector adapter provides a method to retrieve all fields for a given object, including accessibility status.
- Field metadata is retrieved per-object, not in bulk for the entire schema.
- Field metadata is static within a schema snapshot; it changes only when the schema is refreshed.
- The field data type is a string representation provided by the connector adapter (not a predefined enum), preserving system-specific types.

## Workflow Navigation

After field retrieval completes, the UI MUST display:
- If this is a source system and destination is not yet connected: "Source schema ready. Next: [Connect Destination →]"
- If this is a source system and destination is already connected: "Source schema ready. Next: [Create Mapping Plan →]"
- If this is a destination system: "Destination schema ready. Next: [Create Mapping Plan →]"
