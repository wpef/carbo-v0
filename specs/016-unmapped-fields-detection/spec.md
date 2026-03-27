# Feature Specification: Unmapped Fields Detection

**Feature**: 016-unmapped-fields-detection
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 012-field-mapping

## User Story (atomic)

As a consultant, I am explicitly warned about unmapped fields to ensure nothing is accidentally lost during migration. For each object mapping, the system lists all source fields that are not mapped to any destination property and all required destination properties that are not mapped from any source field. The consultant can mark unmapped fields as "intentionally excluded" to distinguish deliberate omissions from forgotten ones, clearing the warning for those fields while keeping the warning visible for unacknowledged gaps.

**Independent Test**: A consultant opens an object mapping (Contact to Contacts) where 20 of 25 source fields are mapped and 2 required destination properties have no source mapping. The system displays a warning section listing the 5 unmapped source fields and the 2 unmapped required destination properties. The consultant marks 3 source fields as "intentionally excluded" -- those fields no longer trigger a warning, but the remaining 2 unmapped source fields and 2 unmapped required destination properties still show warnings.

**Acceptance Scenarios**:

1. **Given** an object mapping with some source fields unmapped, **When** the consultant views the mapping, **Then** a clearly visible warning lists all unmapped source fields by name and type.
2. **Given** an object mapping where required destination properties have no source mapping, **When** the consultant views the mapping, **Then** a clearly visible warning lists all unmapped required destination properties by name and type.
3. **Given** an unmapped source field, **When** the consultant marks it as "intentionally excluded", **Then** the field no longer appears in the unmapped warning list and is shown in a separate "excluded" section.
4. **Given** a previously excluded source field, **When** the consultant reverses the exclusion, **Then** the field reappears in the unmapped warning list.
5. **Given** an object mapping where all source fields are either mapped or intentionally excluded, and all required destination properties are mapped, **When** the consultant views the mapping, **Then** no unmapped field warnings are displayed.

## Edge Cases

- A source object has hundreds of fields, most of which are system fields irrelevant to migration: the consultant can bulk-mark fields as "intentionally excluded" to clear warnings efficiently.
- A destination property is required but the consultant has no source data for it: the warning persists until the consultant either creates a field mapping with a FIXED_VALUE transformation rule or marks it as acknowledged.
- All source fields are unmapped (no field mappings exist yet): the system shows the full unmapped list without performance issues.
- A field that was marked as "intentionally excluded" becomes mapped: the exclusion flag is automatically cleared and the field appears as "mapped" instead.
- The unmapped fields list updates in real time as the consultant adds or removes field mappings.

## Functional Requirements

- **FR-001**: The system MUST display a list of all source fields within an object mapping that are not mapped to any destination property (Constitution Principle III: no silent data loss).
- **FR-002**: The system MUST display a list of all required destination properties within an object mapping that have no source field mapped to them.
- **FR-003**: The system MUST allow the consultant to mark individual unmapped source fields as "intentionally excluded".
- **FR-004**: The system MUST allow bulk exclusion of multiple unmapped source fields in a single action.
- **FR-005**: Intentionally excluded fields MUST be displayed separately from unacknowledged unmapped fields.
- **FR-006**: The system MUST automatically clear the "intentionally excluded" flag when a field mapping is created for a previously excluded field.
- **FR-007**: The system MUST log exclusion and un-exclusion actions to the audit trail (Constitution Principle VI).

## Key Entities

- **FieldExclusion**: Belongs to an ObjectMapping. Has an id, objectMappingId, sourceFieldName, reason (optional text), createdAt. Represents a consultant's deliberate decision to exclude a source field from the mapping.

## Success Criteria

- 100% of unmapped source fields are visible -- none are hidden or silently omitted (Constitution Principle III).
- 100% of unmapped required destination properties are visible.
- The consultant can distinguish between forgotten and intentionally excluded fields at a glance.
- Unmapped field detection works correctly with object mappings containing 200+ source fields.
- All exclusion operations are traceable in the audit trail.

## Assumptions

- Field metadata (names, types, required/optional) is provided by the Connector Interface via schema snapshots.
- "Required" destination properties are those marked as required in the destination schema -- the definition comes from the connector, not from the mapping plan.
- Unmapped fields detection is a read-time computation based on the current set of field mappings and exclusions -- it does not require a separate background process.
- Unmapped fields detection applies per object mapping, not across the entire plan.
