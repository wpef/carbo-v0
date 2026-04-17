# Feature Specification: Connection Reconfiguration (Smart Partial Reset)

**Feature**: 023-connection-reconfiguration
**Created**: 2026-04-17
**Status**: Draft — not yet implemented
**Depends on**: 002-source-connection, 006-destination-connection, 003-source-schema-retrieval, 007-destination-schema-retrieval, 011-object-mapping, 012-field-mapping, 013-transformation-rules, 015-migration-filters

## Context & Motivation

Today, once a source or destination connection is established (`status === 'CONNECTED'`), the
corresponding step page (`/plans/[planId]/source`, `/plans/[planId]/destination`) displays only a
static "already connected" message with no way to change credentials, switch adapter type, or
trigger a schema refresh. The consultant is **locked** into the initial choice.

Inspiration: **n8n's node editing UX** — changing an upstream node marks downstream nodes as
potentially invalid, but the user controls when/how to propagate.

## User Story (atomic)

As a consultant, I can reconfigure the source or destination connection of an existing plan
(change adapter, update credentials, refresh schema). The system detects which downstream
artifacts (object mappings, field mappings, rules, filters, documents) remain valid vs. became
obsolete, invalidates only the obsolete ones, and shows me exactly what will be lost before I
confirm.

**Independent Test**: A consultant with a plan at the `DOCUMENTS` step opens the source page,
clicks "Reconfigurer", changes the adapter type from `demo` to `salesforce`, sees a preview
listing "3 object mappings, 14 field mappings, 2 rules will be removed because the schemas
differ", confirms, and lands back at the source step with only the still-valid mappings
preserved.

## Acceptance Scenarios

1. **Given** a plan with a connected source, **When** the consultant opens the source step,
   **Then** a "Reconfigurer" button is visible alongside the connection status, and clicking it
   re-opens the connection form pre-filled with the current adapter type and (non-secret) config
   values.
2. **Given** the consultant is reconfiguring and keeps the same adapter type with same
   credentials, **When** they submit, **Then** the schema is refreshed. If the new schema is
   strictly a superset of the old one (no removed objects/fields), no downstream data is
   invalidated and no confirmation dialog appears.
3. **Given** the consultant is reconfiguring and the new schema removes object `Contact`,
   **When** they submit, **Then** a confirmation dialog appears listing: the removed object,
   the N object mappings referencing it, the M field mappings, the K rules/filters, and the
   documents that will be marked as `outdated`.
4. **Given** the consultant confirms the destructive reconfiguration, **When** the operation
   completes, **Then** only the broken artifacts are deleted; mappings whose source and
   destination objects/fields still exist and have compatible types are preserved; the
   `linkStatus` of any affected mapping reflects the new state.
5. **Given** the consultant cancels the confirmation dialog, **When** the dialog closes,
   **Then** the connection is NOT reconfigured and no data is modified.
6. **Given** the consultant switches the adapter **type** (e.g., `demo` → `salesforce`),
   **Then** the same partial-reset logic applies: objects/fields with matching names AND
   compatible types across adapters are preserved; everything else is invalidated.
7. **Given** the consultant is on a step downstream of SOURCE/DESTINATION, **When** a
   reconfiguration invalidates their current step's data, **Then** the plan's `currentStep`
   is rolled back to the latest still-valid step.
8. **Given** a reconfiguration that invalidates at least one mapping, **When** it completes,
   **Then** the plan's documents (text + contractual) are marked as `outdated` and must be
   regenerated before the plan can be marked READY.

## Edge Cases

- **No change detected**: User submits reconfiguration with identical adapter type, credentials,
  and resulting schema. Operation is a no-op, no confirmation dialog, but audit log records the
  "refreshed" action.
- **Connection fails during reconfiguration**: The existing connection and all downstream data
  remain untouched. Clear error message. User can retry or cancel.
- **User partially reconfigures then navigates away**: Draft state is discarded; the original
  connection is preserved.
- **Schema refresh returns empty**: Treated as a full cascade — all downstream data is
  invalidated. Confirmation dialog clearly warns this is effectively a full reset.
- **Rule references a field that still exists but whose type changed**: The field mapping is
  flagged `BROKEN` (not deleted), and the rule is marked `needs-review` (not deleted).
  The user sees this in the preview dialog and must address it manually after confirming.
- **Filter references a removed field**: The filter is deleted (a filter with a missing field
  is structurally invalid).
- **Adapter type change where source credentials are no longer provided**: Standard auth flow,
  form validation applies before any destructive action.

## Functional Requirements

- **FR-001**: The source page (`/plans/[planId]/source`) and destination page
  (`/plans/[planId]/destination`) MUST display a "Reconfigurer" button in the
  already-connected state. Clicking it transitions the page into edit mode.
- **FR-002**: Edit mode MUST pre-fill the form with the current adapter type and non-secret
  config values. Secret fields (passwords, tokens) MUST remain empty for re-entry (never
  round-tripped to the client).
- **FR-003**: On reconfiguration submit, the system MUST fetch the new schema BEFORE any
  destructive operation.
- **FR-004**: The system MUST compute a **schema diff** between the current stored schema and
  the new schema, producing:
  - `removedObjects`: objects no longer present
  - `removedFields`: per-object, fields no longer present
  - `typeChangedFields`: fields whose type is incompatible with the previously mapped type
  - `addedObjects` / `addedFields`: informational, not destructive
