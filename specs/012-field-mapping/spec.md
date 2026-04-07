# Feature Specification: Field Mapping

**Feature**: 012-field-mapping
**Created**: 2026-03-25
**Updated**: 2026-04-01
**Status**: Draft
**Depends on**: 011-object-mapping

## User Scenarios & Testing

### User Story 1 - View field correspondence layout (Priority: P1)

As a consultant, I open an object mapping (e.g., Contact to Contacts) and see a two-column layout: source fields on the left, destination fields on the right. Each field appears as a card showing its name and type. If a link exists between two fields, it is displayed as a visual connector between the cards. Source field cards also show the field's fill rate (percentage of records with a value).

**Why this priority**: The two-column field view is the primary workspace for all field-level mapping. Everything else (auto-matching, migration logic, schema writes) builds on this view.

**Independent Test**: A consultant opens the Contact-to-Contacts object mapping. The left column shows source fields (FirstName, LastName, Email, Phone, AnnualRevenue...) with types and fill rates. The right column shows destination fields (firstname, lastname, email, phone...) with types. Links are drawn between already-mapped pairs.

**Acceptance Scenarios**:

1. **Given** an object mapping exists, **When** the consultant opens the field mapping view, **Then** a two-column layout displays source fields on the left and destination fields on the right.
2. **Given** field mappings already exist, **When** the view loads, **Then** visual links (C1) are drawn between paired source and destination fields.
3. **Given** a source field card, **When** the consultant looks at it, **Then** it shows the field name, field type, fill rate (percentage), and a connection circle on the right side.
4. **Given** a destination field card, **When** the consultant looks at it, **Then** it shows the field name, field type, and a connection circle on the left side.

---

### User Story 2 - Manually link fields (Priority: P1)

A consultant creates a field mapping by clicking the connection circle on a source field card, then clicking the connection circle on a destination field card. The link appears visually between the two fields. Each source field maps to at most one destination field, and each destination field receives at most one source field, within a given object mapping.

**Why this priority**: Manual field linking is the core operation of the mapping plan. Without it, no migration rules can be defined.

**Independent Test**: A consultant clicks the circle on source field "FirstName" (string), then clicks the circle on destination field "firstname" (string). A link appears between the two cards. The consultant then tries to map "FirstName" to another destination field -- the system rejects it.

**Acceptance Scenarios**:

1. **Given** the field mapping view, **When** the consultant clicks the connection circle on a source field then the connection circle on a destination field, **Then** a field mapping is created and a visual link appears.
2. **Given** a source field is already mapped, **When** the consultant tries to map it to another destination field, **Then** the system rejects the duplicate (one-to-one constraint).
3. **Given** a destination field is already mapped, **When** the consultant tries to map another source field to it, **Then** the system rejects the duplicate (one-to-one constraint).
4. **Given** a field mapping is created, **When** the consultant views the link, **Then** it displays a color-coded status indicator (see C1).

---

### User Story 3 - Auto-match native field correspondences (Priority: P1)

When two objects are connected, the system automatically identifies and links native field correspondences (e.g., "Website" SF to "domain" HS, "Email" SF to "email" HS). Auto-matching is based on well-known equivalences between the source and destination systems. The consultant can remove any auto-created link.

**Why this priority**: Auto-matching dramatically reduces manual work for standard fields. For a typical Salesforce-to-HubSpot migration, 30-50% of fields have obvious native equivalences.

**Independent Test**: A consultant connects Contact (SF) to Contact (HS). The system automatically creates field links for FirstName-firstname, LastName-lastname, Email-email, Phone-phone. The consultant reviews the auto-created links and removes the Phone-phone link.

**Acceptance Scenarios**:

1. **Given** an object mapping is created (or auto-created), **When** the field mapping view loads for the first time, **Then** the system automatically creates links for native field correspondences.
2. **Given** auto-matched field links exist, **When** the consultant removes one, **Then** the link is deleted normally.
3. **Given** auto-matching has already run for an object mapping, **When** the consultant re-opens the field mapping view, **Then** no duplicate auto-matches are created.
4. **Given** no known native correspondences exist between two objects, **When** the field mapping view loads, **Then** no auto-matches are created and the view opens with no links.

---

### User Story 4 - View field detail (Priority: P2)

