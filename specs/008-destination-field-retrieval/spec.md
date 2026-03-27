# Feature Specification: Destination Field Retrieval

**Feature**: 008-destination-field-retrieval
**Created**: 2026-03-27
**Status**: Draft
**Depends on**: 007-destination-schema-retrieval

## User Story (atomic)

As a consultant, within my migration plan, I can see all fields/properties for each destination
object so I know what I can map to.

**Independent Test**: After destination schema retrieval, the consultant selects an object and
sees all its properties with types, constraints, and group info.

**Acceptance Scenarios**:

1. **Given** a retrieved destination schema, **When** the consultant views an object, **Then**
   all properties are displayed with: label, API name, data type, required/optional, read-only.
2. **Given** fields with accessibility restrictions, **When** displayed, **Then** they show
   appropriate badges (read-only, required, etc.).

## Functional Requirements

- **FR-001**: The system MUST retrieve all fields for destination objects via the adapter.
- **FR-002**: Fields MUST include: label, API name, data type, isRequired, isReadOnly.
- **FR-003**: Field retrieval MUST be logged to the audit trail.

## Assumptions

- Destination field retrieval follows the same pattern as source (005-source-field-retrieval).
- All destination objects have their fields retrieved (no selection step needed for destination).
