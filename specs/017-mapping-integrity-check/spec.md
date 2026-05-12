# Feature Specification: Mapping Integrity Check

**Feature**: 017-mapping-integrity-check
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 012-field-mapping

## User Story (atomic)

As a consultant, I am notified when schema changes break my existing mappings so I can fix them before attempting a migration. After a schema refresh on either the source or destination connection, the system checks all mapping plans referencing that connection and identifies broken mappings: source fields that no longer exist, destination properties that no longer exist, source or destination objects that no longer exist, and type changes that break compatibility. Broken field mappings and object mappings are clearly marked, and the parent plan status transitions to BROKEN if any issues are found.

**Independent Test**: A consultant has a mapping plan with Contact mapped to Contacts, including a field mapping "CustomField__c to custom_field". The source schema is refreshed and "CustomField__c" no longer exists. The system marks that field mapping as broken (reason: "source field deleted"), the object mapping shows a broken indicator, and the plan status transitions to BROKEN.

**Acceptance Scenarios**:

1. **Given** a mapping plan with field mappings, **When** the source schema is refreshed and a mapped source field no longer exists, **Then** the affected field mapping is marked as broken with reason "source field deleted".
2. **Given** a mapping plan with field mappings, **When** the destination schema is refreshed and a mapped destination property no longer exists, **Then** the affected field mapping is marked as broken with reason "destination property deleted".
3. **Given** a mapping plan with object mappings, **When** the source schema is refreshed and a mapped source object no longer exists, **Then** the affected object mapping is marked as broken with reason "source object deleted", and all its field mappings are also marked as broken.
4. **Given** a mapping plan with field mappings, **When** a schema refresh reveals a type change on a mapped field that breaks compatibility (e.g., string changed to boolean), **Then** the affected field mapping is marked as broken with reason "type change: [old type] to [new type]".
5. **Given** any broken mappings are detected, **When** the integrity check completes, **Then** the parent mapping plan status transitions to BROKEN.
6. **Given** a BROKEN plan, **When** the consultant fixes all broken mappings (remaps or removes them), **Then** the plan status transitions back to DRAFT or COMPLETE as appropriate.

## Edge Cases

- A schema refresh adds new fields or objects: this does not break existing mappings (new additions are not a breaking change). No warnings are raised for additions.
- A field is renamed (old name deleted, new name added): the system treats this as a deletion of the old field. The consultant must manually remap to the new field.
- A field's type changes from "string" to "text" (semantically equivalent): the compatibility matrix determines whether this is a breaking change. If types are compatible, no break is flagged.
- Multiple plans reference the same connection: all plans are checked after a schema refresh on that connection.
- A plan is already BROKEN and a new schema refresh introduces additional breaks: the new issues are added to the existing list of broken mappings.
- The consultant has migration filters referencing a deleted source field: the filter is marked as broken with reason "source field deleted".
- Transformation rules referencing a deleted source field (FIELD_REFERENCE type): the rule is marked as broken with reason "referenced field deleted".

## Functional Requirements

- **FR-001**: The system MUST perform an integrity check on all mapping plans referencing a connection after that connection's schema is refreshed.
- **FR-002**: The system MUST detect and flag field mappings where the source field no longer exists in the refreshed source schema.
- **FR-003**: The system MUST detect and flag field mappings where the destination property no longer exists in the refreshed destination schema.
- **FR-004**: The system MUST detect and flag object mappings where the source object no longer exists in the refreshed source schema.
- **FR-005**: The system MUST detect and flag object mappings where the destination object no longer exists in the refreshed destination schema.
- **FR-006**: The system MUST detect and flag field mappings where a type change breaks compatibility according to the type compatibility matrix (feature 010).
- **FR-007**: The system MUST detect and flag migration filters referencing source fields that no longer exist.
- **FR-008**: The system MUST detect and flag FIELD_REFERENCE transformation rules referencing source fields that no longer exist.
- **FR-009**: The system MUST transition the parent mapping plan status to BROKEN when any integrity issues are found.
- **FR-010**: The system MUST transition the plan status back to DRAFT or COMPLETE when all integrity issues are resolved (broken mappings removed or remapped).
- **FR-011**: The system MUST log all integrity check results (issues found, status transitions) to the audit trail (Constitution Principle VI).

## Key Entities