A consultant clicks on a field card to open a detail modal. The modal shows the field name as title, field type as subtitle, a description section (editable for destination fields), and additional details depending on whether it is a source or destination field.

For source fields:
- Fill rate (percentage of records with a value)
- If picklist: the list of values with the count of missing equivalences and equivalences to validate
- If text mapped to a destination picklist: the classification prompt to validate with example results

For destination fields:
- Editable description
- Additional details as needed

**Why this priority**: The detail modal is the synthesis of everything concerning a specific field, enabling informed decisions about mapping and transformation.

**Independent Test**: A consultant clicks on source field "Industry" (picklist). The modal shows "Industry" as title, "Picklist" as subtitle, 87% fill rate, and a list of 15 values with "3 missing equivalences, 5 to validate". The consultant then clicks on destination field "industry" and sees the editable description.

**Acceptance Scenarios**:

1. **Given** the field mapping view, **When** the consultant clicks on a source field card, **Then** a detail modal opens showing: field name (title), type (subtitle), fill rate, and type-specific details.
2. **Given** the detail modal for a source picklist field, **When** the consultant views the values section, **Then** it lists all picklist values with counts of missing equivalences and equivalences to validate.
3. **Given** the detail modal for a source text field mapped to a destination picklist, **When** the consultant views it, **Then** a classification prompt section is shown with example results.
4. **Given** the detail modal for a destination field, **When** the consultant views it, **Then** the description is displayed and editable.

---

### User Story 5 - Visual link status indicators (Priority: P2)

Each link between a source and destination field displays a color-coded status:
- **Green**: fields are linked, migration logic is defined and validated.
- **Orange**: fields are linked, migration logic is defined but not yet validated.
- **Red (solid)**: fields are linked but no migration logic is defined.
- **Red (dashed)**: fields are linked but the types are incompatible (e.g., text to number) -- migration logic cannot resolve this.

**Why this priority**: Color-coded links give the consultant an at-a-glance view of the mapping plan's completeness, enabling quick identification of what needs attention.

**Independent Test**: A consultant views a field mapping with 10 links. 3 are green (complete), 4 are orange (pending validation), 2 are solid red (no logic defined), and 1 is dashed red (text to number incompatibility).

**Acceptance Scenarios**:

1. **Given** a field link with validated migration logic, **When** the consultant views it, **Then** the link is displayed in green.
2. **Given** a field link with unvalidated migration logic, **When** the consultant views it, **Then** the link is displayed in orange.
3. **Given** a field link with no migration logic, **When** the consultant views it, **Then** the link is displayed in solid red.
4. **Given** a field link between incompatible types (e.g., text to number, picklist to date), **When** the consultant views it, **Then** the link is displayed in dashed red.
5. **Given** a field link status changes (e.g., migration logic is added), **When** the view updates, **Then** the link color changes accordingly.

---

### User Story 6 - Remove a field link (Priority: P2)

A consultant can remove a field mapping. Removing a field link deletes the mapping and all associated migration logic. The parent object mapping progress is updated accordingly.

**Why this priority**: Correcting mapping decisions requires clean removal of field links.

**Independent Test**: A consultant removes the link between "FirstName" and "firstname". The link disappears, the object mapping progress updates from "12/25" to "11/25".

**Acceptance Scenarios**:

1. **Given** a field link exists, **When** the consultant removes it, **Then** the link and all associated migration logic are deleted.
2. **Given** a field link is removed, **When** the consultant views the parent object mapping, **Then** the mapping progress is updated (one fewer mapped field).

---

### Edge Cases

- A source field has a type not recognized by the system (e.g., a proprietary compound field): the card displays "Unknown type" and the field can still be linked, but the link defaults to dashed red.
- A destination field is read-only: the card shows a visual indicator and the system warns that migration will fail unless the field is made writable.
- A destination field is of type picklist: linking to a non-picklist source field triggers the appropriate migration logic section (D2 for text, D3 for incompatible types).
- The consultant removes all field links: the object mapping progress returns to "0/N" and the plan status reverts to DRAFT.
- A field that was auto-matched becomes manually unlinked: the auto-match does not re-create it on subsequent visits.
- A source field of type "reference/lookup" is mapped to a text field: the system allows it with a link status reflecting the need for migration logic.
- An object has 200+ fields: the field lists remain scrollable and performant with search/filter capability.
- Both source and destination have picklist fields with the same values: auto-matching links them and the link status starts at orange (logic defined by auto-equivalence, pending validation).

