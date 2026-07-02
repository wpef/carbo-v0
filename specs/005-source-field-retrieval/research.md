# Research: Source Field Retrieval

## Decision 1: Retrieval Strategy — Sequential vs Parallel per Object

**Decision**: Parallel retrieval with bounded concurrency (5 objects at a time).

**Rationale**: SC-001 requires 50 objects in under 60 seconds. Sequential retrieval at ~2s per object would take ~100s. Parallel with concurrency of 5 brings this to ~20s. Full parallelism (50 at once) risks rate-limiting on external APIs (Salesforce has concurrent API call limits). A concurrency pool of 5 balances speed and safety.

**Implementation**: Use `Promise.allSettled` with a concurrency limiter (e.g., `p-limit` or a manual semaphore). Each object's retrieval is independent — `allSettled` naturally supports FR-006 (partial failure handling).

**Alternatives**: Sequential (too slow), unbounded parallel (rate-limit risk), chunked batches of 10 (less granular failure isolation).

## Decision 2: Persistence Granularity — One Row per Field vs JSON Blob

**Decision**: One Prisma row per field (`ObjectField` model).

**Rationale**: Individual rows enable querying fields by type, filtering by accessibility, joining with mapping tables downstream (011, 012), and updating individual fields on re-retrieval. A JSON blob on `SchemaObject` would require deserializing the entire payload for any operation and would not support relational joins.

**Alternatives**: JSON column on `SchemaObject` (no relational queries), separate document store (violates Postgres-only constraint).

## Decision 3: Handling Inaccessible Fields (FR-004)

**Decision**: Store inaccessible fields in the database with `isAccessible=false`. Display in UI with a "no access" badge.

**Rationale**: The spec explicitly requires inaccessible fields to be listed, not omitted. The `ConnectorAdapter.getFields()` method returns all fields including inaccessible ones (per spec assumption). Storing them allows the mapping layer to warn the consultant if they attempt to map an inaccessible field.

**Implementation**: The `ObjectField` model includes an `isAccessible` boolean (default true). The connector adapter sets it to false for fields blocked by field-level security. The `ConnectorField` type from 000 does not include `isAccessible` — this is a persistence-layer enrichment. The adapter implementation must determine accessibility and pass it through a connector-specific mechanism (e.g., Salesforce `describe` returns `accessible` per field).

**Note**: The `ConnectorField` interface (000) does not include `isAccessible`. Two approaches: (a) extend `ConnectorField` to add an optional `isAccessible?: boolean`, or (b) have each adapter return a richer type and map it to `ObjectField` at the service layer. Decision: extend `ConnectorField` with `isAccessible?: boolean` (defaults to true when not provided). This is a backward-compatible addition.

## Decision 4: Re-retrieval on Selection Change (FR-008)

**Decision**: On selection change, delete fields for deselected objects and retrieve fields for newly selected objects. Do not re-retrieve fields for objects that remain selected.

**Rationale**: FR-008 requires updating persisted fields when selection changes. Re-retrieving all fields would be wasteful. A diff between the previous and new selection identifies additions and removals. Fields for deselected objects are deleted (cascade from `SchemaObject.isSelected=false`). Fields for newly selected objects are retrieved fresh.

**Implementation**: The `field-retrieval-service.ts` accepts a list of `objectApiNames` to retrieve. The caller (004 selection confirmation or a re-trigger endpoint) computes the delta.

## Decision 5: dataType as String

**Decision**: Store `dataType` as a plain string, not an enum.

**Rationale**: Consistent with 000 `ConnectorField.dataType` design (see 000 research, Decision 2). System-specific types are preserved as-is. The mapping layer (012) normalizes types into canonical categories — the field retrieval layer stays permissive.

## Decision 6: Relationship Fields (FR-003)

**Decision**: Store `referenceTo` and `relationshipType` as optional string fields on `ObjectField`.

**Rationale**: Matches the `ConnectorField` type from 000. `referenceTo` is the API name of the target object. `relationshipType` is a string enum (`lookup`, `master-detail`, `external`). Both are null for non-relationship fields. Storing them allows the mapping layer to render relationship context.

## Decision 7: Audit Trail Granularity (FR-007)

**Decision**: One audit entry per retrieval batch (not per object, not per field). The entry includes a JSON summary: total objects attempted, succeeded, failed, and field count per object.

**Rationale**: Logging per-field would create thousands of audit rows for a single retrieval. Per-batch with a structured summary provides traceability (Principle VI) without storage bloat. Failed objects are listed individually in the summary.
