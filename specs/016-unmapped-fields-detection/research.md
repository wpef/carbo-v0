# Research: Unmapped Fields Detection

## Decision 1: Computation Strategy

**Options**:
- **Real-time computation**: Compute on every API call from schema fields - mapped fields - excluded fields. Pure read, no stored state.
- **Materialized view**: Pre-compute and store unmapped field lists. Update on field mapping changes. Faster reads, stale risk.
- **Hybrid**: Compute real-time but cache in memory for the session.

**Decision**: Real-time computation. The inputs are small (200 fields max per object, ~50 mappings, ~20 exclusions). The computation is a simple set difference: `unmappedSource = allSourceFields - mappedSourceFields - excludedSourceFields`. This runs in O(n) with Set lookups and completes in under 1ms. No caching needed.

## Decision 2: Exclusion Persistence vs. Computed

**Options**:
- **Persisted exclusions**: Store FieldExclusion rows in DB. Explicit, auditable, survives refresh.
- **Session-only exclusions**: Store in frontend state. Simpler but lost on page reload.

**Decision**: Persisted exclusions. Principle VI (Traceability) requires audit trail for exclusion decisions. The consultant's deliberate choice to exclude a field is a meaningful action that must persist across sessions and appear in client documents.

## Decision 3: Auto-Clear Exclusion on Mapping

The spec says: "A field that was marked as intentionally excluded becomes mapped: the exclusion flag is automatically cleared." This is handled in the FieldMappingService (012). When `createFieldMapping` succeeds, it checks for and deletes any FieldExclusion for that sourceFieldName. This keeps the logic in the mapping service (where the trigger occurs) rather than in the unmapped-fields service.

## Decision 4: Bulk Exclusion

The spec requires bulk exclusion for objects with many irrelevant fields. The API supports a single POST with an array of sourceFieldNames. The UI provides a "select all visible" + "exclude selected" flow.

## Decision 5: "Required" Destination Property Detection

Required destination properties that are unmapped represent a migration risk (writes will fail). The "required" status comes from the connector schema metadata (ConnectorField.isRequired). The unmapped-fields computation checks all destination fields where isRequired=true and filters out those that have a FieldMapping targeting them.

## Decision 6: Integration with Other Features

- **Feature 011 (Object Detail Modal, A3)**: The "fields remaining to validate" count is computed as: `totalSourceFields - mappedSourceFields - excludedSourceFields`. The object detail endpoint (011) calls UnmappedFieldsService for this count.
- **Feature 012 (Field Mapping View)**: The GET endpoint already returns `unmappedSourceFields` and `unmappedDestinationFields`. This data comes from UnmappedFieldsService.
- **Feature 019/020 (Documents)**: Unmapped fields warnings are included in generated documents. The document generation service calls UnmappedFieldsService.
