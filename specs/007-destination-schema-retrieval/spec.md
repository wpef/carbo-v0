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

## Drift Detection on Plan Reopen <!-- Added: 2026-05-13 -->

The drift detection algorithm and the **canonical list of modification types** are defined in **spec 003 → "Drift Detection on Plan Reopen"** (single source of truth). Destination uses the same algorithm and the same taxonomy — do not duplicate.

Destination-specific notes:

- **Scope**: destination has no object-selection step (all objects available for mapping), so `detectLiveDrift(connectionId, 'destination')` inspects all objects at object-level. Field-level inspection is still restricted to objects referenced by an existing mapping (per 003 FR-016 budget rule).
- **Severity tuning**: certain destination-side modifications carry extra weight because destination is the WRITE side:
  - `FIELD_BECAME_REQUIRED` on destination → **warning** (was the value being supplied?)
  - `FIELD_READONLY_CHANGED` to readOnly=true on destination → **warning** (write will fail)
  - `FIELD_UNIQUE_CHANGED` to unique=true on destination → **warning** (duplicate writes will fail)
- **FR-D-006** (destination drift): The system MUST call `detectLiveDrift(connectionId, 'destination')` as part of the plan-reopen drift check (driven by spec 001). The destination report MUST be merged with the source report in the plan-level banner. <!-- Added: 2026-05-13 -->

## Acceptance Scenarios (drift detection — destination side) <!-- Added: 2026-05-13 -->

5. **Given** a CONNECTED destination with a stored CURRENT snapshot, **When** drift detection runs as part of plan reopen, **Then** the destination side returns a DriftReport using the canonical taxonomy of spec 003, with severity tuned per destination-specific notes above.
6. **Given** a destination drift detects `FIELD_BECAME_REQUIRED` on a field referenced by an existing field mapping, **When** the banner is rendered, **Then** the change is flagged as **warning** (not info), and the corresponding mapping row on the Field Mapping page (spec 012) highlights the new constraint with a tooltip indicating that a value must now be supplied.

## Assumptions

- Destination schema retrieval follows the same pattern as source (002-schema-retrieval spec applies).
- Destination objects do not need selection — all are available for mapping.
