# Feature Specification: Destination Connection

**Feature**: 006-destination-connection
**Created**: 2026-03-27
**Last updated**: 2026-04-17
**Status**: Draft
**Depends on**: 001-migration-plan, 000-connector-interface
**Impacts (for reconfiguration cascade)**: 007, 008, 011, 012, 013, 015, 017, 019, 020

## User Story (atomic)

As a consultant, within my migration plan, I can connect to a destination system by choosing
an adapter type (e.g., HubSpot) and providing credentials. The connection is stored as part
of the plan. I can also **reconfigure** this connection at any time (change adapter, update
credentials, refresh schema) — the system preserves downstream work that remains structurally
valid and invalidates only what is genuinely broken.

**Independent Test**: A consultant opens a plan that already has a source connected, clicks
"Configure Destination", selects "HubSpot", authenticates, and sees CONNECTED within the plan.

**Acceptance Scenarios — Initial connection**:

1. **Given** a plan, **When** the consultant opens the destination step, **Then** available
   destination adapters are displayed (e.g., HubSpot).
2. **Given** valid credentials, **When** the consultant authenticates, **Then** the connection
   is stored linked to the plan.
3. **Given** a connected destination, **When** the consultant views the plan, **Then** the
   destination step shows CONNECTED and the workflow advances.
4. **Given** a connected destination, **When** the consultant disconnects, **Then** dependent
   data is cleaned up.

**Acceptance Scenarios — Reconfiguration** <!-- Added: 2026-04-17 -->:

5. **Given** a plan with a connected destination, **When** the consultant opens the
   destination step, **Then** a "Reconfigurer" button is visible alongside the connection
   status. Clicking it re-opens the connection form pre-filled with the current adapter type
   and non-secret config values (secrets remain empty for re-entry).
6. **Given** the consultant reconfigures with the same adapter + credentials and the refreshed
   schema is a strict superset of the stored one, **When** they submit, **Then** the
   reconfiguration applies silently with no confirmation dialog.
7. **Given** the consultant reconfigures and the new schema removes a destination object or
   field referenced by existing mappings, **When** they submit, **Then** a confirmation dialog
   appears listing, in plain French: the number of object mappings, field mappings, rules,
   and filters that will be deleted; the number of mappings that will be flagged BROKEN
   (type changed); and whether documents will be marked as `outdated`.
8. **Given** the consultant confirms the destructive reconfiguration, **When** it completes,
   **Then** only the broken artifacts are deleted; mappings whose source/destination objects
   and fields still exist with compatible types are preserved; `linkStatus` reflects the new
   state; documents are marked `outdated` if any downstream artifact changed.
9. **Given** the consultant cancels the confirmation dialog, **When** the dialog closes,
   **Then** the connection and all downstream data are byte-identical to before.
10. **Given** a reconfiguration that invalidates downstream data, **When** it completes,
    **Then** the plan's `currentStep` is rolled back to the latest still-valid step
    (see FR-015 rules).

## Edge Cases

- **Adapter type switch** (e.g., `demo-destination` → `hubspot`): partial-reset logic applies
  — objects/fields matching by name with compatible normalized types are preserved; everything
  else is invalidated.
- **Authentication fails during reconfiguration**: existing connection and downstream data
  remain untouched. Clear error message. User can retry or cancel.
- **Schema Write (022) previously created custom properties**: the custom properties still
  exist remotely, but if they are absent from the refreshed schema snapshot, the partial-reset
  treats them as removed. Audit log flags this as a potential schema drift requiring review.
- **Refreshed schema returns empty**: treated as full cascade; dialog warns it is effectively
  a full reset.
- **Field type changed**: field mapping flagged `BROKEN`, rules referencing it flagged
  `needs-review`, filters referencing it deleted.
- **No change detected**: no-op, no dialog. Audit logs a "refreshed" action.
- **Authentication fails (initial connect)**: clear error message, the step remains pending.

## Functional Requirements

### Connection (initial)

- **FR-001**: The destination connection step MUST be accessible only within a plan context.
- **FR-002**: The system MUST display available destination adapters from the adapter registry.
- **FR-003**: The connection MUST be stored linked to the plan (planId → destinationConnectionId).
- **FR-004**: A "Use Demo Data" option MUST be available as an alternative to real authentication.

