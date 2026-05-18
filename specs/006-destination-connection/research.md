# Research: Destination Connection

## Decision 1: Shared vs Separate Connection Entity

**Decision**: Reuse the single `ConnectorConnection` Prisma model. The `MigrationPlan` has two nullable FK columns: `sourceConnectionId` and `destinationConnectionId`, both pointing to `ConnectorConnection`.

**Rationale**: The spec states "No new entities — uses ConnectorConnection linked to MigrationPlan.destinationConnectionId." Source and destination connections have identical structure (adapter type, config, status, schema snapshot). A single table avoids duplication and lets the adapter registry work uniformly.

**Alternatives**: Separate `SourceConnection` / `DestinationConnection` tables (unnecessary duplication; the only difference is which FK on the plan references them).

## Decision 2: Shared Schema-Diff Service with 002

**Decision**: The `computeSchemaDiff()` and `computeImpactReport()` functions are shared between source (002) and destination (006) reconfiguration. They accept a `side` parameter (`'source' | 'destination'`) that determines which FK columns to query in mappings/rules.

**Rationale**: FR-008 explicitly states "same structure as source-side diff in 002 FR-009." Duplicating the logic would violate Principle VIII (modularity) and create drift risk.

**Alternatives**: Duplicate per-feature (maintenance burden), generic "connection reconfiguration" feature (the spec explicitly rejects this — each side owns its trigger and UX).

## Decision 3: Two-Phase Reconfiguration API

**Decision**: Reconfiguration uses a two-step API: preview (dry-run returning diff + impact) then confirm (atomic apply). Both are POST requests to `/reconfigure` with query params.

**Rationale**: The confirmation dialog (FR-010) needs the impact report before any mutation. A preview endpoint keeps the dialog stateless — no server-side draft to manage, no timeout risk. On confirm, the server re-computes and applies atomically (no TOCTOU risk since the transaction locks the relevant rows).

**Alternatives**: Single endpoint with optimistic UI (risks stale preview), server-side draft with session (complexity, timeout management).

## Decision 4: MVP Refresh Bypasses Cascade

**Decision**: `POST /refresh` (FR-017) overwrites the schema snapshot directly and marks orphaned field mappings as `linkStatus=BROKEN`. No diff dialog, no deletions.

**Rationale**: FR-018 explicitly states this is a deliberate Phase 1 simplification. The `linkStatus=BROKEN` mechanism from the data model is sufficient to surface problems. The full cascade (diff + confirmation + atomic apply) will be enabled in Phase 2.

**Alternatives**: Full cascade on every refresh (rejected by spec for MVP — too disruptive for routine schema checks).

## Decision 5: Post-OAuth Auto-Retrieval Trigger

**Decision**: The destination page detects `?connected=<adapterType>` in the URL (set by the OAuth callback redirect) and auto-triggers schema+fields retrieval via `POST /refresh`.

**Rationale**: FR-016 requires automatic retrieval with no user action. URL query param is the standard OAuth callback mechanism. The page reads the param on mount, calls the refresh endpoint, and shows a loading indicator. The destination chain is simpler than source (no object selection step — schema then fields directly).

**Alternatives**: WebSocket push from callback handler (over-engineered for a single page reload), polling (unnecessary latency).

## Decision 6: Destination Schema Chain (No Object Selection)

**Decision**: The destination schema retrieval chain is `schema -> fields` only. There is no object selection step (unlike source, which has `schema -> object selection -> fields`).

**Rationale**: FR-016 explicitly states "la chaîne complète est schema->fields uniquement." All destination objects are fetched with their fields. This makes sense because the destination needs to expose all available objects for mapping — the consultant selects which ones to map in the mapping step (011), not in the connection step.

**Alternatives**: Add object selection for destination (rejected by spec — unnecessary friction for the destination side).

## Decision 7: Secret Field Handling

**Decision**: On reconfiguration edit mode, secret fields (API keys, tokens, passwords) are rendered as empty inputs. Submitting with empty secret fields means "keep existing secrets." The server never sends secrets to the client.

**Rationale**: FR-006 requires secrets to "remain empty for re-entry (never round-tripped to client)." This is the only safe approach — it prevents accidental exposure. The "keep existing" semantic for blank fields avoids forcing the user to re-enter credentials on every config change. Open question in spec but this is the pragmatic default.

**Alternatives**: Always require re-entry (poor UX for config-only changes), send masked values (still a round-trip risk).
