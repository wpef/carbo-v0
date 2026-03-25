# Feature Specification: Mapping Plan

**Feature Branch**: `003-mapping-plan`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Mapping plan — create object-to-object and field-to-field mappings with transformation rules, validation rules, and migration filters between source and destination connectors"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create object-to-object and field-to-field mappings (Priority: P1)

The consultant has connected both a source (Salesforce) and a destination (HubSpot). They create
a mapping plan, select a source object and its corresponding destination object, then map fields
one by one. For each field mapping, the system shows source and destination field types to help
the consultant make informed decisions. Unmapped source fields are flagged explicitly — they are
never silently ignored.

**Why this priority**: This is the core value of the product. Without field-to-field mapping,
nothing else works. A consultant can deliver value with just this — a structured mapping plan
between two systems.

**Independent Test**: A consultant can create a mapping from Salesforce Contact to HubSpot Contacts,
map 10+ fields, and see the complete mapping summary — without adding any rules.

**Acceptance Scenarios**:

1. **Given** a connected source and destination, **When** the consultant creates a new mapping plan,
   **Then** a plan is created and the consultant can select source and destination objects.
2. **Given** a source object (Contact) and destination object (Contacts) selected, **When** the
   consultant views the mapping interface, **Then** all source fields and destination properties
   are displayed side by side with their types.
3. **Given** the mapping interface, **When** the consultant maps source field "FirstName" to
   destination property "firstname", **Then** the mapping is saved and visible in the mapping list.
4. **Given** a mapping with some source fields unmapped, **When** the consultant views the mapping
   summary, **Then** unmapped fields are listed with an explicit warning — not hidden.
5. **Given** a mapping plan with multiple object mappings, **When** the consultant views the plan
   overview, **Then** all object mappings are listed with their completion status (mapped/unmapped
   field counts).

---

### User Story 2 - Add transformation and validation rules to field mappings (Priority: P2)

The consultant needs to define how data should be transformed during migration and what validation
should be applied. For each field mapping, they can add transformation rules (fixed value, value
from another field, JavaScript function) and validation rules (data type check, regex pattern).

**Why this priority**: Rules make the mapping actionable. Without them, the mapping is just a
correspondence table. With rules, it becomes an executable migration specification. However, a
mapping without rules is still useful as documentation.

**Independent Test**: A consultant can add a transformation rule (e.g., `value.trim().toUpperCase()`)
and a validation rule (e.g., regex `^[A-Z]{2}$`) to a field mapping, and see them clearly displayed.

**Acceptance Scenarios**:

1. **Given** a field mapping, **When** the consultant adds a "fixed value" transformation rule
   with value "FR", **Then** the rule is attached and displayed on the mapping.
2. **Given** a field mapping, **When** the consultant adds a "value from another field"
   transformation rule referencing "MailingCountry", **Then** the rule is attached with the
   source field reference clearly shown.
3. **Given** a field mapping, **When** the consultant adds a JavaScript transformation function
   `value.trim().toUpperCase()`, **Then** the rule is attached; if the code has a syntax error,
   the system displays an immediate error.
4. **Given** a field mapping, **When** the consultant adds a validation rule with type "regex"
   and pattern `^[A-Z]{2}$`, **Then** the rule is attached and the pattern is displayed.
5. **Given** a field mapping, **When** the consultant adds a "data type" validation rule, **Then**
   the system checks that the source value can be coerced to the destination field's type.
6. **Given** a field mapping with multiple rules, **When** the consultant views the mapping,
   **Then** all transformation and validation rules are listed in order of application.

---

### User Story 3 - Define migration filters on objects (Priority: P3)

Before migrating, the consultant wants to filter which records to include. For example: only
contacts with email ending in "@company.com", or only accounts created after 2020-01-01. Filters
are defined per object mapping and will be applied during migration execution (feature 006).

**Why this priority**: Filters are essential for real-world migrations where you rarely want to
migrate everything. However, a mapping plan is complete and useful without filters — they can be
added later before execution.

**Independent Test**: A consultant can add a filter "createdDate > 2020-01-01" to a Contact
mapping and see it clearly displayed in the mapping plan.

**Acceptance Scenarios**:

1. **Given** an object mapping, **When** the consultant adds a filter on a source field (e.g.,
   "Email ends with @company.com"), **Then** the filter is saved and displayed on the object
   mapping.
2. **Given** an object mapping, **When** the consultant adds a date range filter (e.g.,
   "CreatedDate > 2020-01-01"), **Then** the filter is saved with the correct date format.
3. **Given** an object mapping with filters, **When** the consultant views the mapping summary,
   **Then** active filters are prominently displayed with an estimated record count (based on
   source data).
