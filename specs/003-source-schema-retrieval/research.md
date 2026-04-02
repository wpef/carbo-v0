# Research: Source Schema Retrieval

## Decision 1: Snapshot rotation strategy

**Options**:
- (A) Keep all snapshots with a version number, limit to N
- (B) Two-slot model: CURRENT and PREVIOUS only

**Decision**: (B) Two-slot model per spec (FR-004). On new retrieval:
1. Delete existing PREVIOUS snapshot (and its SchemaObjects via cascade)
2. Demote existing CURRENT to PREVIOUS
3. Insert new snapshot as CURRENT

This is simple, predictable, and sufficient for the diff use case. No version history needed.

## Decision 2: Diff computation approach

**Options**:
- (A) Compute diff on-the-fly when requested (compare CURRENT vs PREVIOUS in memory)
- (B) Persist the diff as a separate entity

**Decision**: (A) On-the-fly computation. Reasons:
- Diff is cheap: compare two arrays of objects by apiName
- No stale data risk -- diff always reflects current state
- Less schema complexity
- With up to 2000 objects, in-memory comparison is sub-millisecond

**Algorithm**:
```
currentMap = Map(apiName -> SchemaObject) from CURRENT
previousMap = Map(apiName -> SchemaObject) from PREVIOUS
added = keys in currentMap not in previousMap
removed = keys in previousMap not in currentMap
modified = keys in both where label or isCustom differ
```

## Decision 3: Concurrency prevention (FR-007)

**Options**:
- (A) Database lock (pessimistic)
- (B) In-memory flag per connectionId
- (C) Status field on connection: RETRIEVING

**Decision**: (C) Status field approach. Set `SourceConnection.status = "RETRIEVING"` at start, revert to `CONNECTED` on success or `ERROR` on failure. The API POST handler checks this status before starting. Simple, observable, and persistent across server restarts.

## Decision 4: Partial failure handling

Schema retrieval calls the adapter's `getSchema()` which returns the full object list in one call. There is no partial failure at the object level -- the adapter either returns the full list or throws.

If the adapter throws, the existing CURRENT snapshot is retained (FR-009, acceptance scenario 5). No snapshot rotation occurs. The error is logged and returned to the client.

## Decision 5: Schema objects storage granularity

Each `SchemaObject` is stored as a separate row linked to its `SchemaSnapshot`. This enables:
- Efficient diff computation via SQL JOINs if needed
- Object selection (004) to reference individual schema objects
- Field retrieval (005) to link fields to specific objects

The alternative (storing the full object list as a JSON blob on the snapshot) would make cross-referencing harder and violate data normalization.

## API Design

- `POST /api/plans/[planId]/source/schema` -- trigger retrieval (returns snapshot + diff if PREVIOUS exists)
- `GET /api/plans/[planId]/source/schema` -- get CURRENT snapshot with objects
- `GET /api/plans/[planId]/source/schema/diff` -- get diff between CURRENT and PREVIOUS