- **IntegrityIssue**: A transient or persisted record of a detected integrity problem. Has an id, mappingPlanId, entityType (OBJECT_MAPPING | FIELD_MAPPING | MIGRATION_FILTER | TRANSFORMATION_RULE), entityId, issueType (SOURCE_OBJECT_DELETED | DESTINATION_OBJECT_DELETED | SOURCE_FIELD_DELETED | DESTINATION_PROPERTY_DELETED | TYPE_CHANGE_INCOMPATIBLE | REFERENCED_FIELD_DELETED), description, detectedAt, resolvedAt.

## Success Criteria

- Integrity check completes within 5 seconds for a plan with 10 object mappings and 200 field mappings.
- 100% of breaking schema changes are detected -- no broken mapping goes undetected after a schema refresh.
- Broken mappings are clearly distinguishable from healthy mappings in the UI.
- Plan status transitions are automatic and correct after integrity check completion and after issue resolution.
- All integrity check results and status transitions are traceable in the audit trail.

## Assumptions

- Schema refresh is triggered by the connector features (001, 002). The integrity check is triggered as a consequence of a schema refresh, not independently.
- The integrity check compares the current schema snapshot with the mapping plan's references. It does not require the previous schema snapshot.
- The type compatibility matrix used for type change detection is the same matrix defined in feature 010.
- Integrity issues are persisted so the consultant can view them across sessions without requiring a re-check.
- The integrity check is a synchronous operation that runs after schema refresh completes.

## Design Decisions <!-- Added: 2026-05-12 — captured from live test session -->

### No automatic FK re-binding (Principle IX)

When the schema refresh creates new `SchemaObject` / `ObjectField` records (with new UUIDs), the existing `ObjectMapping.sourceObjectId` / `ObjectMapping.destObjectId` / `FieldMapping.sourceFieldId` / `FieldMapping.destFieldId` keep pointing at the **old snapshot's records** (which the rotation demotes to PREVIOUS, then deletes on the next refresh). The FK references therefore become structurally fragile.

**The system does NOT attempt to "heal" these references by name matching.** No automatic re-bind, no fuzzy auto-remap, no silent FK update during snapshot rotation.

Instead:

1. The integrity check runs after every schema refresh (003 FR-011, 007 FR-005).
2. For each mapping, the check resolves `sourceObjectApiName` / `destObjectApiName` / `sourceFieldApiName` / `destFieldApiName` against the **current** snapshot — by name, not by stored FK ID.
3. If the resolution fails (object/field absent in the new snapshot, or type incompatible), the mapping is flagged BROKEN.
4. The plan status transitions to BROKEN.
5. The consultant resolves manually via the UI (delete or recreate the mapping) — banner + per-mapping action.

**Rationale**: A re-bind by apiName could silently bind a mapping to a renamed field that has different semantics (e.g., `customer_id` renamed to `external_id` — same naming pattern, completely different data domain). Forcing the consultant to confirm preserves data fidelity (Principle III). The decision to remap is irreducibly human — the system has no way to know whether the new field is the "same" field semantically.

This decision rules out **explicitly**:

- Auto re-binding by apiName match (read-time or write-time).
- Auto-remap by fuzzy name match (Levenshtein, prefix, etc.).
- Silent FK update during snapshot rotation.
- Automatic deletion of broken mappings on refresh (cascade is opt-in via the repair endpoint).

This decision keeps **in scope**:

- **Read-time resolution by apiName** for displaying broken mappings: `getUnmappedSourceFields(mappingId)`, `getAvailableDestFields(mappingId)`, `listFieldMappings`, etc. MUST resolve the source/destination object's fields against the current snapshot by apiName, not by stored FK. The stored FK is treated as a hint only — never authoritative. This is not "automation" because no data is mutated; it is the only way the UI can render a broken mapping at all.

### Auto-match / auto-link only at initial connection

The existing `autoLink` (object-mapping) and `autoMatchFields` (field-mapping) services run only when the plan has **zero existing mappings for that scope** (first time the consultant opens the mapping page for a fresh pair). They MUST NOT run automatically after a schema refresh that leaves mappings in place but flagged BROKEN. A refreshed plan with broken mappings is not equivalent to a fresh plan — it has consultant decisions embedded that must not be overwritten.

The hook `useFieldMapping` already guards this (`if (!hasMappings && !autoMatchedRef.current)`). The corresponding rule must be enforced everywhere auto-match could be triggered.