### Reconfiguration <!-- Added: 2026-04-17 -->

- **FR-005**: The destination page (`/plans/[planId]/destination`) MUST display a
  "Reconfigurer" button in the already-connected state. Clicking it transitions the page
  into edit mode.
- **FR-006**: Edit mode MUST pre-fill the form with the current adapter type and non-secret
  config values. Secret fields MUST remain empty for re-entry (never round-tripped to client).
- **FR-007**: On reconfiguration submit, the system MUST fetch and validate the new schema
  BEFORE any destructive operation.
- **FR-008**: The system MUST compute a **schema diff** between the current stored schema and
  the new schema (same structure as source-side diff in 002 FR-009):
  - `removedObjects`, `removedFields`, `typeChangedFields`, `addedObjects`, `addedFields`.
  Type compatibility uses the `normalizeType()` logic from feature 012.
- **FR-009**: The system MUST compute an **impact report** listing (same structure as 002 FR-010):
  - Object mappings to be deleted (destination object removed)
  - Field mappings to be deleted (destination field removed)
  - Field mappings to be flagged `BROKEN` (type became incompatible)
  - Rules to be deleted (referenced field removed) or flagged `needs-review` (type changed)
  - Filters to be deleted (referenced field removed — filters are only source-side so this
    bullet is a no-op for destination reconfiguration but is kept for symmetry)
  - Documents to be marked `outdated` (any of the above occurred)
- **FR-010**: If the impact report is non-empty, the system MUST display a confirmation dialog
  summarizing the impact in plain French. Full list if ≤ 20 items, else "show details"
  expander. Cancel and Confirm buttons must be clearly distinct.
- **FR-011**: If the impact report is empty, the reconfiguration MUST apply silently without
  a confirmation dialog.
- **FR-012**: On confirm, the system MUST apply all changes atomically (single DB transaction):
  update connection, replace schema snapshot, delete/flag mappings/rules, mark documents
  outdated.
- **FR-013**: The system MUST log the reconfiguration to the audit trail with the full impact
  report: adapter change summary, schema diff summary, list of artifacts affected.
- **FR-014**: Mapping preservation matches on **both** source object/field name AND
  destination object/field name with compatible normalized types. No automatic rematch on
  rename.
- **FR-015**: The plan's `currentStep` MUST be rolled back to the latest still-valid step
  (same rules as 002 FR-015):
  - Any object mapping deleted → rollback to at most `MAPPING`.
  - Any field mapping deleted or flagged BROKEN → rollback to at most `FIELD_MAPPING`.
  - Documents outdated (and no mapping-level impact) → rollback to at most `DOCUMENTS`.
  - Otherwise → current step preserved.

## Key Entities

No new entities — uses `ConnectorConnection` linked to `MigrationPlan.destinationConnectionId`.
Reconfiguration touches entities defined in downstream features (007, 008, 011, 012, 013, 015,
019, 020). See 002 spec for the full list.

## Success Criteria

- **SC-001**: Destination connection completes in under 30 seconds.
- **SC-002**: A consultant can change the destination adapter of a plan at any step without
  losing mappings that remain structurally valid.
- **SC-003**: Reconfiguration never leaves the plan in an inconsistent state.
- **SC-004**: Cancel leaves the plan byte-identical to before the reconfiguration attempt.

## Assumptions

- One destination per plan.
- The actual auth mechanism is handled by the adapter.
- Audit trail (001), link-status logic (012/013), and schema-diff capability (see 002 FR-009)
  exist.

## Out of Scope (deferred)

- Auto-rematch on rename (same as 002 — deferred).
- Undo reconfiguration (same as 002).
- Passive schema drift detection (same as 002).

## Open Questions (resolve in /speckit.clarify — shared with 002)

Same open questions as 002: BROKEN-vs-delete policy, documents/READY gating, secret-field
blank semantics, impact-preview threshold, deprecated-adapter handling.

## Notes

Reconfiguration logic was integrated here (rather than as a separate feature) on 2026-04-17.
Rationale: this feature owns the trigger (the destination connection) and the UX; the
downstream entities affected by the cascade are already defined in their own feature specs
and need no duplication. The symmetric 002 spec (source) contains the canonical FR-009
(schema diff structure) and FR-010 (impact report structure) — this spec references them
rather than duplicating.
