# Feature Specification: Destination Schema Retrieval

**Feature**: 007-destination-schema-retrieval
**Created**: 2026-03-27
**Status**: Draft
**Depends on**: 006-destination-connection

## User Story (atomic)

As a consultant, within my migration plan, after connecting the destination, I can retrieve
the full list of destination objects so I know what's available for mapping.

**Independent Test**: After connecting a destination in a plan, the consultant sees the list
of available objects with labels, API names, and custom/standard badges.

**Acceptance Scenarios**:

1. **Given** a connected destination, **When** the schema is retrieved, **Then** all objects
   are displayed with label, API name, standard/custom badge, and description.
2. **Given** a retrieved destination schema, **When** the consultant refreshes, **Then** a diff
   is shown (added/removed/modified objects).
3. **Given** an existing CURRENT snapshot and the consultant is on `/plans/[planId]/destination/schema`, **When** they click "Rafraîchir le schéma", **Then** the **full chain** schema → fields is executed (identical to the refresh button on `/plans/[planId]/destination`), AND the mapping integrity check is triggered at the end. The page must never end in a state where the new snapshot has objects but no fields. <!-- Added: 2026-05-12 -->
4. **Given** the refresh on `/destination/schema` completes and the new snapshot has removed or changed objects/fields referenced by existing mappings, **Then** the integrity check flags those mappings as broken (linkStatus=BROKEN) and the plan status transitions to BROKEN. The consultant must resolve manually (delete or recreate the mapping) — the system never re-binds, re-maps, or deletes automatically. <!-- Added: 2026-05-12 -->

## Functional Requirements

- **FR-001**: The system MUST retrieve all objects from the destination via the adapter.
- **FR-002**: Schema snapshots MUST follow the CURRENT/PREVIOUS rotation (max 2).
- **FR-003**: Schema retrieval MUST be logged to the audit trail.
- **FR-004**: Every refresh trigger — refresh button on `/destination/schema`, refresh button on `/destination`, post-OAuth auto-trigger — MUST execute the **full chain** schema → fields (no partial chain). Destination has no object-selection step (all objects retrieved), but fields retrieval is still mandatory. Any divergence between trigger paths is a bug. <!-- Added: 2026-05-12 -->
- **FR-005**: At the end of every successful refresh, the system MUST trigger the mapping integrity check (`checkMappingIntegrity`, feature 017) for the plan owning the refreshed connection. The integrity check MUST update the plan status to BROKEN if any mapping is found broken, and DRAFT/READY otherwise. No automatic remediation — Principle IX (human-in-the-loop). <!-- Added: 2026-05-12 -->

## Assumptions

- Destination schema retrieval follows the same pattern as source (002-schema-retrieval spec applies).
- Destination objects do not need selection — all are available for mapping.
