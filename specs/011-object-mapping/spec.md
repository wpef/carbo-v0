# Feature Specification: Object Mapping

**Feature**: 011-object-mapping
**Created**: 2026-03-25
**Updated**: 2026-04-01
**Status**: Draft
**Depends on**: 005-source-field-retrieval, 008-destination-field-retrieval

## User Scenarios & Testing

### User Story 1 - View object correspondence (Priority: P1)

As a consultant, I open a mapping plan and see a two-column layout: source objects on the left, destination objects on the right. Visual links connect objects that are already paired (e.g., Account to Company). Each object appears as a card showing its name, with a connection point (circle) on the appropriate side (right for source, left for destination).

**Why this priority**: The two-column view is the entry point for all mapping work. Without it, no object pairing or downstream field mapping can happen.

**Independent Test**: A consultant opens a mapping plan connected to Salesforce (source) and HubSpot (destination). The left column shows source objects (Account, Contact, Lead, Opportunity...), the right column shows destination objects (Company, Contact, Deal...). Each card displays the object name and a connection circle.

**Acceptance Scenarios**:

1. **Given** a mapping plan with source and destination connections, **When** the consultant opens the object mapping view, **Then** a two-column layout displays source objects on the left and destination objects on the right.
2. **Given** object mappings already exist in the plan, **When** the view loads, **Then** visual links are drawn between paired source and destination objects.
3. **Given** a source object card, **When** the consultant looks at it, **Then** a connection circle is visible on the right side of the card. For destination cards, the circle is on the left side.

---

### User Story 2 - Auto-link predictable object pairs (Priority: P1)

When two objects are connected for the first time in a mapping plan, the system automatically creates links for predictable pairs based on well-known correspondences between source and destination systems (e.g., Account SF to Company HS, Contact SF to Contact HS). The consultant can remove any auto-created link.

**Why this priority**: Auto-linking saves significant time and reduces errors on obvious mappings. It is a core differentiator for a migration tool aimed at consultants.

**Independent Test**: A consultant creates a new mapping plan with Salesforce as source and HubSpot as destination. Upon opening the object mapping view, links are automatically created for Account-Company and Contact-Contact. The consultant removes the Contact-Contact link and confirms it disappears.

**Acceptance Scenarios**:

1. **Given** a mapping plan with no existing object mappings, **When** the consultant opens the object mapping view for the first time, **Then** the system automatically creates links for predictable object pairs (e.g., Account to Company, Contact to Contact).
2. **Given** an auto-created object link, **When** the consultant removes it, **Then** the link is deleted and no longer displayed.
3. **Given** a mapping plan where auto-links have already been created, **When** the consultant re-opens the view, **Then** no duplicate auto-links are created.

---

### User Story 3 - Manually link objects (Priority: P1)

A consultant creates a link between a source object and a destination object by clicking the connection circle on a source card, then clicking the connection circle on a destination card. The link appears visually between the two objects.

**Why this priority**: Manual linking is essential for non-obvious pairings (e.g., Lead to Contact) that auto-linking cannot predict.

**Independent Test**: A consultant clicks the connection circle on source object "Lead", then clicks the connection circle on destination object "Contact". A visual link appears between the two cards. The consultant then clicks the connection circle on source object "Lead" again and clicks destination object "Deal" -- a second link appears (fan-out).

**Acceptance Scenarios**:

1. **Given** the object mapping view, **When** the consultant clicks the connection circle on a source object and then the connection circle on a destination object, **Then** a link is created between the two objects and displayed visually.
2. **Given** a link already exists between source object A and destination object B, **When** the consultant tries to create the same link again, **Then** the system rejects the duplicate with a clear message.
3. **Given** a source object already linked to one destination, **When** the consultant links the same source to a different destination, **Then** both links coexist (fan-out is allowed).
4. **Given** two different source objects, **When** the consultant links both to the same destination object, **Then** both links coexist with a warning that record conflicts may occur during execution.

---

### User Story 4 - View object detail (Priority: P2)

