# Research: Unmapped Fields Detection

## Decision 1: Read-Time Computation vs Materialized View

**Decision**: Unmapped fields are computed at read time by comparing the current set of field mappings and exclusions against the source/destination schema snapshots. No background process, no materialized view, no stored "unmapped" flag.

**Rationale**: The spec explicitly states "unmapped fields detection is a read-time computation based on the current set of field mappings and exclusions -- it does not require a separate background process." The computation is simple: `unmappedSourceFields = allSourceFields - mappedSourceFields - excludedSourceFields`. With 200+ fields, this is still sub-millisecond.

**Alternatives**: Background job that pre-computes unmapped status (unnecessary complexity, stale data risk), stored `isMapped` flag on each field (sync nightmare when mappings change), database view (ties computation to Postgres, harder to unit test).

## Decision 2: Coverage Formula

**Decision**: Two coverage metrics per object mapping:

1. **Source coverage** = `(mappedSourceFields + excludedSourceFields) / totalSourceFields * 100`
2. **Destination required coverage** = `mappedRequiredDestFields / totalRequiredDestFields * 100`

A "green" (complete) state requires: source coverage = 100% AND destination required coverage = 100%.

**Rationale**: Source coverage includes excluded fields because deliberate exclusions are a valid consultant decision (not a gap). Destination coverage only counts required fields because optional unmapped destination fields are acceptable. The two percentages serve different purposes: source coverage answers "have I reviewed every source field?" while destination coverage answers "will the migration succeed without required field errors?"

**Alternatives**: Single combined metric (loses the distinction between source and destination concerns), exclude-excluded-from-percentage (penalizes deliberate decisions), count-based instead of percentage (less intuitive for consultants).

## Decision 3: FieldExclusion Model Design

**Decision**: A `FieldExclusion` table with: id, objectMappingId, sourceFieldName, reason (optional text), createdAt. Only source fields can be excluded (not destination required fields -- those must be mapped or get a default value).

**Rationale**: The spec says "the consultant can mark unmapped fields as 'intentionally excluded'" specifically for source fields. Destination required fields appear in a separate warning section -- the consultant resolves them by creating a field mapping (possibly with a FIXED_VALUE transformation), not by excluding them. The optional `reason` field allows the consultant to document why a field was excluded (e.g., "system field, not relevant for migration").

**Alternatives**: Exclude both source and destination fields (spec doesn't support destination exclusion), store exclusions as a JSON array on ObjectMapping (loses queryability and audit trail), no reason field (loses documentation value).

## Decision 4: Bulk Exclusion UX

**Decision**: The POST endpoint accepts either a single exclusion or an array of exclusions. The UI provides a "Select all" checkbox on the unmapped source fields list, plus individual checkboxes, and a "Exclure la selection" button. All selected fields are submitted in a single POST request.

**Rationale**: The spec requires "bulk-mark fields as 'intentionally excluded'" for the edge case of source objects with hundreds of system fields. A single API call with an array payload is simpler than multiple sequential calls and allows a single audit log entry.

**Alternatives**: Individual exclusion only (poor UX for 100+ fields), "Exclude all" button without selection (too aggressive -- the consultant may want to exclude most but not all), drag-and-drop to an excluded zone (over-engineered).

## Decision 5: Auto-Clear Exclusion on Mapping

**Decision**: When a FieldMapping is created for a source field that has a FieldExclusion, the exclusion is automatically deleted. This is implemented in the field mapping creation service (012), not in the unmapped fields service, because the trigger event is "field mapping created."

**Rationale**: FR-006 states "the system MUST automatically clear the 'intentionally excluded' flag when a field mapping is created for a previously excluded field." This prevents contradictory states (field both mapped and excluded). The deletion happens in the same transaction as the field mapping creation.

**Alternatives**: Soft-clear (mark exclusion as inactive) -- adds complexity, no benefit since the mapping supersedes the exclusion; leave exclusion in place (contradictory state); periodic cleanup job (stale data between runs).

## Decision 6: Integration with 011 Object Detail Modal

**Decision**: The "fields remaining to validate" count in the 011 object detail modal (A3) is derived from: `unmappedSourceFieldsCount + unmappedRequiredDestFieldsCount`. This count is computed by the unmapped-fields endpoint and exposed as a convenience field in the response.

**Rationale**: The spec for 011 states "fields remaining to validate is computed from the total source fields minus mapped fields minus intentionally excluded fields." This is exactly the unmapped source field count from this feature. Adding the unmapped required destination field count makes the indicator more comprehensive.

**Alternatives**: Separate endpoint for the modal count (unnecessary duplication), client-side computation in the modal (requires the modal to fetch all field data), store the count on ObjectMapping (stale data risk).

## Decision 7: Real-Time Updates

**Decision**: The unmapped fields list updates in real time as the consultant adds or removes field mappings. This is achieved by passing a `version` counter (incremented after every field mapping mutation) from the field mapping view to the `useUnmappedFields` hook, which triggers a re-fetch.

**Rationale**: The spec edge case states "the unmapped fields list updates in real time as the consultant adds or removes field mappings." The version counter pattern is already used in 012 for similar real-time update needs (tab badge updates).

**Alternatives**: WebSocket/SSE (over-engineered for a single-user tool), polling (wasteful), manual refresh button (poor UX).
