# Research: Mapping Integrity Check

## Decision 1: apiName-Based Resolution (Not FK-Based)

**Decision**: The integrity check resolves mappings against the current schema snapshot by `apiName`, not by stored FK IDs.

**Rationale**: Schema refresh creates new `SchemaObject` / `ObjectField` records with new UUIDs. The old snapshot records are rotated to PREVIOUS then deleted. Stored FKs (`ObjectMapping.sourceObjectId`, `FieldMapping.sourceFieldId`, etc.) point at the old snapshot and become dangling after rotation. Resolving by `apiName` against the CURRENT snapshot is the only reliable way to detect what still exists.

This is explicitly codified in the spec's Design Decisions section: no automatic FK re-binding (Principle IX). The integrity check reads by apiName but never writes/mutates FKs.

**Alternatives**: FK-based resolution (would require re-binding FKs during snapshot rotation -- violates Principle IX), storing both FK and apiName with FK as authoritative (apiName would drift from FK, creating confusing states).

## Decision 2: Persisted Issues vs Transient Check Results

**Decision**: `IntegrityIssue` records are persisted in the database.

**Rationale**: The spec requires that "integrity issues are persisted so the consultant can view them across sessions without requiring a re-check" (Assumptions). A transient in-memory result would require re-running the check on every page load, which is wasteful and contradicts the explicit assumption.

Persisted issues also enable:
- Audit trail cross-referencing (issue ID in AuditLog details)
- Resolution tracking (resolvedAt timestamp)
- Dashboard-level status aggregation without re-running checks

**Alternatives**: Transient results computed on-demand (contradicts spec Assumptions), cached in Redis/memory (adds infrastructure complexity for no benefit given Prisma is already available).

## Decision 3: Reuse of Type Compatibility Matrix from 012

**Decision**: The integrity check reuses the exact same type compatibility matrix defined in feature 012 for detecting type-change incompatibilities.

**Rationale**: FR-006 explicitly states "detect and flag field mappings where a type change breaks compatibility according to the type compatibility matrix (feature 012)." Using a different matrix would create divergent behavior between the mapping UI (which shows COMPATIBLE/WARNING/INCOMPATIBLE) and the integrity check (which would flag different type changes as breaking).

The matrix is already implemented as a pure function `getCompatibility(sourceType, destType) -> COMPATIBLE | WARNING | INCOMPATIBLE`. The integrity check calls it with the new type from the refreshed snapshot.

**Alternatives**: Separate stricter matrix for integrity (divergent behavior, maintenance burden), only flagging type changes when the matrix result is INCOMPATIBLE (spec says "breaks compatibility" which includes WARNING->INCOMPATIBLE transitions).

## Decision 4: Check Trigger Strategy

**Decision**: The integrity check runs synchronously after schema refresh completes, triggered by the refresh handler in features 003/007.

**Rationale**: The spec states "The integrity check is a synchronous operation that runs after schema refresh completes" (Assumptions) and "The system MUST perform an integrity check on all migration plans referencing a connection after that connection's schema is refreshed" (FR-001).

The check must run on ALL plans referencing the refreshed connection, not just the currently open plan. This means the refresh handler iterates plans by `sourceConnectionId` or `destinationConnectionId`.

**Alternatives**: Lazy check on plan open (would miss issues until the consultant opens the plan), background job (adds queue infrastructure; the spec says synchronous), webhook from connector (overcomplicates for a local-first v0).

## Decision 5: Performance Target

**Decision**: Target < 5 seconds for a plan with 10 object mappings and 200 field mappings (SC from spec).

**Rationale**: The check is I/O-bound (Prisma queries). With proper eager loading (include ObjectMappings with FieldMappings, MigrationFilters, and MigrationLogic rules in a single query), the check is a single DB round-trip for loading + a batch of apiName lookups against the current snapshot + a batch upsert for issues.

Estimated query plan:
1. Load plan + relations: 1 query (~50ms)
2. Load current snapshot objects + fields for the plan's connections: 2 queries (~50ms each)
3. Compare and collect issues: in-memory (~10ms for 200 fields)
4. Upsert issues + update plan status: 1 transaction (~100ms)
Total: ~260ms, well under 5s.

**Alternatives**: None needed -- the straightforward approach meets the target.

## Decision 6: Issue Resolution Semantics

**Decision**: Resolving an issue means setting `resolvedAt = NOW()`. When ALL issues for a plan are resolved, the plan status transitions back from BROKEN to DRAFT or COMPLETE as appropriate.

**Rationale**: FR-010 requires automatic status transition when all issues are resolved. The resolution can happen in two ways:
1. The consultant deletes or remaps the broken mapping (the issue is auto-resolved when the entity no longer exists or is no longer broken).
2. A subsequent schema refresh no longer detects the issue (the field/object reappeared).

In both cases, the resolver marks `resolvedAt` and checks remaining unresolved issues. If zero remain, it transitions the plan.

**Alternatives**: Explicit "dismiss" action separate from "resolve" (spec doesn't distinguish; both mean the issue is no longer active).

## Decision 7: MigrationFilter and FIELD_REFERENCE Rule Checks

**Decision**: The integrity check also validates MigrationFilters (FR-007) and FIELD_REFERENCE migration logic rules (FR-008) that reference source fields.

**Rationale**: A migration filter referencing a deleted source field would cause the migration to fail silently (filtering on a nonexistent field = no records filtered, or an error). A FIELD_REFERENCE rule referencing a deleted field would produce null/error during transformation. Both must be flagged.

The entityType enum includes `MIGRATION_FILTER` and `TRANSFORMATION_RULE` to distinguish these from object/field mapping issues.

**Alternatives**: Only check object and field mappings (spec explicitly includes filters and rules in FR-007/FR-008).
