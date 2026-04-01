# Feature Specification: Migration Filters

**Feature**: 015-migration-filters
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 011-object-mapping

## User Story (atomic)

As a consultant, I can define filters to control which source records are included in the migration for a given object mapping. Filters are conditions on source fields using operators such as EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GREATER_THAN, LESS_THAN, DATE_AFTER, and DATE_BEFORE. Multiple filters on the same object mapping are combined with AND logic. After defining filters, the system displays an estimated record count showing how many source records match the criteria.

**Independent Test**: A consultant opens an object mapping (Contact to Contacts), adds a filter "Email NOT_EQUALS ''" and a second filter "CreatedDate DATE_AFTER 2020-01-01". Both filters appear on the object mapping. The system displays an estimated record count (e.g., "~4,200 records match"). The consultant removes the date filter and the estimate updates.

**Acceptance Scenarios**:

1. **Given** an object mapping exists, **When** the consultant adds a filter with a source field, operator, and value, **Then** the filter is created and displayed on the object mapping.
2. **Given** an object mapping with one filter, **When** the consultant adds a second filter, **Then** both filters are displayed and the system indicates they are combined with AND logic.
3. **Given** an object mapping with active filters, **When** the consultant views the mapping, **Then** an estimated record count is displayed showing how many source records match all filter conditions.
4. **Given** a filter exists, **When** the consultant removes it, **Then** the filter is deleted and the estimated record count is recalculated.
5. **Given** a filter with a date operator (DATE_AFTER or DATE_BEFORE), **When** the consultant enters the value, **Then** the system accepts a standard date format (ISO 8601: YYYY-MM-DD) and displays the filter clearly.
6. **Given** a filter referencing a source field that does not exist, **When** the consultant attempts to save it, **Then** the system rejects the filter with a clear error.

## Edge Cases

- The consultant defines conflicting filters (e.g., "Status EQUALS Active" AND "Status EQUALS Inactive"): the system accepts both filters (they are logically valid conditions) but the estimated record count will show zero matches, alerting the consultant.
- A filter value contains special characters (quotes, backslashes): the system handles escaping correctly.
- The source system is unreachable when estimating record count: the system displays "estimate unavailable" instead of an error, and allows the filter to be saved regardless.
- A filter operator is used with an incompatible field type (e.g., DATE_AFTER on a text field): the system warns the consultant but allows the filter (the source system may handle type coercion).
- An object mapping has 20+ filters: the system supports it without limit.
- All filters are removed from an object mapping: the estimated count reflects the total record count (all records included).

## Functional Requirements

- **FR-001**: The system MUST allow the consultant to create migration filters on an object mapping, each consisting of a source field name, an operator, and a value.
- **FR-002**: The system MUST support the following filter operators: EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GREATER_THAN, LESS_THAN, DATE_AFTER, DATE_BEFORE.
- **FR-003**: Multiple filters on the same object mapping MUST be combined with AND logic.
- **FR-004**: The system MUST display an estimated record count for each object mapping based on its active filters, queried against the source connection.
- **FR-005**: The system MUST validate that the filter's source field exists in the source object's schema.
- **FR-006**: The system MUST allow removing individual filters, with the estimated count recalculated after removal.
- **FR-007**: The system MUST log filter creation and removal to the audit trail (Constitution Principle VI).

## Key Entities

- **MigrationFilter**: Belongs to an ObjectMapping. Has an id, objectMappingId, sourceFieldName, operator (EQUALS | NOT_EQUALS | CONTAINS | STARTS_WITH | ENDS_WITH | GREATER_THAN | LESS_THAN | DATE_AFTER | DATE_BEFORE), value (string), createdAt, updatedAt.

## Success Criteria

- A consultant can add a filter in under 5 seconds.
- Estimated record counts are displayed within 10 seconds of filter changes (dependent on source system response time).
- Filter definitions are correctly persisted and restored across sessions.
- All filter operations are traceable in the audit trail.

## Assumptions

- Estimated record counts are obtained by querying the source connection via the Connector Interface. The exact query mechanism depends on the source connector's capabilities (e.g., SOQL COUNT for Salesforce).
- Filters are defined at plan time and applied at migration execution time (feature 006). This feature covers definition and estimation only.
- Filters apply to source records only -- there is no filtering on destination records.
- The estimated count is approximate and may not reflect real-time source data changes.
- OR logic between filters is out of scope for this feature. All filters are ANDed.
- The migration filter count displayed in the object detail modal (011-object-mapping, component A3) is derived from this feature's data. The UI integration is owned by feature 011.
