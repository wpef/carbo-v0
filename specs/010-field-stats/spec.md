# Feature Specification: Field Stats

**Feature**: 010-field-stats
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 009-record-preview

## User Story (atomic)

As a consultant, I can see data quality stats per field to identify issues before creating the mapping, so that I can spot null-heavy fields, low-cardinality fields, and unexpected patterns without manually scanning records.

**Independent Test**: A consultant opens the record preview for an object, sees per-field stats displayed alongside the data (null count, distinct value count, and up to 5 sample values per field), and uses this information to assess data quality.

**Acceptance Scenarios**:

1. **Given** a record preview is loaded for an object, **When** the consultant views field stats, **Then** each field displays: null count, distinct value count, and up to 5 sample unique values.
2. **Given** a field where all records have the same value, **When** the consultant views its stats, **Then** the distinct count is 1 and the sample values show that single value.
3. **Given** a field where all values are null, **When** the consultant views its stats, **Then** the null count equals the total record count, distinct count is 0, and sample values is empty.
4. **Given** an object with a large number of records, **When** stats are computed, **Then** they are computed from the fetched records (the current page or accumulated pages), and the scope is clearly indicated (e.g., "Stats based on 50 records").

## Edge Cases

- A field contains only null values: null count equals the record count, distinct count is 0, sample values is empty.
- A field has high cardinality (all values unique): distinct count equals the record count, only the first 5 unique values are shown.
- A field contains very long string values: sample values are truncated in the display.
- An object has zero records: stats are not available and the system displays "No data to analyze".
- The fetched page has fewer records than the total (stats are based on a sample, not the full dataset): the system clearly labels the scope (e.g., "Based on 50 of 10,000 records").
- A field contains binary or blob data: stats are not computed for that field, displayed as "N/A".

## Functional Requirements

- **FR-001**: The system MUST compute per-field stats from the fetched records: null count, distinct value count, and sample values (up to 5 unique non-null values).
- **FR-002**: Stats MUST be computed client-side from records already fetched for the record preview. No additional API call is required.
- **FR-003**: The system MUST clearly indicate the scope of the stats (e.g., "Based on N records") so the consultant understands whether the stats represent the full dataset or a sample.
- **FR-004**: The system MUST display stats alongside or below the record preview, associated with each field column.
- **FR-005**: For fields where stats are not computable (binary, blob), the system MUST display "N/A" instead of empty or misleading values.
- **FR-006**: Sample values MUST be truncated if they exceed a reasonable display length (e.g., 100 characters per value).

## Key Entities

- **FieldStats**: (defined in 000-connector-interface) Per-field statistics. Fields: fieldApiName, nullCount, distinctCount, sampleValues (array of up to 5 unique values).

## Success Criteria

- **SC-001**: Stats computation completes in under 1 second for a page of 100 records with up to 200 fields.
- **SC-002**: Stats are accurate: null count and distinct count match a manual count of the fetched records.
- **SC-003**: The scope of the stats is always visible to the consultant (number of records analyzed).

## Assumptions

- Stats are computed from records already fetched for the preview (no separate API call to the external system).
- Stats represent a sample, not the full dataset, unless all records have been fetched. The consultant is always aware of this.
- The system does not persist field stats in the database; they are computed on-the-fly from fetched records.
- Future enhancements may add full-dataset stats via server-side computation, but this is out of scope for this feature.
