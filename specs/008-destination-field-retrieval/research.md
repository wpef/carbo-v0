# Research: Destination Field Retrieval

## Decision 1: Reuse of 005 Field Service vs Separate Service

**Decision**: Extract the shared field retrieval logic from 005 into `src/features/shared/services/field-service.ts` and call it from both the source and destination field services. The shared function handles: adapter call, field normalization, persistence, audit logging.

**Rationale**: 005 (source) and 008 (destination) both call `ConnectorAdapter.getFields()`, persist `ObjectField` rows, and log to audit. The only difference is the object scope: source retrieves fields for selected objects (`isSelected=true`), destination retrieves for all objects (no selection step). Extracting the shared core avoids duplication while keeping the callers simple.

**Alternatives**: Full copy-paste into a destination-specific service (violates DRY, doubles maintenance), single service with a `role` parameter (couples source and destination lifecycle).

## Decision 2: No Object Selection Gate for Destination

**Decision**: Destination field retrieval iterates over all objects in the CURRENT schema snapshot. There is no equivalent of the source-side object-selection step (004).

**Rationale**: Spec 008 assumption: "All destination objects have their fields retrieved (no selection step needed for destination)." The destination side represents the target schema -- the consultant needs to see all available fields to know what they can map to. Filtering is done later at the mapping step (011/012).

**Alternatives**: Allow destination object selection (rejected -- spec explicitly states no selection), lazy field retrieval on expand (rejected -- full retrieval needed for downstream mapping auto-suggest).

## Decision 3: ObjectField Model Reuse

**Decision**: Destination fields use the same `ObjectField` Prisma model as source fields. The `connectionId` + `snapshotId` foreign keys naturally partition source and destination fields.

**Rationale**: The `ObjectField` model from 005 already contains all required columns (apiName, label, dataType, isRequired, isReadOnly, isUnique, isAccessible, referenceTo, relationshipType). Adding a separate `DestinationField` table would duplicate the schema. Since each connection has its own snapshot chain, there is no ambiguity between source and destination fields.

**Alternatives**: Separate `DestinationField` model (duplication), discriminator column `role: 'source' | 'destination'` (unnecessary -- already partitioned by connection/snapshot).

## Decision 4: Field Retrieval Trigger in Full Chain

**Decision**: Destination field retrieval is always triggered as part of the full chain (schema -> fields), never independently. The chain is initiated by: (1) post-OAuth auto-trigger (006 FR-016), (2) manual refresh button (006 FR-017 / 007 FR-004), or (3) initial schema retrieval.

**Rationale**: Spec 007 FR-004 mandates the full chain with no partial execution. The destination schema page must never show objects without fields. Field retrieval is the second and final step of the destination chain (no object-selection step in between).

**Alternatives**: Independent field retrieval endpoint (violates full-chain invariant from 007), lazy per-object retrieval on UI expand (leaves schema incomplete).

## Decision 5: Concurrent Field Retrieval

**Decision**: Retrieve fields for all destination objects in parallel with a concurrency limit (e.g., 5 concurrent adapter calls). Use `Promise.allSettled` to handle partial failures gracefully.

**Rationale**: Destination schemas can have 100+ objects. Sequential retrieval would be too slow. A concurrency limit prevents overwhelming the destination API (e.g., HubSpot rate limits). `Promise.allSettled` allows partial success reporting per 005 FR-006 pattern.

**Alternatives**: Sequential (too slow), unlimited parallel (risk of rate limiting), batch API if available (adapter-specific, not guaranteed).

## Decision 6: Badge Display for Destination Fields

**Decision**: Destination fields display three badge types: `required` (isRequired=true), `read-only` (isReadOnly=true), `unique` (isUnique=true). These are critical because the destination is the write side -- a read-only field cannot be written to, a required field must have a value supplied.

**Rationale**: Spec acceptance scenario 2 explicitly requires "appropriate badges (read-only, required, etc.)." For destination context, these badges carry more weight than on the source side because they affect whether a mapping can succeed at execution time.

**Alternatives**: Show all constraint badges equally (loses the destination-specific emphasis), hide read-only fields entirely (violates data fidelity -- consultant must see them to understand the schema).
