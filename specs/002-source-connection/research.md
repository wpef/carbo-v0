# Research: Source Connection

## Decision 1: Schema Snapshot Storage Format

**Decision**: Store schema snapshots as a Prisma `Json` column on a `SchemaSnapshot` model, containing the full `ConnectorSchema` (objects array with nested fields).

**Rationale**: The spec says feature 003 owns `SchemaSnapshot`, but 002 needs to store/replace snapshots at connection time and during refresh. A single JSON column preserves the full schema tree atomically. Prisma's `Json` type maps to Postgres `jsonb`, which supports indexing if needed later. The snapshot is always replaced wholesale (never partially updated), making JSON simpler than a normalized relational model.

**Alternatives**: (a) Normalized tables for objects/fields -- higher write complexity for atomic replacement, premature for Phase 1. (b) File-based storage -- breaks DB-per-tenant model and Vercel constraints.

## Decision 2: Schema Diff as Pure Function

**Decision**: `computeSchemaDiff(oldSnapshot, newSnapshot)` is a pure function with no DB access. It takes two `ConnectorSchema` values and returns a `SchemaDiffResult` with `removedObjects`, `removedFields`, `typeChangedFields`, `addedObjects`, `addedFields`.

**Rationale**: FR-009 explicitly states "schema diffing is a pure function." Keeping it pure enables easy unit testing, deterministic behavior, and reuse by downstream features (003 drift detection, 012 link status). The function compares objects by `apiName` and fields by `apiName` within each object. Type compatibility uses `normalizeType()` bucketing.

**Alternatives**: (a) DB-level diff (store old + new, query differences) -- unnecessarily complex for in-memory snapshots of modest size. (b) Deep object diff library -- over-generic, we need domain-specific diff semantics (type compatibility, not structural equality).

## Decision 3: Type Normalization Bucketing

**Decision**: Create a `normalizeType(rawType: string): string` function that maps system-specific types to canonical buckets: `text`, `number`, `boolean`, `date`, `datetime`, `picklist`, `multipicklist`, `lookup`, `binary`, `unknown`.

**Rationale**: FR-009 references `normalizeType()` from feature 012. The function is needed here for schema diff type comparison. Keeping the buckets small (10 categories) covers Salesforce (~30 types) and HubSpot (~15 types) without an exhaustive enum. Two fields are type-compatible if they normalize to the same bucket.

**Alternatives**: (a) Exact string match -- too strict, would flag `string` vs `text` as incompatible. (b) Large enum per system -- breaks system-agnostic design (000 Decision 2).

## Decision 4: Impact Report Computation

**Decision**: `computeImpactReport(schemaDiff, existingMappings)` queries the DB for downstream artifacts referencing removed/changed objects/fields, then returns counts and item lists without modifying anything.

**Rationale**: FR-010 requires listing impacted artifacts before confirmation. Separating read (preview) from write (apply) enables the cancel-safe flow (SC-005). The function queries `ObjectMapping`, `FieldMapping`, `MigrationLogic`, `MigrationFilter`, and `GeneratedDocument` tables. For Phase 1, if downstream tables don't exist yet, the queries return empty results gracefully.

**Alternatives**: (a) Combined preview+apply -- violates cancel safety. (b) Client-side computation -- client doesn't have full mapping data.

## Decision 5: Atomic Reconfiguration Transaction

**Decision**: `applyReconfiguration()` runs all mutations in a single Prisma interactive transaction: update connection, replace schema snapshot, delete/flag mappings/rules/filters, mark documents outdated, update plan's `currentStep`.

**Rationale**: FR-013 requires atomicity. Prisma interactive transactions (`$transaction([...])`) run all operations in a single DB transaction. If any step fails, the entire transaction rolls back, satisfying SC-005 (byte-identical on failure).

**Alternatives**: (a) Sequential operations with manual rollback -- error-prone, partial state possible. (b) Optimistic locking + retry -- unnecessary complexity for a single-user-per-tenant model.

## Decision 6: Auto-Recovery After OAuth Callback

**Decision**: The source page client component detects `?connected=<adapterType>` in the URL on mount and automatically triggers the schema fetch chain (FR-017). The URL param is consumed (removed from history via `replaceState`) to prevent re-triggering on refresh.

**Rationale**: OAuth callbacks redirect to the source page with a query param. The auto-recovery must fire exactly once without user interaction. Using `useEffect` on mount with the URL param as signal is the simplest approach compatible with Next.js App Router.

**Alternatives**: (a) Server-side detection in the page component -- would require server action to trigger fetch, adding a round trip. (b) Middleware-based redirect -- overengineered for a single param check.

## Decision 7: Phase 1 Refresh Simplification

**Decision**: Auto-refresh (FR-017) and manual refresh (FR-018) replace the schema snapshot without computing a diff or showing a confirmation dialog. Orphaned downstream references are flagged `linkStatus=BROKEN` by the existing link-status mechanism.

**Rationale**: FR-019 explicitly states this is a deliberate Phase 1 simplification. The full cascade (FR-007 to FR-013) applies in Phase 2. This avoids blocking the MVP on features 011-015 which may not exist yet.

**Alternatives**: (a) Full cascade from day one -- depends on downstream tables that may not exist in Phase 1. (b) No refresh at all -- blocks the consultant from updating stale schemas.

## Decision 8: Secret Handling in Reconfiguration

**Decision**: When pre-filling the reconfiguration form (FR-007), secret fields (passwords, OAuth tokens, API keys) are never sent to the client. The form shows empty fields for secrets. On submit, if a secret field is blank and the adapter type hasn't changed, the server-side logic preserves the existing secret from the stored connection config.

**Rationale**: Never round-tripping secrets to the client is a fundamental security requirement. The "blank = keep existing" semantics avoids forcing re-entry when only non-secret config changes. If the adapter type changes, all credentials must be re-entered (new adapter, new auth).

**Alternatives**: (a) Always require re-entry -- poor UX for minor config tweaks. (b) Send masked secrets -- still a security risk if the mask is reversible. (c) Separate "change credentials" sub-flow -- overengineered for Phase 1.
