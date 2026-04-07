# Research: Migration Filters

## Decision 1: Filter UI Placement

**Options**:
- **Separate page**: Dedicated page for filters per object mapping. Clear separation but extra navigation.
- **Panel within object mapping view**: Expandable panel in the object detail modal or mapping view. Fewer clicks, contextual.
- **Tab on field mapping page**: Filters tab alongside field mappings. Related context but dual-purpose page.

**Decision**: Panel within the object mapping view. Filters are tightly coupled to an object mapping. The MigrationFilterPanel component is displayed either in the ObjectDetailModal (011) or as a collapsible panel in the mapping view. This keeps filters contextual and avoids unnecessary navigation.

## Decision 2: Estimated Record Count Architecture

**Options**:
- **Client-side query**: Frontend calls the connector directly. Breaks the API boundary.
- **Server-side query via dedicated endpoint**: API endpoint calls the connector adapter's `getRecordCount` method with filters. Clean separation.
- **Background polling**: Periodically update counts. Unnecessary complexity for v0.

**Decision**: Server-side via `/estimate` endpoint. The endpoint receives the current filters (from DB), converts them to the connector's query format, and calls `getRecordCount` (or equivalent like SOQL COUNT for Salesforce). The response includes the count or "estimate unavailable" if the source is unreachable.

The estimation is on-demand (triggered by the client after filter changes), not automatic. This avoids unnecessary connector calls.

## Decision 3: Filter Operator Set

The spec defines 9 operators: EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GREATER_THAN, LESS_THAN, DATE_AFTER, DATE_BEFORE.

These are stored as string enums. The connector adapter is responsible for translating these operators into system-specific query syntax (e.g., SOQL for Salesforce, filter expressions for HubSpot). This translation happens at execution time (feature 024), not at filter definition time.

For estimation, the filter-estimation service constructs a generic filter object and passes it to the adapter. Adapters that don't support certain operators return "estimate unavailable" for those filters.

## Decision 4: Field Validation

FR-005 requires validating that the filter's source field exists in the source object's schema. This check is performed at creation time by querying the persisted schema snapshot (from feature 005). The field picker in FilterForm only shows fields from the source object's schema, making invalid field selection impossible through the UI. The API validates as a safety net.

## Decision 5: AND-Only Logic

All filters on an object mapping are combined with AND logic. OR logic is explicitly out of scope. The UI displays "AND" between each filter row to make the combination logic visible. This simplicity is sufficient for v0 and covers the majority of real-world use cases (e.g., "only active contacts created after 2020").
