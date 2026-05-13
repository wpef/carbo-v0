# Feature Specification: Source Schema Retrieval

**Feature**: 003-source-schema-retrieval
**Created**: 2026-03-27
**Status**: Draft
**Depends on**: 002-source-connection

## User Story (atomic)

As a consultant, I can retrieve the full list of objects from a connected system and see what changed since last time, so that I have an accurate and up-to-date understanding of the system's data model before selecting objects for migration.

**Independent Test**: A consultant with an active connection triggers schema retrieval, sees all objects listed with labels and API names, refreshes the schema after a simulated change, and sees a diff highlighting added/removed/modified objects.

**Acceptance Scenarios**:

1. **Given** an active connection (status CONNECTED), **When** the consultant triggers schema retrieval, **Then** the system fetches all available objects from the connected system and displays them with: label, API name, standard/custom badge, and description (when available).
2. **Given** a successful schema retrieval, **When** the system saves the snapshot, **Then** it is stored as CURRENT. If a CURRENT snapshot already exists, it is demoted to PREVIOUS. Only two snapshots are retained (CURRENT + PREVIOUS).
3. **Given** a CURRENT and PREVIOUS snapshot exist, **When** the consultant triggers a schema refresh, **Then** the system retrieves the latest schema, saves it as the new CURRENT, and computes a diff: added objects, removed objects, and modified objects (field changes).
4. **Given** a schema diff with changes, **When** the consultant views the diff, **Then** added objects are clearly marked as new, removed objects are flagged with a warning, and modified objects show what changed.
5. **Given** schema retrieval fails (network error, permissions), **When** the error occurs, **Then** the system displays a clear error message and retains the existing CURRENT snapshot (no data loss).
6. **Given** an existing CURRENT snapshot and the consultant is on `/plans/[planId]/source/schema`, **When** they click "Rafraîchir le schéma", **Then** the **full chain** schema → objects → fields is executed (identical to the refresh button on `/plans/[planId]/source`), AND the mapping integrity check is triggered at the end. The page must never end in a state where the new snapshot has objects but no fields. <!-- Added: 2026-05-12 -->
7. **Given** the refresh on `/source/schema` completes and the new snapshot has removed or changed objects/fields referenced by existing mappings, **Then** the integrity check flags those mappings as broken (linkStatus=BROKEN) and the plan status transitions to BROKEN. The consultant must resolve manually (delete or recreate the mapping) — the system never re-binds, re-maps, or deletes automatically. <!-- Added: 2026-05-12 -->

## Edge Cases

- The connected system has zero objects: the schema is saved as an empty list, no error is raised.
- The connected system has 1000+ objects: the retrieval completes without timeout and displays the full list.
- An object has no description: the description field is displayed as empty, not omitted.
- Schema retrieval is triggered while a previous retrieval is in progress: the system prevents concurrent retrievals and informs the consultant.
- The PREVIOUS snapshot is the first-ever snapshot (no earlier one existed): diff shows all objects as "added".
- The consultant refreshes the schema and nothing has changed: the diff shows "No changes detected".

## Functional Requirements

- **FR-001**: The system MUST retrieve the complete list of objects (standard and custom) from the connected system via the connector adapter.
- **FR-002**: Each object in the retrieved schema MUST include: apiName, label, description (optional), and isCustom flag.
- **FR-003**: The system MUST persist each schema retrieval as a snapshot with a timestamp and a status (CURRENT or PREVIOUS).
- **FR-004**: The system MUST retain at most two snapshots per connection: CURRENT and PREVIOUS. When a new snapshot is saved, the old CURRENT becomes PREVIOUS, and any older snapshot is deleted.
- **FR-005**: The system MUST compute a diff between CURRENT and PREVIOUS snapshots, identifying: added objects, removed objects, and modified objects (with field-level detail when available).
- **FR-006**: The system MUST display the schema diff to the consultant when a refresh is performed.
- **FR-007**: The system MUST prevent concurrent schema retrievals for the same connection.
- **FR-008**: The system MUST log every schema retrieval (success, failure, diff summary) to the audit trail.
- **FR-009**: Schema retrieval MUST NOT fail silently. Any error MUST be reported to the consultant with a clear message.
- **FR-010**: Every refresh trigger — refresh button on `/source/schema`, refresh button on `/source`, post-OAuth auto-trigger — MUST execute the **full chain** schema → objects → fields (no partial chain). Any divergence between trigger paths is a bug. <!-- Added: 2026-05-12 -->
- **FR-011**: At the end of every successful refresh, the system MUST trigger the mapping integrity check (`checkMappingIntegrity`, feature 017) for the plan owning the refreshed connection. The integrity check MUST update the plan status to BROKEN if any mapping is found broken, and DRAFT/READY otherwise. No automatic remediation (no re-bind, no auto-delete, no auto-remap) — Principle IX (human-in-the-loop). <!-- Added: 2026-05-12 -->

