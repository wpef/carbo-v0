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

## Key Entities

- **SchemaSnapshot**: A point-in-time capture of a system's object list. Fields: id, connectionId, status (CURRENT | PREVIOUS), retrievedAt, objectCount.
- **SchemaObject**: An object within a snapshot. Fields: id, snapshotId, apiName, label, description, isCustom.

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
