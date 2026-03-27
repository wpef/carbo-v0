# Feature Specification: Object Selection

**Feature**: 003-object-selection
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 002-schema-retrieval

## User Story (atomic)

As a consultant, I can select which objects are relevant for migration from the full list, with smart defaults and filters, so that downstream features (field retrieval, mapping, migration) only work with objects I care about and I am not overwhelmed by hundreds of irrelevant system objects.

**Independent Test**: A consultant views the object list after schema retrieval, sees that custom objects and common business objects are pre-selected while system objects are hidden, uses search to find a specific object, expands one to see its record count and sample fields, modifies the selection, leaves and returns to find the selection intact.

**Acceptance Scenarios**:

1. **Given** a retrieved schema with objects, **When** the consultant opens the object selection step, **Then** all custom objects and common business objects are pre-selected by default, and system/internal objects are hidden behind a "Hide system objects" toggle (default: on).
2. **Given** the object selection list, **When** the consultant types in the search box, **Then** the list is filtered in real time by label or API name (case-insensitive).
3. **Given** the object selection list, **When** the consultant expands an object, **Then** the system fetches on-demand and displays:
   - The record count for that object
   - The full list of fields with their types and constraints
   - A sample of records (first 3-5 records) to give the consultant a concrete view of the data
   This call is only made when the consultant explicitly clicks to expand.
4. **Given** a modified selection, **When** the consultant navigates away and returns, **Then** the previous selection is fully restored from the database.
5. **Given** the object selection list, **When** the consultant clicks "Select all visible", **Then** all currently visible (filtered) objects are selected. "Deselect all visible" works inversely.
6. **Given** zero objects are selected, **When** the consultant tries to proceed to field retrieval, **Then** the system prevents proceeding and displays a message asking to select at least one object.

## Edge Cases

- The system has no custom objects: only standard business objects are pre-selected; the list still displays correctly.
- The system has 1000+ objects: the list renders without performance degradation; the default "Hide system objects" toggle significantly reduces the visible count.
- The consultant selects an object, then on schema refresh that object no longer exists: the system flags the orphaned selection with a warning and removes it from scope.
- Expanding an object that has zero records: the record count shows "0 records" without error.
- Expanding an object where the record count query is slow or times out: the system shows a loading indicator, then a timeout message if the call exceeds a reasonable threshold (e.g., 30 seconds).
- The search query matches no objects: an empty state message is displayed (e.g., "No objects match your search").
- The consultant toggles "Hide system objects" off: all objects become visible, including system objects, but system objects remain deselected unless manually selected.

## Functional Requirements

- **FR-001**: The system MUST display all objects from the CURRENT schema snapshot in a selectable list, showing: label, API name, standard/custom badge, and description.
- **FR-002**: The system MUST pre-select all custom objects (isCustom=true) and common business objects by default. The list of common business objects is defined per connector type (e.g., Account, Contact, Lead, Opportunity, Case for CRM systems).
- **FR-003**: The system MUST provide a "Hide system objects" toggle, enabled by default, that hides objects classified as system/internal by the connector adapter.
- **FR-004**: The system MUST provide real-time search/filter by label or API name (case-insensitive, substring match).
- **FR-005**: The system MUST allow on-demand expansion of any object to display:
  (a) the record count,
  (b) the full list of fields with types and constraints,
  (c) a sample of actual records (first 3-5 records).
  The API calls MUST only be triggered when the consultant explicitly clicks to expand — not pre-fetched.
- **FR-006**: The system MUST provide "Select all visible" and "Deselect all visible" bulk actions that operate only on currently visible (filtered) objects.
- **FR-007**: The system MUST persist the object selection in the database, linked to the connection and schema snapshot. The selection MUST be restored on return.
- **FR-008**: The system MUST prevent the consultant from proceeding to field retrieval with zero objects selected, displaying a clear validation message.
- **FR-009**: The system MUST display a count of selected objects vs. total objects (e.g., "42 / 1,234 objects selected").
- **FR-010**: The system MUST log selection changes (initial selection, manual changes) to the audit trail.

## Key Entities

- **ObjectSelection**: Persisted record of a consultant's object selection. Fields: id, connectionId, snapshotId, objectApiName, isSelected, selectedAt, selectedBy.

## Success Criteria

- **SC-001**: The object selection list loads in under 2 seconds for a schema with up to 2000 objects.
- **SC-002**: Search/filter results appear within 200ms of keystroke.
- **SC-003**: On-demand expand (record count + fields + sample records) completes in under 10 seconds.
- **SC-004**: A consultant returning after a session finds 100% of their previous selection intact.
- **SC-005**: Pre-selection defaults result in a useful starting point: common business objects and custom objects are selected, system objects are not.

## Assumptions

- The connector adapter can classify objects as system/internal vs. business-relevant (or the classification is inferred from the isCustom flag and a configurable list of common business objects).
- The connector adapter provides a method to retrieve the record count for a single object on demand.
- The connector adapter provides a method to retrieve fields for a single object on demand.
- The connector adapter provides a method to retrieve a sample of records for a single object on demand.
- The selection is per-connection, per-snapshot. If the schema is refreshed and a new snapshot is created, the selection is migrated to the new snapshot for objects that still exist.

## Workflow Navigation

After confirming the object selection, the UI MUST display:
- "X objects selected. Next: [Retrieve Fields →]" — triggering field retrieval for selected objects only.
