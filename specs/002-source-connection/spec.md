# Feature Specification: Source Connection

**Feature**: 002-source-connection
**Created**: 2026-03-27
**Last updated**: 2026-04-17
**Status**: Draft
**Depends on**: 001-migration-plan, 000-connector-interface
**Impacts (for reconfiguration cascade)**: 003, 004, 005, 011, 012, 013, 015, 017, 019, 020

## User Story (atomic)

As a consultant, within my migration plan, I can connect to a source system by choosing an
adapter type (e.g., Salesforce) and providing credentials. The connection is stored as part
of the plan. I can also **reconfigure** this connection at any time (change adapter, update
credentials, refresh schema) — the system preserves downstream work that remains structurally
valid and invalidates only what is genuinely broken.

**Independent Test**: A consultant opens a plan, clicks "Configure Source", selects "Salesforce"
from the adapter list, authenticates, and sees the connection status as CONNECTED within the plan.

**Acceptance Scenarios — Initial connection**:

1. **Given** a plan with no source connection, **When** the consultant opens the source step,
   **Then** a list of available source adapters is displayed (e.g., Salesforce).
2. **Given** a selected adapter type, **When** the consultant provides valid credentials,
   **Then** the system authenticates and stores the connection linked to the plan.
3. **Given** a connected source, **When** the consultant views the plan, **Then** the source
   step shows CONNECTED with the system name, and the workflow advances to the next step.
4. **Given** a connected source, **When** the consultant disconnects, **Then** dependent data
   (schema, selections) is cleaned up and the step reverts to pending.

**Acceptance Scenarios — Reconfiguration** <!-- Added: 2026-04-17 -->:

5. **Given** a plan with a connected source, **When** the consultant opens the source step,
   **Then** a "Reconfigurer" button is visible alongside the connection status. Clicking it
   re-opens the connection form pre-filled with the current adapter type and non-secret config
   values (secrets remain empty for re-entry).
6. **Given** the consultant is reconfiguring and keeps the same adapter + credentials and the
   refreshed schema is a strict superset of the stored one (no removed objects/fields), **When**
   they submit, **Then** the reconfiguration applies silently with no confirmation dialog.
7. **Given** the consultant reconfigures and the new schema removes an object or field that
   is referenced downstream, **When** they submit, **Then** a confirmation dialog appears
   listing, in plain French: the number of object mappings, field mappings, rules, and filters
   that will be deleted; the number of mappings that will be flagged BROKEN (type changed);
   and whether documents will be marked as `outdated`.
8. **Given** the consultant confirms the destructive reconfiguration, **When** the operation
   completes, **Then** only the broken artifacts are deleted; mappings whose source/destination
   objects and fields still exist with compatible types are preserved; the `linkStatus` of
   affected mappings reflects the new state; documents are marked `outdated` if any downstream
   artifact changed.
9. **Given** the consultant cancels the confirmation dialog, **When** the dialog closes,
   **Then** the connection and all downstream data are byte-identical to before (no partial
   writes).
10. **Given** a reconfiguration that invalidates downstream data, **When** it completes, **Then**
    the plan's `currentStep` is rolled back to the latest still-valid step (see FR-009 rules).

## Edge Cases

- **Adapter type switch** (e.g., `demo` → `salesforce`): same partial-reset logic as a
  credentials refresh — objects/fields whose name matches AND whose normalized type is
  compatible across adapters are preserved; everything else is invalidated.
- **Authentication fails during reconfiguration**: existing connection and all downstream
  data remain untouched. Clear error message. User can retry or cancel.
- **User navigates away mid-reconfiguration**: draft state discarded; original connection
  preserved.
- **Refreshed schema returns empty**: treated as a full cascade — all downstream data is
  invalidated. Dialog clearly warns this is effectively a full reset.
- **Field's type changed but still exists**: the field mapping is flagged `BROKEN`, not
  deleted. Rules referencing it are flagged `needs-review`. User must address manually
  after confirming.
- **Filter references a removed field**: filter is deleted (a filter with a missing field
  is structurally invalid).
- **No change detected**: no-op, no dialog. Audit logs a "refreshed" action.
- **Authentication fails (initial connect)**: clear error message, the step remains pending.

## Functional Requirements

### Connection (initial)

- **FR-001**: The source connection step MUST be accessible only within a plan context.
- **FR-002**: The system MUST display available source adapters from the adapter registry.
- **FR-003**: The connection MUST be stored linked to the plan (planId → sourceConnectionId).
- **FR-004**: Disconnecting MUST cascade-delete dependent data (schema snapshots, selections).
- **FR-005**: A "Use Demo Data" option MUST be available as an alternative to real authentication.
  It creates a mock connection with seeded schema data. Clearly labeled as demo.

### Reconfiguration <!-- Added: 2026-04-17 -->

- **FR-006**: The source page (`/plans/[planId]/source`) MUST display a "Reconfigurer" button
  in the already-connected state. Clicking it transitions the page into edit mode.
- **FR-007**: Edit mode MUST pre-fill the form with the current adapter type and non-secret
  config values. Secret fields (passwords, tokens) MUST remain empty for re-entry (never
  round-tripped to the client).
- **FR-008**: On reconfiguration submit, the system MUST fetch and validate the new schema
  BEFORE any destructive operation.
