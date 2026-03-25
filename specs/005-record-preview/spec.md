# Feature Specification: Record Preview

**Feature**: 005-record-preview
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 004-field-retrieval

## User Story (atomic)

As a consultant, I can preview the actual data in any selected object to understand what I am migrating, so that I can make informed decisions about mapping rules, transformations, and data quality before creating a plan.

**Independent Test**: A consultant selects an object with records, opens the record preview, sees a paginated table of records with all field values, navigates to the next page, and sees the total record count. Null and empty values are explicitly shown, not hidden.

**Acceptance Scenarios**:

1. **Given** a selected object with records, **When** the consultant opens the record preview, **Then** a paginated table of records is displayed with all field values and the total record count.
2. **Given** a large object (100,000+ records), **When** the consultant views the first page, **Then** the page loads in under 5 seconds without timeout or performance degradation.
3. **Given** the record preview, **When** the consultant clicks "Next page", **Then** the next page of records is loaded and displayed. "Previous page" navigates back.
4. **Given** a record with null or empty field values, **When** the record is displayed, **Then** nulls are explicitly shown as "null" and empty strings are shown as empty, not hidden or omitted.
5. **Given** a record with a relationship field (lookup/foreign key), **When** the record is displayed, **Then** the field shows a meaningful reference (name or ID of the related record), not just a raw key.

## Edge Cases

- An object has zero records: the preview displays "No records found" with a total count of 0.
- An object has only one record: the preview displays the single record; pagination controls are hidden or disabled.
- A record contains a very long text value (e.g., 10,000+ characters): the value is truncated in the table view with an option to expand.
- The page size is larger than the total number of remaining records: the last page displays the remaining records without error.
- The consultant changes the page size mid-navigation: the system resets to page 1 with the new page size.
- Network error during record fetch: the system displays an error message and allows retry without losing the current page state.
- A field contains binary or blob data: the field shows a placeholder (e.g., "[binary data]") rather than raw bytes.

## Functional Requirements

- **FR-001**: The system MUST retrieve and display records from any selected object in paginated form via the connector adapter.
- **FR-002**: The default page size MUST be 50 records. The consultant MAY change the page size (options: 25, 50, 100).
- **FR-003**: The system MUST provide pagination controls: previous page, next page, and current page indicator.
- **FR-004**: The system MUST display the total record count for the object.
- **FR-005**: The system MUST display all field values per record. Null values MUST be explicitly shown as "null". Empty strings MUST be shown as empty, not hidden.
- **FR-006**: Relationship fields MUST display a meaningful reference (name or ID of the related record) rather than a raw foreign key, when the connector adapter supports it.
- **FR-007**: The system MUST handle large text values by truncating in the table view with an expand option.
- **FR-008**: The system MUST log record preview events (object, page, record count) to the audit trail.

## Key Entities

- **PaginatedRecords**: (defined in 000-connector-interface) A page of records with: records array, totalCount, pageSize, currentPage, hasNextPage.
- **ConnectorRecord**: (defined in 000-connector-interface) A single data row as a key-value map.

## Success Criteria

- **SC-001**: First page of records loads in under 5 seconds for objects with up to 100,000 records.
- **SC-002**: Pagination navigation (next/previous page) completes in under 3 seconds.
- **SC-003**: 100% of field values are displayed per record, including nulls and empty values (no silent omissions).
- **SC-004**: All record preview events are traceable in the audit trail.

## Assumptions

- The connector adapter provides a paginated record retrieval method that accepts page number and page size.
- The connector adapter provides a total record count method (or includes it in the paginated response).
- Records are read-only in this feature; no data modification is performed.
- Record preview is fetched on-demand; records are not persisted in the local database.
- The connector adapter can resolve relationship references to meaningful display values (name or ID).
