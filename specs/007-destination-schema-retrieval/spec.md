# Feature Specification: Destination Schema Retrieval

**Feature**: 007-destination-schema-retrieval
**Created**: 2026-03-27
**Status**: Draft
**Depends on**: 006-destination-connection

## User Story (atomic)

As a consultant, within my migration plan, after connecting the destination, I can retrieve
the full list of destination objects so I know what's available for mapping.

**Independent Test**: After connecting a destination in a plan, the consultant sees the list
of available objects with labels, API names, and custom/standard badges.

**Acceptance Scenarios**:

1. **Given** a connected destination, **When** the schema is retrieved, **Then** all objects
   are displayed with label, API name, standard/custom badge, and description.
2. **Given** a retrieved destination schema, **When** the consultant refreshes, **Then** a diff
   is shown (added/removed/modified objects).

## Functional Requirements

- **FR-001**: The system MUST retrieve all objects from the destination via the adapter.
- **FR-002**: Schema snapshots MUST follow the CURRENT/PREVIOUS rotation (max 2).
- **FR-003**: Schema retrieval MUST be logged to the audit trail.

## Assumptions

- Destination schema retrieval follows the same pattern as source (002-schema-retrieval spec applies).
- Destination objects do not need selection — all are available for mapping.
