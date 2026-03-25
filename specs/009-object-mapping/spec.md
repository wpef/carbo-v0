# Feature Specification: Object Mapping

**Feature**: 009-object-mapping
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 008-mapping-plan

## User Story (atomic)

As a consultant, I can associate source objects with destination objects within a mapping plan, creating one or more object-level mappings (e.g., Contact to Contacts, Account to Companies). Each object mapping shows the source object's field count and the destination object's property count, along with progress tracking indicating how many fields have been mapped out of the total. I can add, view, and remove object mappings within a plan.

**Independent Test**: A consultant opens a mapping plan, adds an object mapping from source "Contact" (25 fields) to destination "Contacts" (30 properties), sees progress "0/25 fields mapped", then adds a second object mapping from "Account" to "Companies". Both appear in the plan with their field counts.

**Acceptance Scenarios**:

1. **Given** a mapping plan with source and destination connections, **When** the consultant adds an object mapping by selecting a source object and a destination object, **Then** the object mapping is created and displayed within the plan.
2. **Given** an object mapping has been created, **When** the consultant views it, **Then** the source object field count, destination object property count, and mapping progress (mapped fields / total source fields) are displayed.
3. **Given** a mapping plan, **When** the consultant adds multiple object mappings (e.g., Contact to Contacts, Account to Companies), **Then** all object mappings are listed within the plan, each with its own progress indicator.
4. **Given** an object mapping exists, **When** the consultant removes it, **Then** the object mapping and all its child data (field mappings, rules, filters) are removed. Removal is confirmed before execution.
5. **Given** a mapping plan, **When** the consultant attempts to map the same source object to the same destination object a second time, **Then** the system rejects the duplicate with a clear message.

## Edge Cases

- A source object has zero fields (metadata-only object): the system allows the mapping but displays a note that no field mappings are possible.
- The consultant maps the same source object to two different destination objects (e.g., Contact to Contacts and Contact to Leads): the system allows it, as this is a valid migration pattern (fan-out).
- The consultant maps two different source objects to the same destination object (e.g., Contact to Contacts and Lead to Contacts): the system allows it with a warning that record conflicts may occur during execution.
- A source or destination object has hundreds of fields: field counts display correctly without truncation.
- An object mapping has no field mappings: progress shows "0/N fields mapped" and the parent plan remains in DRAFT status.

## Functional Requirements

- **FR-001**: The system MUST allow the consultant to create an object mapping within a plan by selecting one source object and one destination object from the respective connection schemas.
- **FR-002**: The system MUST prevent duplicate object mappings (same source object + same destination object) within a single plan.
- **FR-003**: The system MUST display the source object field count and destination object property count for each object mapping.
- **FR-004**: The system MUST display mapping progress for each object mapping as "N mapped / M total source fields".
- **FR-005**: The system MUST allow removing an object mapping with cascade deletion of all child field mappings, transformation rules, validation rules, and migration filters.
- **FR-006**: The system MUST allow multiple object mappings per plan, with no arbitrary limit.
- **FR-007**: The system MUST log object mapping creation and removal to the audit trail (Constitution Principle VI).

## Key Entities

- **ObjectMapping**: Belongs to a MappingPlan. Has an id, mappingPlanId, sourceObjectName, destinationObjectName, createdAt, updatedAt. Owns zero or more FieldMappings and MigrationFilters.

## Success Criteria

- A consultant can add an object mapping in under 5 seconds.
- Field counts and progress indicators are accurate and update in real time as field mappings are added or removed.
- Removing an object mapping cleanly cascades to all child entities.
- Object mapping operations are traceable in the audit trail.

## Assumptions

- Source and destination object lists are provided by the Connector Interface (features 001 and 002). The object mapping does not fetch schemas itself.
- Field counts are derived from the schema snapshots stored by the connectors.
- The mapping progress denominator is the total number of source fields, not destination properties.
- Object mappings are independent of each other within a plan -- they do not share field mappings.