A consultant clicks on an object card to open a detail modal. The modal shows the object name as title, "Source" or "Destination" as subtitle, the number of records of this type, a section indicating the number of fields remaining to validate, and a section indicating the number of existing migration filters. Clicking the fields validation section navigates to the field mapping view for that object.

**Why this priority**: The detail modal provides a summary dashboard for each object, enabling the consultant to assess progress without diving into field-level details.

**Independent Test**: A consultant clicks on source object "Contact". A modal opens showing "Contact" as title, "Source" as subtitle, "12,340 records", "18/25 fields remaining to validate", and "2 migration filters". The consultant clicks on the fields section and is taken to the field mapping view for Contact.

**Acceptance Scenarios**:

1. **Given** the object mapping view, **When** the consultant clicks on an object card, **Then** a detail modal opens showing the object name, source/destination label, and record count.
2. **Given** the detail modal is open, **When** the consultant views the fields validation section, **Then** it shows how many fields still need to be validated for this object.
3. **Given** the detail modal is open, **When** the consultant clicks the fields validation section, **Then** the application navigates to the field mapping view for that object.
4. **Given** the detail modal is open, **When** the consultant views the migration filters section, **Then** it shows the count of existing migration filters for this object.

---

### User Story 5 - Remove an object link (Priority: P2)

A consultant can remove an existing link between a source object and a destination object. Removing a link triggers a confirmation dialog, and upon confirmation, the link and all its child data (field mappings, migration logic, filters) are cascade-deleted.

**Why this priority**: Correcting mistakes or changing the mapping plan requires the ability to cleanly remove object links.

**Independent Test**: A consultant right-clicks (or uses a delete action) on the link between Account and Company. A confirmation dialog warns that all field mappings, migration logic, and filters will be deleted. The consultant confirms, and the link disappears.

**Acceptance Scenarios**:

1. **Given** an object link exists, **When** the consultant triggers removal, **Then** a confirmation dialog warns about cascade deletion of child data (field mappings, migration logic, filters).
2. **Given** the confirmation dialog is shown, **When** the consultant confirms, **Then** the link and all child data are deleted, and the view updates.
3. **Given** the confirmation dialog is shown, **When** the consultant cancels, **Then** nothing is deleted.

---

### Edge Cases

- A source object has zero fields (metadata-only object): the system allows the mapping but the detail modal notes that no field mappings are possible.
- The consultant maps the same source object to two different destination objects (fan-out, e.g., Contact to Contacts and Contact to Leads): the system allows it as this is a valid migration pattern.
- The consultant maps two different source objects to the same destination object (fan-in, e.g., Contact to Contacts and Lead to Contacts): the system allows it with a visible warning about potential record conflicts.
- A source or destination system has 100+ objects: the lists remain scrollable and performant, with a search/filter capability to find objects quickly.
- No predictable pairs exist between source and destination (e.g., two custom systems): auto-linking creates no links and the view opens empty.
- The consultant removes an auto-created link: it is treated identically to a manually created link for deletion purposes.
- A source or destination connection is missing or disconnected: the system displays a message indicating the connection must be established first.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST display a two-column layout with source objects on the left and destination objects on the right.
- **FR-002**: Each object MUST be displayed as a card showing the object name and a connection circle (right side for source, left side for destination).
- **FR-003**: Visual links MUST be drawn between paired source and destination objects.
- **FR-004**: The system MUST automatically create links for predictable object pairs when a mapping plan's object mapping view is first opened. Auto-linking MUST NOT create duplicates on subsequent visits.
- **FR-005**: The system MUST allow the consultant to create a link by clicking the connection circle on a source card, then clicking the connection circle on a destination card.
- **FR-006**: The system MUST prevent duplicate object mappings (same source + same destination) within a single plan.
- **FR-007**: The system MUST allow multiple links per source object (fan-out) and multiple links per destination object (fan-in), with a warning for fan-in about potential record conflicts.
- **FR-008**: Clicking an object card MUST open a detail modal displaying: object name (title), source/destination label (subtitle), record count, fields remaining to validate, and migration filter count.
- **FR-009**: Clicking the fields validation section in the detail modal MUST navigate to the field mapping view for that object.
- **FR-010**: The system MUST allow removing an object link with a confirmation dialog that warns about cascade deletion.
- **FR-011**: Removing an object link MUST cascade-delete all child field mappings, migration logic rules, and migration filters.
- **FR-012**: The system MUST log object link creation and removal to the audit trail (Constitution Principle VI).
- **FR-013**: The object list MUST support text search AND category filters. Category filters include: All (default), Mapped only, Unmapped only, Standard only, Custom only. These filters apply independently to each column (source and destination).

