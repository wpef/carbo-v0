# Research: Migration Filters

## Decision 1: Filter Operator Set

**Decision**: Nine operators as a closed union: `EQUALS | NOT_EQUALS | CONTAINS | STARTS_WITH | ENDS_WITH | GREATER_THAN | LESS_THAN | DATE_AFTER | DATE_BEFORE`. Stored as a string enum in Prisma.

**Rationale**: The spec explicitly defines these 9 operators. They cover the primary use cases for CRM data filtering (string matching, numeric comparison, date ranges). The set is intentionally finite -- complex expressions (nested OR, regex) are out of scope per assumptions.

**Alternatives**: Extensible operator registry (over-engineered for 9 operators), free-text query language like SOQL (too complex for non-technical consultants), operator groups per field type (adds UI complexity without clear benefit since the spec allows operators on any field type with a warning).

## Decision 2: Estimated Count Strategy

**Decision**: The estimation endpoint calls the source connector's `getRecordCount` with filter parameters translated to the connector's query language. For Salesforce, filters are translated to a SOQL WHERE clause. For HubSpot, filters are translated to the search API filter groups. If the connector does not support filtered counts, the endpoint returns the total count with a "filtered count unavailable" flag.

**Rationale**: The spec states "estimated record counts are obtained by querying the source connection via the Connector Interface." The translation layer is connector-specific and lives in the adapter. The ConnectorAdapter interface needs a new optional method `getFilteredRecordCount(connectionId, objectApiName, filters)` or the existing `getRecordCount` is extended with an optional filter parameter.

**Alternatives**: Client-side filtering of cached records (inaccurate for large datasets), background job that counts periodically (too slow for interactive use), always return total count (useless for the consultant).

## Decision 3: Filter Validation Approach

**Decision**: Validate that the filter's source field exists in the source object's schema (FR-005). Validation is performed server-side during filter creation by checking the field name against the current schema snapshot. Type-operator compatibility (e.g., DATE_AFTER on a text field) produces a warning but does not block creation per the spec edge case.

**Rationale**: The spec says "the system rejects the filter with a clear error" for non-existent fields but "warns the consultant but allows the filter" for incompatible operator-type combinations. This distinction requires two levels: hard validation (field exists) and soft validation (type compatibility warning).

**Alternatives**: All-or-nothing validation (too strict per spec), no validation (violates FR-005), deferred validation at execution time (too late for UX feedback).

## Decision 4: Filter Storage -- Flat Table

**Decision**: A single `MigrationFilter` table with columns: id, objectMappingId, sourceFieldName, operator, value, createdAt, updatedAt. No grouping, no ordering. All filters on an object mapping are combined with AND logic.

**Rationale**: The spec explicitly states "OR logic between filters is out of scope." With AND-only logic, filter order is irrelevant (commutative). A flat table with one row per condition is the simplest correct representation.

**Alternatives**: JSON array on ObjectMapping (loses queryability), filter groups with logical operators (over-engineered for AND-only), ordered list (unnecessary since AND is commutative).

## Decision 5: UI Placement

**Decision**: The filter panel (FilterPanel component) is rendered on the field mapping page for each object mapping, above the field mapping table. This placement follows the spec for 012 which states "the FilterPanel for source record filtering appears above the field mapping table."

**Rationale**: Session Learning #2 from 012 spec: "Filters are displayed BEFORE field mapping." The consultant defines which records to include first, then maps their fields. The filter count shown in the object detail modal (011 A3) is derived from the same data.

**Alternatives**: Separate filter management page (breaks the workflow), modal-based filter editor (hides context), sidebar (conflicts with migration preview sidebar).

## Decision 6: Estimation Refresh Timing

**Decision**: The estimated count is re-fetched automatically after: (1) a filter is added, (2) a filter is removed, (3) the consultant explicitly requests a refresh. The fetch is debounced (1s) to avoid rapid-fire calls during batch operations. If the source is unreachable, "estimate unavailable" is displayed per the spec edge case.

**Rationale**: SC-002 requires "estimated record counts displayed within 10 seconds of filter changes." Auto-refresh after mutations ensures the count stays current without requiring a manual action. The debounce prevents hammering the source connector during bulk filter operations.

**Alternatives**: Manual refresh only (poor UX, violates SC-002 spirit), real-time streaming (over-engineered), polling (wasteful if no changes occurred).

## Decision 7: ConnectorAdapter Extension for Filtered Counts

**Decision**: Add an optional method to the ConnectorAdapter interface: `getFilteredRecordCount?(connectionId: string, objectApiName: string, filters: FilterCondition[]): Promise<number>`. If not implemented, the service falls back to returning the unfiltered total count with a warning flag.

**Rationale**: Not all connectors support server-side filtering (e.g., CSV file connectors). Making the method optional preserves backward compatibility. The `FilterCondition` type maps directly to the MigrationFilter fields (fieldName, operator, value).

**Alternatives**: Extend existing `getRecordCount` with optional parameter (breaking change to the interface), client-side filtering (impractical for large datasets), require all connectors to implement (violates open/closed for future connectors).
