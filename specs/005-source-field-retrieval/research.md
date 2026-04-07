# Research: Source Field Retrieval

## Decision 1: Retrieval strategy (batch vs. on-demand)

**Options**:
- (A) Retrieve fields for all selected objects in one batch operation
- (B) Retrieve fields on-demand per object when the consultant expands it

**Decision**: (A) Batch retrieval. Reasons:
- Fields are needed by downstream features (mapping, rules) for ALL selected objects
- Batch retrieval ensures completeness: the consultant cannot accidentally skip objects
- Progress indicator shows per-object progress during the batch
- The expand-to-preview in 004 is informational only; this is the authoritative field store

**Implementation**: Sequential per-object retrieval (adapter.getFields(apiName)) with progress tracking. Parallel would risk rate limits on external APIs. Each object's fields are persisted as they complete, enabling partial success.

## Decision 2: Field storage granularity

**Options**:
- (A) One ObjectField row per field per object (normalized)
- (B) Store fields as a JSON array on the SchemaObject (denormalized)

**Decision**: (A) Normalized rows. Reasons:
- Individual fields are referenced by mapping features (011, 012)
- Enables field-level queries (e.g., "find all required fields across all objects")
- Supports field-level diff if needed in future
- Consistent with SchemaObject being a normalized entity

## Decision 3: Handling inaccessible fields (FR-004)

The adapter reports fields with an `isAccessible` flag. Inaccessible fields (due to field-level security) are still stored and displayed, but marked with a "no access" badge.

**Approach**: The ObjectField model includes `isAccessible: Boolean @default(true)`. The UI renders a red "No Access" badge on inaccessible fields. These fields are still available for mapping but will generate a warning during mapping validation.

## Decision 4: Data type representation

Per spec assumption: "The field data type is a string representation provided by the connector adapter (not a predefined enum)."

**Approach**: `dataType` is stored as `String`. The UI displays it as-is. Common types (string, number, boolean, date, picklist, lookup) get recognizable icons. Unknown types get a generic icon with a "may require special handling" tooltip.

## Decision 5: Partial failure handling (FR-006)

If field retrieval fails for object A but succeeds for objects B and C:
1. B and C fields are persisted normally
2. A is flagged with an error state (no fields, error message stored)
3. The UI shows which objects failed and offers a "Retry" button for individual objects
4. The overall retrieval is considered complete (not failed) -- partial results are useful

**Implementation**: The service returns a result object:
```typescript
{ 
  succeeded: { objectApiName: string; fieldCount: number }[]
  failed: { objectApiName: string; error: string }[]
}
```

## Decision 6: Field update on selection change (FR-008)

When the consultant changes object selection (004):
- Newly selected objects: fields are NOT auto-retrieved. The consultant must trigger retrieval again (or the system prompts "New objects selected. Retrieve fields?").
- Deselected objects: fields are retained in the database but excluded from mapping scope. This avoids data loss if the consultant re-selects the object later.
- Permanent cleanup: fields for deselected objects are only deleted on explicit schema refresh or disconnect.

This is simpler and safer than auto-retrieval on every selection toggle.

## Decision 7: Relationship metadata

For fields with relationships (e.g., Salesforce Lookup, MasterDetail), the adapter returns:
- `referenceTo`: the API name of the referenced object (e.g., "Account")
- `relationshipType`: the type of relationship (e.g., "Lookup", "MasterDetail", "Hierarchy")

These are stored as nullable strings on ObjectField. The UI displays them inline with the field type.

## API Design

- `POST /api/plans/[planId]/source/fields` -- trigger batch field retrieval for all selected objects
- `GET /api/plans/[planId]/source/fields` -- get all persisted fields grouped by object
- `GET /api/plans/[planId]/source/fields/[objectId]` -- get fields for a specific object