## Drift Detection on Plan Reopen <!-- Added: 2026-05-13 -->

### Concept

The CURRENT/PREVIOUS diff (FR-005) compares two **persisted** snapshots. **Drift detection** is the complementary concept: it compares the CURRENT snapshot to a **live re-fetch** of the connected system, without writing to the DB. The result is a categorized `DriftReport` consumed by:
- the plan-layout banner (001),
- the workflow sidebar badges (001),
- contextual highlighting on the object/field mapping pages (011, 012).

The drift check is **read-only** — it surfaces information; it never mutates the stored snapshot. The consultant explicitly clicks "Rafraîchir le schéma" to apply changes (which then runs the full chain + integrity check per FR-010/011 above). Constitution Principle IX.

The trigger and banner UX live in spec 001 (this is plan-level behavior). This spec owns the **detection algorithm** and the **canonical taxonomy of modification types**.

### Canonical list of modification types (single source of truth — extend HERE only)

This table is **the** reference for what counts as a schema modification. Any other spec (007, 011, 012, 017, 001) that needs to refer to modification types MUST point at this table, not duplicate it. Adding a new type = adding a row here, then propagating the typed enum to consumers.

| # | Type ID | Description | Severity | Impact on existing mappings |
|---|---------|-------------|----------|------------------------------|
| 1 | `OBJECT_ADDED` | A new object appears in the connected system | info | None — newly available for mapping |
| 2 | `OBJECT_REMOVED` | An object disappeared from the connected system | critical | Any mapping referencing it becomes BROKEN |
| 3 | `FIELD_ADDED` | A new field appears on an existing object | info | None — newly available for mapping |
| 4 | `FIELD_REMOVED` | A field disappeared from an existing object | critical | Field mappings referencing it become BROKEN |
| 5 | `FIELD_TYPE_CHANGED` | A field's `dataType` changed | critical if compatibility regresses to `INCOMPATIBLE`, otherwise info | Field mapping flagged BROKEN if regression |
| 6 | `FIELD_BECAME_REQUIRED` | `isRequired` flipped to true (was optional) | warning | Destination especially: source must supply a value |
| 7 | `FIELD_BECAME_OPTIONAL` | `isRequired` flipped to false (was required) | info | None |
| 8 | `FIELD_LABEL_CHANGED` | Display `label` of a field changed | info | UI label refresh; no impact on data |
| 9 | `PICKLIST_VALUE_ADDED` | A new value appears in a picklist field | warning if a D1 (Value Equivalence) exists for that mapping | Source: new value to equivalence. Destination: new target available. |
| 10 | `PICKLIST_VALUE_REMOVED` | A value disappeared from a picklist field | warning if referenced in a D1 equivalence | D1 equivalences referencing it become stale |
| 11 | `FIELD_READONLY_CHANGED` | `isReadOnly` flag flipped | warning (destination) | Destination: may block writes |
| 12 | `FIELD_UNIQUE_CHANGED` | `isUnique` flag flipped | warning | Validation rules may need review |

**Severity ladder**:
- `info` — no required action; informational only
- `warning` — review recommended; mapping may still work but logic should be revisited
- `critical` — mapping is or will become BROKEN; requires consultant intervention

**Extension policy**: if a new modification type is discovered in a live test or via a new connector that exposes additional metadata (e.g., HubSpot field calculation status, Salesforce field history tracking), add a new row above with a stable Type ID, then update the enum at `src/lib/types/drift.ts` and all consumer sites. Never silently introduce a new type that doesn't appear in this table.

### Acceptance Scenarios (drift detection)

