# Feature Specification: Mapping Plan

**Feature**: 008-mapping-plan
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 001-salesforce-connector, 002-hubspot-connector

## User Story (atomic)

As a consultant, I can create a mapping plan that links a source connection and a destination connection, give it a name and description, and track its status as I build it out. The plan status automatically reflects its completeness: DRAFT when the plan is incomplete, COMPLETE when all required destination fields are mapped, and BROKEN when schema changes invalidate existing mappings. I can list all my plans, view any single plan, and delete plans I no longer need.

**Independent Test**: A consultant can create a mapping plan with a name and description, selecting an existing source and destination connection. The plan appears in the plan list with DRAFT status. The consultant can view the plan details and delete it.

**Acceptance Scenarios**:

1. **Given** at least one source connection and one destination connection exist, **When** the consultant creates a new mapping plan with a name, description, source connection, and destination connection, **Then** the plan is persisted with status DRAFT and appears in the plan list.
2. **Given** a mapping plan exists, **When** the consultant views the plan list, **Then** each plan is displayed with its name, source connection name, destination connection name, status, and last modified date.
3. **Given** a mapping plan exists, **When** the consultant opens it, **Then** the plan details are displayed including name, description, source and destination connection info, current status, and a summary of object mappings (if any).
4. **Given** a mapping plan where all required destination fields across all object mappings are mapped, **When** the plan is evaluated, **Then** its status automatically transitions to COMPLETE.
5. **Given** a COMPLETE mapping plan, **When** a required destination field is unmapped (e.g., a field mapping is deleted), **Then** the status reverts to DRAFT.
6. **Given** a mapping plan, **When** the consultant deletes it, **Then** the plan and all its child data (object mappings, field mappings, rules, filters) are removed. The deletion is confirmed before execution.

## Edge Cases

- The consultant tries to create a plan with a duplicate name: the system allows it (names are not unique identifiers) but displays a warning.
- The consultant tries to create a plan with the same connection as both source and destination: the system rejects it with a clear error.
- A plan references a connection that has been deleted: the plan status transitions to BROKEN with an explanation.
- The consultant tries to delete a plan that is referenced by a client document (feature 004): the system warns that associated documents exist and requires confirmation.
- A plan has zero object mappings: it remains in DRAFT status.

## Functional Requirements

- **FR-001**: The system MUST allow the consultant to create a mapping plan with a name, optional description, one source connection, and one destination connection.
- **FR-002**: The system MUST enforce that source and destination connections are different connections (not the same connection used as both).
- **FR-003**: The system MUST automatically assign status DRAFT to newly created plans.
- **FR-004**: The system MUST automatically transition plan status to COMPLETE when all required destination fields across all object mappings have a corresponding field mapping.
- **FR-005**: The system MUST automatically transition plan status to BROKEN when a referenced connection is deleted, or when a schema change invalidates existing mappings (delegated to feature 015).
- **FR-006**: The system MUST allow listing all mapping plans with name, status, connection names, and last modified date.
- **FR-007**: The system MUST allow viewing a single mapping plan with full details.
- **FR-008**: The system MUST allow deleting a mapping plan with cascade deletion of all child entities (object mappings, field mappings, rules, filters).
- **FR-009**: The system MUST log plan creation, status transitions, and deletion to the audit trail (Constitution Principle VI).

## Key Entities

- **MappingPlan**: Top-level entity. Has an id, name, description, sourceConnectionId, destinationConnectionId, status (DRAFT | COMPLETE | BROKEN), createdAt, updatedAt. Owns zero or more ObjectMappings.

## Success Criteria

- A consultant can create, list, view, and delete mapping plans in under 10 seconds per operation.
- Plan status transitions are automatic and correct: no manual status management required.
- All plan lifecycle operations are traceable in the audit trail.
- Plans with 10+ object mappings load and display without performance degradation.

## Assumptions

- Source and destination connections are provided by features 001 and 002 via a generic Connector Interface. The mapping plan does not depend on Salesforce or HubSpot specifics.
- The mapping plan does not execute any migration -- it defines the specification only.
- Plan status computation depends on child features (009-015) being implemented; until then, plans remain in DRAFT.
- A plan covers exactly one source connection and one destination connection.