## Requirements

### Functional Requirements

- **FR-001**: The system MUST display a two-column layout with source fields on the left and destination fields on the right for a given object mapping.
- **FR-002**: Each field MUST be displayed as a card showing: field name, field type, and a connection circle (right for source, left for destination).
- **FR-003**: Source field cards MUST additionally display the field's fill rate (percentage of records with a value).
- **FR-004**: The system MUST allow the consultant to create a field mapping by clicking the connection circle on a source field then the connection circle on a destination field.
- **FR-005**: The system MUST enforce one-to-one mapping: each source field maps to at most one destination field, and each destination field receives at most one source field, within a given object mapping.
- **FR-006**: The system MUST automatically create field links for native correspondences when an object mapping's field view is first opened. Auto-matching MUST NOT create duplicates on subsequent visits.
- **FR-007**: Visual links between mapped fields MUST be color-coded: green (logic validated), orange (logic defined, not validated), red solid (no logic), red dashed (incompatible types).
- **FR-008**: Clicking a field card MUST open a detail modal showing: field name (title), type (subtitle), description (editable for destination), and type-specific details.
- **FR-009**: Source field detail modals MUST show fill rate and, for picklist fields, the list of values with equivalence status counts.
- **FR-010**: Source field detail modals for text fields mapped to destination picklists MUST show the classification prompt and example results.
- **FR-011**: The system MUST allow removing a field link with cascade deletion of associated migration logic.
- **FR-012**: Removing a field link MUST update the parent object mapping's progress indicator.
- **FR-013**: The system MUST log field link creation and removal to the audit trail (Constitution Principle VI).
- **FR-014**: Field lists MUST support search or filtering when the number of fields exceeds a comfortable visual threshold.

### UI Components

- **B1 — Field List**: Two-column view showing all fields for a source object (left) and its linked destination object (right). Each field is displayed as a B2 card. If a link exists between two fields, it is represented by a C1 element. Clicking a field card opens a modal showing the B3 detail card. Clicking a link opens a modal showing the C2 link detail (see 013-migration-logic).
- **B2 — Field Card (list)**: Card displaying:
  - Field name
  - Field type
  - If source: fill rate (percentage of records with a value)
  - If source: a connection circle on the right side to initiate a link to a destination field
  - If destination: a connection circle on the left side to receive a link from a source field
  - Clicking the card opens the B3 detail modal
- **B3 — Field Card (detail)**: Modal showing:
  - Field name as title
  - Field type as subtitle
  - Description section (editable if destination field)
  - If source: fill rate (percentage)
  - **Source details:**
    - If picklist: list of values with count of missing equivalences and equivalences to validate
    - If text mapped to a destination picklist: classification prompt to validate with example results
  - **Destination details:** [to be specified]
- **C1 — Link (list)**: Visual connector between paired source (right side of source card) and destination (left side of destination card) fields. Color-coded by migration status:
  - **Red solid**: fields are linked but no migration logic is defined
  - **Orange**: fields are linked, migration logic is defined but not yet validated
  - **Green**: fields are linked, migration logic exists and is validated
  - **Red dashed**: fields are linked but types are incompatible (e.g., text → number, picklist → date)

### Key Entities

- **FieldMapping**: Belongs to an ObjectMapping. Has an id, objectMappingId, sourceFieldName, destinationFieldName, sourceFieldType, destinationFieldType, compatibilityStatus (COMPATIBLE | NEEDS_LOGIC | INCOMPATIBLE), autoCreated (boolean), createdAt, updatedAt. Owns zero or more MigrationLogicRules.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A consultant can view the field mapping layout and identify all links within 2 seconds of opening an object mapping.
- **SC-002**: Auto-matching creates native field correspondences in under 2 seconds when the view first loads.
- **SC-003**: A consultant can manually create a field link in under 3 clicks.
- **SC-004**: Link color-coding is immediately visible and distinguishable at a glance (green, orange, red solid, red dashed).
- **SC-005**: The field detail modal displays all relevant information within 2 seconds of clicking a card.
- **SC-006**: Field lists remain responsive with 200+ fields per side.
- **SC-007**: 100% of field link operations are traceable in the audit trail.

## Assumptions