- **FR-009**: The system MUST compute a **schema diff** between the current stored schema and
  the new schema, producing:
  - `removedObjects`: objects no longer present
  - `removedFields`: per-object, fields no longer present
  - `typeChangedFields`: fields whose normalized type is incompatible with the previously mapped type
  - `addedObjects` / `addedFields`: informational, not destructive
  Type compatibility uses the `normalizeType()` logic from feature 012 (the same bucketing
  that powers link status).
- **FR-010**: The system MUST compute an **impact report** from the schema diff, listing:
  - Object mappings to be deleted (their source object was removed)
  - Field mappings to be deleted (their source field was removed)
  - Field mappings to be flagged `BROKEN` (type became incompatible)
  - Transformation/validation rules to be deleted (referenced field was removed)
  - Transformation/validation rules to be flagged `needs-review` (referenced field's type changed)
  - Migration filters to be deleted (referenced field was removed)
  - Documents to be marked `outdated` (any of the above occurred)
- **FR-011**: If the impact report is non-empty, the system MUST display a confirmation dialog
  summarizing the impact in plain French, consultant-facing. The dialog MUST list at minimum:
  number of mappings deleted, number flagged broken, number of rules affected, whether
  documents will be marked outdated. Full list if ≤ 20 items, else a "show details" expander.
  Cancel and Confirm buttons must be clearly distinct.
- **FR-012**: If the impact report is empty (strict superset or unchanged schema), the system
  MUST apply the reconfiguration silently without a confirmation dialog.
- **FR-013**: On confirm, the system MUST apply all changes atomically (single DB transaction):
  update connection, replace schema snapshot, delete/flag mappings/rules/filters, mark
  documents as outdated.
- **FR-014**: The system MUST log the reconfiguration to the audit trail with the full impact
  report: adapter change summary, schema diff summary, list of artifacts affected.
- **FR-015**: The plan's `currentStep` MUST be rolled back to the latest step that has valid
  data:
  - Any object mapping deleted → rollback to at most `MAPPING`.
  - Any field mapping deleted or flagged BROKEN → rollback to at most `FIELD_MAPPING`.
  - Documents outdated (and no mapping-level impact) → rollback to at most `DOCUMENTS`.
  - Otherwise → current step preserved.
- **FR-016**: Mapping preservation matches on **both** source object/field name AND
  destination object/field name with compatible normalized types. Rename counts as
  removal + addition; no automatic rematch (deferred).

## Key Entities

No new entities. Uses existing `ConnectorConnection` (from 000) linked to
`MigrationPlan.sourceConnectionId`. Reconfiguration touches entities defined in downstream
features:
- `SchemaSnapshot` (003) — replaced atomically
- `ObjectMapping` (011), `FieldMapping` (012) — deleted or flagged
- `TransformationRule` (013), `ValidationRule` (014), `MigrationFilter` (015) — deleted or flagged
- `GeneratedDocument` (019, 020) — `status` may become `OUTDATED` (enum value to be added in
  19/20 data-model when implementing reconfiguration)

## Success Criteria

- **SC-001**: Source connection completes in under 30 seconds (excluding external auth flow time).
- **SC-002**: A consultant can change the source adapter of a plan at any step without losing
  mappings that remain structurally valid.
- **SC-003**: The reconfiguration confirmation dialog is understandable by a non-technical
  stakeholder (plain French, no schema IDs or internal field names).
- **SC-004**: Reconfiguration never leaves the plan in an inconsistent state (orphan mappings,
  rules referencing deleted fields, documents claiming to describe a schema that no longer
  exists).
- **SC-005**: Cancel leaves the plan byte-identical to before the reconfiguration attempt.
- **SC-006**: Impact preview is computed in under 1 second for plans with up to 500 field mappings.

## Assumptions

- The actual auth mechanism is handled by the adapter, not this feature.
- One source per plan.
- Audit trail (001) and link-status logic (012/013) already exist.
- Schema diffing is a pure function: given two `SchemaSnapshot` values, it produces a
  deterministic diff.

## Out of Scope (deferred)

- **Auto-rematch on rename**: if a consultant renames an object (e.g., `Contact` → `Person`)
  in the destination, no fuzzy matching. They must re-create the mapping.
- **Undo reconfiguration**: no one-click rollback. Audit trail records the full diff.
- **Passive schema drift detection**: reconfiguration is triggered by explicit user action
  only. Cron-based detection is out of scope.

## Open Questions (resolve in /speckit.clarify)

1. When a field's type becomes incompatible, should the mapping be flagged `BROKEN` (current
   spec) OR deleted? Consultant preference.
2. If documents are `OUTDATED`, can the plan still be marked READY? Probably no, but confirm.
3. Should secret config fields (passwords, tokens) be considered "unchanged" if the user
   leaves them blank in edit mode, or should a blank always mean "clear/reset"?
4. Impact preview full-list threshold: confirm the 20-item cutoff in FR-011.
5. If the current adapter no longer exists in the registry (deprecated), what happens when
   the user opens the source page? Force reconfiguration?

## Demo Mode

The connection step MAY offer "Use Demo Data" which creates a mock connection with
pre-seeded schema. This replaces real authentication only — the rest of the plan
(mapping, documents) works identically with demo or real connections. Demo is also a
valid adapter type for reconfiguration (switching from/to demo follows the same
partial-reset rules).

## Notes

Reconfiguration logic was integrated here (rather than as a separate feature) on 2026-04-17
during a UX test session. Rationale: the trigger and UX live in this feature; the cascade
touches downstream features but does not warrant a new spec folder — each downstream
feature's own spec already defines the entities and rules that the cascade respects.