8. **Given** a CONNECTED source with a stored CURRENT snapshot, **When** `detectLiveDrift(connectionId, 'source')` is called, **Then** the system performs a live re-fetch via the adapter (object list + fields for mapped objects), compares against CURRENT, and returns a `DriftReport` listing every difference categorized per the canonical table — without writing anything to the DB.
9. **Given** a drift detection returns at least one critical or warning change, **When** the plan layout (001) decides whether to show the banner, **Then** the banner is shown with categorized counts. Info-only drift may also be shown (lower visual weight) per 001's banner spec.
10. **Given** the live re-fetch fails (network error, rate limit, expired token), **When** `detectLiveDrift` runs, **Then** it returns `{ status: 'unavailable', reason }` without throwing — the banner falls back to a "couldn't check drift" state offering a manual refresh.

### Functional Requirements (drift detection)

- **FR-012** (Drift detection — service function): The system MUST expose `detectLiveDrift(connectionId, role)` that fetches the live schema via the adapter and compares it to the CURRENT snapshot, returning a categorized `DriftReport`. **Read-only**: no DB write, no snapshot rotation, no integrity-check trigger. <!-- Added: 2026-05-13 -->
- **FR-013** (Canonical taxonomy): The `DriftReport` MUST categorize every change according to the canonical table above. New modification types MUST be added to the table (single source of truth) BEFORE being emitted by the detector. Any other spec referencing types MUST point here. <!-- Added: 2026-05-13 -->
- **FR-014** (Idempotence + budget): `detectLiveDrift` MUST be safe to call repeatedly (idempotent, no side effects), throttle-friendly, and complete within 15 seconds for a connection with up to 20 mapped objects. The trigger (in 001) is responsible for not calling it more than once per "plan reopen" event. <!-- Added: 2026-05-13 -->
- **FR-015** (Graceful failure): If the live re-fetch fails, `detectLiveDrift` MUST return a structured error (`{ status: 'unavailable', reason }`), not throw. The UI surfaces this as a degraded banner and offers manual refresh. <!-- Added: 2026-05-13 -->
- **FR-016** (Scope optimization): To stay within the time budget, `detectLiveDrift` MAY restrict its field-level inspection to objects that are referenced by an existing mapping in the plan. Unmapped objects are inspected at object-level only (added/removed), not field-level. Documented as a budget trade-off, not a correctness compromise — the consultant can run a full refresh to inspect everything. <!-- Added: 2026-05-13 -->

## Key Entities

- **SchemaSnapshot**: A point-in-time capture of a system's object list. Fields: id, connectionId, status (CURRENT | PREVIOUS), retrievedAt, objectCount.
- **SchemaObject**: An object within a snapshot. Fields: id, snapshotId, apiName, label, description, isCustom.
- **DriftReport** <!-- Added: 2026-05-13 -->: In-memory (NOT persisted) report returned by `detectLiveDrift`. Fields: `connectionId`, `role`, `checkedAt`, `status` ('ok' | 'drift' | 'unavailable'), `changes: DriftChange[]`, `severitySummary: { critical, warning, info }`, optional `reason` when status='unavailable'.
- **DriftChange** <!-- Added: 2026-05-13 -->: A single change entry. Fields: `type` (one of the canonical Type IDs), `objectApiName`, `fieldApiName?`, `before?`, `after?`, `severity` ('info' | 'warning' | 'critical'), `affectsMapping: boolean` (true if there's an existing ObjectMapping or FieldMapping in the plan that references this object/field).

## Success Criteria

- **SC-001**: A full schema retrieval completes in under 60 seconds for a system with up to 2000 objects.
- **SC-002**: 100% of objects reported by the connector adapter are present in the saved snapshot (no silent omissions).
- **SC-003**: Schema diff correctly identifies all added, removed, and modified objects when comparing two snapshots.
- **SC-004**: All schema retrieval events are traceable in the audit trail.

## Assumptions

- The connector adapter provides a method to retrieve all objects with their metadata (label, apiName, description, isCustom).
- Schema retrieval is a read-only operation on the connected system.
- The diff is computed locally by comparing the two persisted snapshots, not by querying the external system for changes.
- Object-level diff is sufficient for this feature; field-level diff detail is included when field metadata is available in the snapshot.
