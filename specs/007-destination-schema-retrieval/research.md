# Research: Destination Schema Retrieval

## Decision 1: Shared SchemaSnapshot Model (side discriminator)

**Decision**: Reuse the `SchemaSnapshot`, `SchemaObject`, and `ObjectField` Prisma models from 003-source-schema-retrieval. Discriminate by a `side` field (`'source' | 'destination'`) on `SchemaSnapshot`, which is derived from the `ConnectorConnection.role` field.

**Rationale**: Source and destination schemas have identical structures (objects with fields). Duplicating the tables would create maintenance burden and break the shared diff/drift algorithms. The `side` field ensures queries are scoped correctly (`WHERE connectionId = ? AND side = 'destination'`).

**Alternatives**: Separate `DestinationSchemaSnapshot` table (violates DRY, breaks shared services), no discriminator and rely on connection role lookup (extra join on every query — acceptable but less explicit).

## Decision 2: Full Chain Guarantee (FR-004)

**Decision**: Every refresh trigger (refresh button on `/destination/schema`, refresh button on `/destination`, post-OAuth auto-trigger) calls a single service function `refreshDestinationSchema(connectionId)` that executes the full chain: `adapter.getSchema()` -> for each object: `adapter.getFields()` -> snapshot rotation -> `checkMappingIntegrity()`. The page never renders a state where the new snapshot has objects but no fields.

**Rationale**: FR-004 explicitly prohibits partial chains. Destination has no object-selection step, so the chain is simpler than source (no selection confirmation gate). The single entry point eliminates divergence bugs between trigger paths.

**Alternatives**: Separate schema and field retrieval endpoints (risk of partial state, violates FR-004), background job for field retrieval (adds complexity, still risks partial state on page render).

## Decision 3: No Object Selection for Destination

**Decision**: All destination objects are retrieved and stored. The `isSelected` field on `SchemaObject` is always `true` for destination objects.

**Rationale**: Spec explicitly states "Destination objects do not need selection -- all are available for mapping." Unlike source (where the consultant picks which objects to migrate FROM), the destination is the WRITE target -- the consultant needs to see everything available to map TO.

**Alternatives**: Allow destination object selection (spec explicitly rejects this), lazy-load objects on demand (breaks snapshot completeness).

## Decision 4: Drift Detection Severity Tuning

**Decision**: `detectLiveDrift(connectionId, 'destination')` uses the canonical taxonomy from spec 003 but applies destination-specific severity overrides:
- `FIELD_BECAME_REQUIRED` -> `warning` (was the value being supplied?)
- `FIELD_READONLY_CHANGED` to readOnly=true -> `warning` (write will fail)
- `FIELD_UNIQUE_CHANGED` to unique=true -> `warning` (duplicate writes will fail)

The overrides are applied as a post-processing step on the shared `detectLiveDrift` output, not by forking the algorithm.

**Rationale**: Destination is the WRITE side. Changes that are merely informational on source (a field becoming required) are operationally significant on destination (the migration must now supply a value or fail). The shared algorithm returns canonical severities; the destination wrapper elevates specific cases.

**Alternatives**: Fork the drift algorithm for destination (breaks single source of truth for taxonomy), add severity parameters to the shared function (increases API surface for a small number of overrides).

## Decision 5: Drift Detection Scope (Budget Optimization)

**Decision**: `detectLiveDrift(connectionId, 'destination')` inspects ALL objects at object-level (added/removed), but restricts field-level inspection to objects referenced by existing mappings. This follows the budget rule from 003 FR-016.

**Rationale**: A destination may have hundreds of objects. Fetching fields for all of them on every plan visit would be slow and wasteful. Only mapped objects need field-level drift detection -- unmapped objects just need presence/absence checks. The consultant can run a full refresh to inspect everything.

**Alternatives**: Full field-level inspection for all objects (too slow, violates 15s budget), no field-level inspection at all (misses critical changes like field removal).

## Decision 6: Mapping Integrity Check Integration (FR-005)

**Decision**: The integrity check (`checkMappingIntegrity` from feature 017) is called at the end of `refreshDestinationSchema()`, after the snapshot rotation completes. It receives the planId and checks ALL mappings (source + destination) against the current snapshots.

**Rationale**: FR-005 requires the integrity check after every successful refresh. The check is plan-level (not connection-level) because a single mapping references both source and destination. Running it after destination refresh ensures both sides are checked.

**Alternatives**: Check only destination-side mappings (misses cross-side issues), run the check asynchronously (risk of stale UI state).