### UI Components

- **A1 — Object List**: Two-column view showing all source objects (left) and destination objects (right). Each object is displayed as an A2 card. Visual links connect paired objects (e.g., Account SF ↔ Company HS). Clicking an object card opens a modal showing the A3 detail card.
- **A2 — Object Card (list)**: Card displaying the object name. Source cards have a connection circle on the right side to initiate a link to a destination object. Destination cards have a connection circle on the left side to receive a link from a source object. Clicking the circle starts the link creation flow.
- **A3 — Object Card (detail)**: Modal showing:
  - Object name as title
  - "Source" or "Destination" as subtitle
  - Number of records of this type
  - A section indicating the number of fields remaining to validate for this object (clickable — navigates to the field mapping view for this object)
  - A section indicating the number of existing migration filters for this object

### Key Entities

- **ObjectMapping**: Belongs to a MappingPlan. Has an id, mappingPlanId, sourceObjectName, destinationObjectName, autoCreated (boolean), createdAt, updatedAt. Owns zero or more FieldMappings and MigrationFilters.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A consultant can view the object mapping layout and identify all existing links within 2 seconds of opening the plan.
- **SC-002**: Auto-linking creates predictable pairs in under 1 second when the view first loads.
- **SC-003**: A consultant can manually create an object link in under 3 clicks (source circle + destination circle).
- **SC-004**: The object detail modal displays record count, field validation progress, and filter count within 2 seconds of opening.
- **SC-005**: Object lists remain scrollable and responsive with 100+ objects per side.
- **SC-006**: 100% of object link operations (creation, removal, auto-link) are traceable in the audit trail.

## Assumptions

- Source and destination object lists are provided by the Connector Interface (features 005 and 008). The object mapping view does not fetch schemas from external systems directly.
- Record counts for the detail modal are fetched from cached schema data or queried on-demand via the connector.
- Predictable pairs are defined per connector pair (e.g., Salesforce-to-HubSpot has a known set). The mapping table is maintained at the application level and extensible per connector combination.
- Fields remaining to validate is computed from the total source fields minus mapped fields minus intentionally excluded fields.
- Migration filter count is read from the existing MigrationFilter entities linked to the object mapping.
- Object mappings are independent of each other within a plan -- they do not share field mappings.

## Session Learnings

### Bugs résolus

1. **SVG links invisible** — ObjectLink used `hsl(var(--primary))` but CSS variables contain `oklch()` values, producing `hsl(oklch(...))` which is an invalid color. Fixed by using `var(--primary)` directly.
2. **SVG infinite render loop** — `useLayoutEffect` depended on `filteredSourceObjects`/`filteredDestObjects` (arrays recreated every render), causing infinite `setState` loops. Fixed by depending on `sourceSearch`/`destSearch` (primitive values) and using a single `setSvgLayout()` call instead of 4 separate `setState` calls.
3. **SVG coordinates wrong** — The SVG was positioned inside the 80px bridge column but sized to the full container width. Links were drawn off-screen. Fixed by moving SVG to overlay the full container and using actual x/y coordinates from card bounding rects.

### Clarifications

1. **Object mapping is its own step**: The mapping page (`/plans/[planId]/mapping`) only handles object-to-object linking. Field mapping is a separate step on its own page.
2. **Navigation after mapping**: Step advancement is handled by the global sidebar button, not a per-page "Next" button. The mapping page no longer has its own "Next: Field Mapping →" button.
   <!-- Updated: 2026-04-08 — Per-page next button removed in favor of centralized sidebar navigation. -->