4. **Given** multiple filters on the same object mapping, **When** the consultant views them,
   **Then** filters are combined with AND logic and the consultant can reorder or remove them.

---

### Edge Cases

- A source field type is incompatible with the destination property type (e.g., text → number):
  the system warns about the type mismatch but allows the mapping if a transformation rule is
  defined to handle the conversion.
- A required destination field has no source mapping: the system raises an explicit error — the
  consultant must either map a source field, add a fixed value transformation, or explicitly
  acknowledge the gap.
- Multiple source fields are mapped to the same destination property: the system allows it but
  displays a warning that a transformation rule is needed to resolve the conflict.
- A JavaScript transformation function has a syntax error: the system detects and reports it at
  definition time, not at migration time.
- The source or destination schema changes after the mapping is created (field deleted, type
  changed): broken mappings are flagged on the next plan view with a clear indication of what
  changed.
- A mapping plan has zero field mappings: the system allows saving but warns that the plan is
  empty.
- A filter references a field that doesn't exist in the source: the system reports the error
  immediately.

## Clarifications

### Session 2026-03-19

- Q: Should auto-mapping (suggest matches by field name similarity) be included? → A: No — manual mapping only for v0. Auto-suggestion can be added later as a separate feature.
- Q: Can a mapping plan span multiple source/destination object pairs? → A: Yes — one plan contains multiple object mappings (e.g., Contact→Contacts AND Account→Companies in the same plan).
- Q: Are filters evaluated at definition time or execution time? → A: Definition time for estimated count display (using source connector preview), execution time for actual filtering during migration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the consultant to create a mapping plan linked to a source
  connection and a destination connection.
- **FR-002**: The system MUST allow adding multiple object mappings (source object → destination
  object) within a single plan.
- **FR-003**: The system MUST display source fields and destination properties side by side for
  a selected object mapping, showing types, constraints, and mapping status.
- **FR-004**: The system MUST allow the consultant to map a source field to a destination property
  within an object mapping.
- **FR-005**: The system MUST explicitly flag all unmapped source fields — they MUST NOT be
  silently ignored (Constitution Principle III).
- **FR-006**: The system MUST explicitly flag all required destination fields that have no source
  mapping.
- **FR-007**: The system MUST allow adding transformation rules to a field mapping: fixed value,
  value from another source field, or JavaScript function.
- **FR-008**: The system MUST validate JavaScript transformation functions for syntax errors at
  definition time.
- **FR-009**: The system MUST allow adding validation rules to a field mapping: data type check
  or regex pattern.
- **FR-010**: The system MUST allow defining migration filters per object mapping, filtering
  source records by field value (equals, contains, starts with, ends with, greater than, less
  than, date range).
- **FR-011**: The system MUST display an estimated record count based on active filters (using
  source data).
- **FR-012**: The system MUST persist the mapping plan for retrieval and editing across sessions.
- **FR-013**: The system MUST detect and flag broken mappings when the source or destination
  schema has changed since the mapping was created.
- **FR-014**: The system MUST log every significant operation (plan creation, mapping change, rule
  addition, filter change) to the audit trail.

### Key Entities

- **MappingPlan**: The top-level plan, linked to one source connection and one destination
  connection. Contains one or more object mappings.
- **ObjectMapping**: A correspondence between one source object and one destination object within
  a plan. Contains field mappings and migration filters.
- **FieldMapping**: A correspondence between one source field and one destination property within
  an object mapping. Can carry transformation and validation rules.
- **TransformationRule**: A rule applied to transform a source value before writing to the
  destination. Types: fixed value, reference to another source field, JavaScript function.
- **ValidationRule**: A rule that validates a source value against a constraint. Types: data type
  check, regex pattern.
- **MigrationFilter**: A filter condition on a source field that determines which records to
  include in the migration. Filters are combined with AND logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A consultant can create a complete mapping (50+ fields) between two objects in under
  30 minutes.
- **SC-002**: 100% of unmapped source fields are visible in the mapping summary — none are hidden.
- **SC-003**: JavaScript transformation syntax errors are detected and reported within 1 second
  of input.
- **SC-004**: A mapping plan with 5 object mappings and 200+ field mappings loads and displays
  in under 3 seconds.
- **SC-005**: All mapping operations are traceable in the audit trail.

## Assumptions

- Features 001 (Salesforce connector) and 002 (HubSpot connector) are implemented — the mapping
  plan consumes SourceSchema and DestinationSchema from those connectors.
- The mapping plan does not execute the migration — it only defines the specification. Execution
  is feature 006.
- JavaScript transformation functions run in a sandboxed context at execution time. At definition
  time, only syntax validation is performed.
- Auto-mapping (suggesting matches by field name similarity) is out of scope for v0.
- A mapping plan covers one source connection and one destination connection (not multi-source).