- Source field types and destination field types are provided by the Connector Interface in a normalized format. The field mapping does not query external systems directly.
- Fill rates are pre-computed by the source connector or computed on-demand from a sample of records.
- Native field correspondences are defined per connector pair (e.g., Salesforce-to-HubSpot has a known mapping table). This table is maintained at the application level. **A name-based fallback (case-insensitive apiName match) complements the registry for fields not covered by explicit pairs.**
- The compatibility status is determined by a type compatibility matrix that maps source type + destination type pairs to COMPATIBLE, WARNING, or INCOMPATIBLE (5×5 matrix: text, number, date, picklist, boolean).
  <!-- Updated: 2026-04-07 — NEEDS_LOGIC renamed to WARNING in implementation. -->
- One-to-one mapping is enforced within a single object mapping. The same source field can appear in different object mappings (e.g., if Contact is mapped to both Contacts and Leads).
- Link color status is derived from: (1) type compatibility, (2) whether migration logic exists, and (3) whether that logic is validated. This is a computed state, not stored separately.

## Session Learnings

### Bugs résolus

1. **SVG links traversing the screen** — The two-column SVG approach for visual field links was fundamentally broken: wrong coordinate system, infinite render loops (`useLayoutEffect` with array deps recreated each render), `hsl()` wrapping `oklch()` CSS values producing invisible colors. **Decision: replaced SVG-based FieldMappingView with a table-based UI.** Mapped fields shown in a table (source → dest, type badges, compatibility status, configure/delete actions). Unmapped fields shown separately with a "Map to..." dropdown.
2. **Auto-match not working** — The auto-match registry used case-sensitive `Map.get()` lookups, but registry keys (e.g., `phone`) didn't match actual field apiNames (e.g., `Phone`). Fixed by adding case-insensitive fallback lookups (`sourceByLowerApiName`, `destByLowerApiName`).
3. **Auto-match too narrow** — The registry only had hardcoded pairs per adapter combo. Fields with identical names but not in the registry were never matched. Fixed by combining registry pairs with a name-based fallback that matches `sourceApiName.toLowerCase() === destApiName.toLowerCase()` for fields not already covered by the registry.
4. **Tab badge showing NaN** — The unmapped fields API returns `{ fields: [...] }` but the frontend expected `{ unmappedFields: [...] }`. Fixed key lookup.
5. **Tab badge not updating** — Stats were fetched once on mount. Added a `version` counter incremented after every create/delete/auto-match operation to trigger re-fetch.

### Edge cases ajoutés

6. **Given** auto-match registry has partial coverage for an adapter combo (e.g., 4 of 12 fields), **When** auto-match runs, **Then** it creates links for both registry pairs AND name-matched pairs not covered by the registry (union, not fallback).
7. **Given** a source field apiName is "Phone" and the destination field apiName is "phone" (case difference only), **When** auto-match runs, **Then** the fields are matched (case-insensitive comparison).
8. **Given** the user maps a source field of type "reference" to a destination field of type "text", **When** the link is created, **Then** a confirmation dialog warns about the type mismatch before proceeding.

### Clarifications

1. **Table-based UI replaces SVG two-column view**: The field mapping view is now a table with columns: Source Field (name + type badge) → Dest Field (name + type badge) | Status (OK/Warning/Incompatible) | Actions (Configure, Delete). This is more reliable, accessible, and maintainable than SVG bezier curves.
2. **Filters are displayed BEFORE field mapping**: In the field mapping page, the FilterPanel for source record filtering appears above the field mapping table, not below it. This reflects the logical order: filter source records first, then map fields.
3. **Data preview link**: Each object pair tab in the field mapping page includes a "Preview source data →" link that opens the record preview page for the source object.
4. **Field mapping is a dedicated plan step**: The field mapping page (`/plans/[planId]/field-mapping`) is its own step in the plan workflow (`FIELD_MAPPING`), accessed after object mapping is complete. It shows tabs for each object pair with dynamic progress badges (e.g., "6/12" mapped fields, colored green/orange/red).
5. **Type compatibility matrix**: The 5×5 matrix maps normalized type categories (text, number, date, picklist, boolean) to COMPATIBLE, WARNING, or INCOMPATIBLE. Unknown types default to "text" (most permissive). Type normalization maps 30+ raw type names to 5 canonical categories.