- **FR-005**: The system MUST compute an **impact report** from the schema diff, listing:
  - Object mappings to be deleted (their source or destination object was removed)
  - Field mappings to be deleted (their source or destination field was removed)
  - Field mappings to be flagged `BROKEN` (type became incompatible)
  - Transformation rules to be deleted (referenced field was removed)
  - Transformation rules to be flagged `needs-review` (referenced field's type changed)
  - Migration filters to be deleted (referenced field was removed)
  - Documents to be marked `outdated` (any of the above occurred)
- **FR-006**: If the impact report is non-empty, the system MUST display a confirmation dialog
  summarizing the impact in plain French (consultant-facing). The dialog MUST list, at
  minimum: number of mappings deleted, number of mappings marked broken, number of rules
  affected, whether documents will be marked outdated. Cancel and Confirm must be clearly
  distinct.
- **FR-007**: If the impact report is empty (schema is a superset or unchanged), the system
  MUST apply the reconfiguration silently without a confirmation dialog.
- **FR-008**: On confirm, the system MUST apply all changes atomically (single DB transaction):
  update connection, replace schema snapshot, delete/flag mappings/rules/filters, mark
  documents as outdated.
- **FR-009**: The system MUST log the reconfiguration to the audit trail with full impact
  report as details: adapter change, schema diff summary, and impact report.
- **FR-010**: The plan's `currentStep` MUST be rolled back to the latest step that has valid
  data after reconfiguration. Rules for rollback:
  - Documents outdated → rollback to at most `DOCUMENTS` (user must regenerate).
  - Any field mapping deleted/broken → rollback to at most `FIELD_MAPPING`.
  - Any object mapping deleted → rollback to at most `MAPPING`.
  - Otherwise → current step preserved.
- **FR-011**: Field mapping type compatibility MUST use the existing normalization logic from
  feature 012 (i.e., `normalizeType()` to bucket types). Two adapters may label the same type
  differently (`enumeration` vs `picklist`); the mapping is preserved if both normalize to the
  same bucket.
- **FR-012**: Mapping preservation MUST match on **both** source object/field name AND
  destination object/field name. Renaming an adapter's object from `Contact` to `Person`
  counts as a removal + addition — the old mapping is deleted, no automatic rematch.
- **FR-013**: The reconfiguration dialog MUST show the full list of affected artifacts if
  ≤ 20 items total, or a summary with "show details" expander above that threshold.

## Key Entities

No new entities. This feature operates on existing entities defined in features 002, 003, 006,
007, 011, 012, 013, 015, 019, 020:
- `ConnectorConnection` — credentials updated, status may change
- `SchemaSnapshot` — replaced atomically
- `ObjectMapping`, `FieldMapping` — deleted or flagged
- `TransformationRule`, `ValidationRule`, `MigrationFilter` — deleted or flagged
- `GeneratedDocument` — `status` field set to `OUTDATED` (new enum value to add; tracked
  in `data-model.md` update when implementing)

## Success Criteria

- **SC-001**: A consultant can change the source adapter of a plan at any step without
  losing mappings that are still structurally valid.
- **SC-002**: The confirmation dialog is understandable by a non-technical stakeholder
  (plain French, no schema IDs or internal field names).
- **SC-003**: Reconfiguration never leaves the plan in an inconsistent state (orphan mappings,
  rules referencing deleted fields, documents claiming to describe a schema that no longer
  exists).
- **SC-004**: If the user cancels, the plan is byte-identical to before the reconfiguration
  attempt (no side effects, no partial writes).
- **SC-005**: The impact preview is computed in under 1 second for plans with up to 500
  field mappings.

## Assumptions

- Schema diffing is a pure function: given two `SchemaSnapshot` values, it produces a
  deterministic diff.
- Audit trail (feature 001) and link status logic (features 012/013) already exist and do
  not need to be redesigned.
- The connection form (features 002/006) is already componentized enough to be reused in
  "edit mode" without major refactor.

## Out of Scope (Deferred)

- **Auto-rematch on rename**: If a consultant renames an object from `Contact` to `Person`
  in the destination, we do not attempt fuzzy matching. They must re-create the mapping.
  (Could be a future feature 025-auto-rematch.)
- **Undo reconfiguration**: No undo button. The audit trail records the full diff, but there
  is no one-click rollback. Phase 2 could add this (JSON export/import in 024 makes it
  partly redundant).
- **Real-time schema drift detection**: This feature is triggered by explicit user action.
  Passive detection (e.g., cron job noticing a schema change in Salesforce) is out of scope.

## Open Questions (resolve in /speckit.clarify)

1. When a field's type becomes incompatible, should the mapping be flagged `BROKEN` (current
   spec) OR deleted? Consultant preference.
2. If documents are `OUTDATED`, can the plan still be marked READY? Probably no, but confirm.
3. Should secret config fields (passwords, tokens) be considered "unchanged" if the user
   leaves them blank in edit mode, or should a blank always mean "clear/reset"?
4. Impact preview: show item counts only, or the full list of object/field names?
   (FR-013 proposes a hybrid — confirm threshold.)
5. If the current source/destination adapter no longer exists in the registry (deprecated
   adapter), what happens when the user opens the source page? Force reconfiguration?

## Related Features

- **002-source-connection, 006-destination-connection**: initial connection creation; these
  specs must be updated to cross-reference this feature for the reconfiguration flow (a
  one-liner in each FR list pointing to 023).
- **017-mapping-integrity-check**: already detects broken mappings after schema changes.
  This feature builds on 017's logic to produce the impact report.
- **019/020-documents**: must add an `OUTDATED` status to `GeneratedDocument` so users know
  they need to regenerate.

## Notes

- This feature was identified during the 2026-04-17 UX test session: the consultant could
  not re-enter the source/destination steps once connected. A full cascade was discussed
  but rejected in favor of a partial-reset approach that preserves the consultant's work
  whenever possible.
