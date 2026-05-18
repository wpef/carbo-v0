# Research: Source Schema Retrieval

## Decision 1: Snapshot Storage Strategy

**Decision**: Store snapshots as Prisma models (`SchemaSnapshot` + `SchemaObject`) in the tenant's Neon Postgres database.

**Rationale**: Snapshots are queried for diff computation, UI display, and integrity checks. Relational storage enables efficient joins (snapshot -> objects) and indexed lookups by `connectionId` + `status`. The two-snapshot cap (CURRENT + PREVIOUS) keeps storage bounded.

**Alternatives**:
- JSON blob column: simpler write, but querying individual objects for diff or display requires deserializing the entire blob. Rejected for query ergonomics.
- Separate schema cache table: adds indirection without benefit. SchemaObject is already lean.

## Decision 2: Snapshot Rotation Algorithm

**Decision**: Atomic transaction: (1) delete any PREVIOUS snapshot + its objects, (2) update CURRENT to PREVIOUS, (3) insert new snapshot as CURRENT with its objects.

**Rationale**: FR-004 mandates max 2 snapshots. The rotation must be atomic to avoid orphaned states. A single Prisma `$transaction` handles all three steps. If the transaction fails, the existing CURRENT is preserved (FR-009 — no data loss on error).

**Alternatives**:
- Soft-delete with version numbers: more complex, no benefit given the 2-snapshot cap.
- Keep N snapshots with configurable retention: over-engineering for Phase 1.

## Decision 3: Diff Algorithm

**Decision**: Pure function `computeSchemaDiff(current: SchemaObject[], previous: SchemaObject[])` that compares by `apiName` (stable identifier across snapshots).

**Rationale**: The diff is deterministic given two object lists. Comparing by `apiName` is correct because `apiName` is the system-stable identifier (unlike database UUIDs which rotate with each snapshot). The function returns `SchemaDiffResult` (from 000 connector types) listing added, removed, and modified objects.

**Alternatives**:
- Query the external system for its own changelog: not all systems support it, and the spec states diff is computed locally (Assumptions).
- Hash-based change detection: adds complexity; direct comparison is O(n) with a Map lookup and sufficient for 2000 objects.

## Decision 4: Concurrency Guard (FR-007)

**Decision**: Database-level advisory lock using `SELECT pg_advisory_xact_lock(hash)` within the retrieval transaction. The hash is derived from `connectionId`.

**Rationale**: Prevents concurrent retrievals for the same connection without application-level mutexes. Advisory locks are scoped to the transaction and auto-release on commit/rollback. This is simpler and more reliable than a `retrievalInProgress` column which requires cleanup on crash.

**Alternatives**:
- Application-level mutex (in-memory Map): does not work across serverless function instances on Vercel.
- `retrievalInProgress` boolean column: requires explicit cleanup if the process crashes mid-retrieval. Fragile.

## Decision 5: Drift Detection Scope Optimization (FR-016)

**Decision**: `detectLiveDrift` performs two levels of inspection:
1. **Object-level** (all objects): compare stored object list to live object list. Detect `OBJECT_ADDED` / `OBJECT_REMOVED`.
2. **Field-level** (mapped objects only): for each object referenced by an existing `ObjectMapping` in the plan, fetch live fields via `adapter.getFields()` and compare against stored `ObjectField` records. Detect all field-level modification types from the canonical taxonomy.

**Rationale**: FR-016 explicitly allows this as a budget trade-off. Inspecting fields for all objects (potentially hundreds) would exceed the 15-second budget. Restricting field inspection to mapped objects (typically 5-20) keeps it fast. The consultant can run a full refresh to inspect everything.

**Implementation**: The service accepts a `planId` parameter (in addition to `connectionId` and `role`) to look up mapped objects. If no plan context is provided, only object-level drift is returned.

**Alternatives**:
- Full field inspection for all objects: violates the 15s budget for large schemas.
- No field inspection at all: misses critical drift types (FIELD_REMOVED, FIELD_TYPE_CHANGED) that directly impact mappings.

## Decision 6: DriftReport as In-Memory Type (Not Persisted)

**Decision**: `DriftReport` and `DriftChange` are TypeScript types, never written to the database.

**Rationale**: FR-012 explicitly states "no DB write." Drift reports are ephemeral — computed on demand, consumed by the UI, discarded when the session ends. Persisting them would create stale data and synchronization overhead. The plan-reopen trigger in 001 recomputes drift each visit.

**Alternatives**:
- Persist to enable history/analytics: deferred to Phase 2 if needed. No spec requirement.

## Decision 7: Canonical Modification Type Enum

**Decision**: Define a TypeScript string enum `DriftModificationType` with the 12 canonical values from the spec table, plus a `severity` lookup map. Located at `src/features/003-source-schema-retrieval/types/drift.ts`.

**Rationale**: FR-013 mandates that all types come from the canonical table. A string enum is type-safe, extensible (add a row in the spec table, add a value to the enum), and serializable for API responses. The severity map encodes the default severity per type; destination-specific overrides (007 spec) are applied by the caller.

**Alternatives**:
- Union type of string literals: less discoverable, no iteration capability.
- Numeric enum: breaks when serialized to JSON API responses.

## Decision 8: Audit Trail Integration (FR-008)

**Decision**: Reuse the audit trail service from feature 001 (`logAuditEvent`). Each schema retrieval logs: `action: 'SCHEMA_RETRIEVAL'`, `connectionId`, `status: 'success' | 'failure'`, `objectCount`, `diffSummary` (added/removed/modified counts).

**Rationale**: Constitution Principle VI requires every significant operation to be logged. The audit trail is a first-class citizen that feeds contractual documents. Schema retrieval is a significant operation.

**Implementation**: Import and call `logAuditEvent` at the end of `retrieveSchema()` and at the start of error handlers.
