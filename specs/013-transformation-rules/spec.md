# Feature Specification: Migration Logic

**Feature**: 013-migration-logic (formerly 013-transformation-rules)
**Created**: 2026-03-25
**Updated**: 2026-04-01
**Status**: Draft
**Depends on**: 012-field-mapping

## User Scenarios & Testing

### User Story 1 - Open migration logic for a field link (Priority: P1)

As a consultant, I click on a link between a source field and a destination field to open a detail modal. The modal shows the source field name and type on the left, the destination field name and type on the right, and a type-specific section in the center that guides me through defining the migration logic. The section displayed depends on the combination of source and destination field types (see Type Compatibility Matrix).

**Why this priority**: The migration logic modal is the core decision-making interface for how data transforms during migration. Every field link needs migration logic before the plan can be validated.

**Independent Test**: A consultant clicks on the link between source field "Industry" (picklist) and destination field "industry" (picklist). A modal opens with "Industry" and "Picklist" on the left, "industry" and "Picklist" on the right, and a D1 (Value Equivalence) section in the center. Three buttons appear at the bottom: Cancel, Save, Validate.

**Acceptance Scenarios**:

1. **Given** a link exists between two fields, **When** the consultant clicks on the link, **Then** a detail modal opens showing source field (name + type) on the left, destination field (name + type) on the right, and the appropriate type-specific section.
2. **Given** the modal is open, **When** the consultant views the bottom of the modal, **Then** three buttons are displayed: Cancel, Save, and Validate.
3. **Given** the modal is open, **When** the consultant clicks Cancel, **Then** the modal closes without saving any changes.

---

### User Story 2 - Value Equivalence (picklist to picklist) (Priority: P1)

When both the source and destination fields are picklists (or one is a checkbox), the modal displays a D1 section: two columns of picklist values (source on the left, destination on the right). The consultant can draw lines from source values to destination values, indicating that a source value should be transformed into the linked destination value. When the modal opens, values with identical or equivalent names are automatically linked.

**Why this priority**: Picklist-to-picklist mapping is the most common transformation scenario in CRM migrations and requires explicit value-level mapping.

**Independent Test**: A consultant opens the migration logic for "LeadSource" (picklist, 8 values) to "leadsource" (picklist, 6 values). The modal shows both value lists. 4 values with matching names are auto-linked. The consultant draws a line from "Web" to "Online" and from "Referral" to "Partner". The consultant clicks Save.

**Acceptance Scenarios**:

1. **Given** source and destination are both picklists, **When** the modal opens, **Then** a D1 section displays source values on the left and destination values on the right.
2. **Given** the D1 section is displayed, **When** the modal first opens, **Then** values with identical or equivalent names are automatically linked.
3. **Given** the D1 section, **When** the consultant draws a line from a source value to a destination value, **Then** the equivalence is recorded.
4. **Given** a source value has multiple possible destinations, **When** the consultant draws lines, **Then** one source value can be linked to one destination value (many-to-one is allowed: multiple source values can map to the same destination value).
5. **Given** equivalences are defined, **When** the consultant clicks Save, **Then** the equivalences are persisted as migration logic and the link status changes to orange (defined but not validated).
6. **Given** equivalences are defined, **When** the consultant clicks Validate, **Then** the equivalences are persisted and the link status changes to green (validated).

---

### User Story 3 - LLM Classification Prompt (text to picklist) (Priority: P1)

When a source text field is mapped to a destination picklist field, the modal displays a D2 section: a text area for a classification prompt (with placeholder "Classify this text into one of the following categories") and 4-5 example rows showing real source record values alongside the LLM-generated classification. The consultant reviews and adjusts the prompt, then saves it as the migration logic.

**Why this priority**: Text-to-picklist conversion is a frequent need in CRM migrations (e.g., free-text "Industry" to a standardized picklist). LLM-based classification is a key differentiator of the tool.

**Independent Test**: A consultant opens the migration logic for "Description" (text) to "category" (picklist with values: Support, Sales, Other). The modal shows a prompt field with placeholder text and 4 example rows. Each row shows a real description value and the LLM's suggested classification. The consultant edits the prompt, the examples refresh, and they click Save.

**Acceptance Scenarios**:

1. **Given** source is text and destination is picklist, **When** the modal opens, **Then** a D2 section displays a prompt text area and 4-5 example classification rows.
2. **Given** the D2 section, **When** example rows are displayed, **Then** each row shows a real source record value and the LLM-generated classification into one of the destination picklist values.
3. **Given** the D2 section, **When** the consultant modifies the prompt, **Then** the example classifications refresh to reflect the new prompt.
4. **Given** a prompt is defined, **When** the consultant clicks Save, **Then** the prompt is persisted as migration logic and the link status changes to orange.
5. **Given** a prompt is defined, **When** the consultant clicks Validate, **Then** the prompt is persisted and the link status changes to green.

---

### User Story 4 - Incompatible types error (Priority: P2)

When the source and destination field types are incompatible (e.g., text to number, picklist to date), the modal displays a D3 section: a red-bordered message explaining that these field types cannot be linked, and that a CSV file with source values and destination record IDs will be sent by email after migration so the consultant can handle the data manually.

**Why this priority**: Clear error messaging prevents consultants from spending time trying to define impossible transformations and offers a practical fallback.

**Independent Test**: A consultant opens the migration logic for "Description" (text) to "amount" (number). The modal shows a red-bordered error message. The Save and Validate buttons are disabled (only Cancel is active).

**Acceptance Scenarios**:

1. **Given** source and destination types are incompatible, **When** the modal opens, **Then** a D3 section displays a red-bordered error message explaining the incompatibility.
2. **Given** the D3 section is displayed, **Then** the message includes: "Unfortunately, we cannot currently link these two field types. We will send you a CSV by email containing the destination IDs and source values for this field so you can update it after migration."
3. **Given** the D3 section is displayed, **When** the consultant views the action buttons, **Then** only Cancel is active (Save and Validate are disabled or hidden).

---

### User Story 5 - Simple copy / informational message (Priority: P2)

When source and destination types are directly compatible (e.g., text to text, number to number, date to date), the modal displays a D4 section: a grey-bordered informational message indicating that no transformation is needed. The specific message varies by type combination (e.g., "The value will be copied as-is", "True or False", "True=>1, False=>0").

**Why this priority**: For compatible types, the consultant needs confirmation that no action is required, avoiding unnecessary worry about unconfigured links.

**Independent Test**: A consultant opens the migration logic for "FirstName" (text) to "firstname" (text). The modal shows a grey message: "The value will be copied as-is." The consultant clicks Validate and the link turns green.

**Acceptance Scenarios**:

1. **Given** source and destination types are directly compatible, **When** the modal opens, **Then** a D4 section displays a grey-bordered informational message.
2. **Given** text to text mapping, **Then** the message reads: "The value will be copied as-is."
3. **Given** checkbox to text mapping, **Then** the message reads: "True or False."
4. **Given** checkbox to number mapping, **Then** the message reads: "True=>1, False=>0."
5. **Given** the D4 section, **When** the consultant clicks Validate, **Then** the migration logic is marked as validated and the link status changes to green.

---

### Edge Cases

- A source picklist has 100+ values: the D1 value list is scrollable and performant.
- All source picklist values match destination values: auto-equivalence links them all, the consultant just needs to validate.
- No source picklist values match any destination values: the D1 section opens with no auto-links, all must be drawn manually.
- A source picklist value has no appropriate destination equivalent: the value is left unlinked, and the system flags it as an unresolved equivalence.
- The LLM is unavailable when the D2 section loads: example classifications show a fallback message ("Classification unavailable -- check LLM configuration") and the prompt can still be saved.
- The consultant saves a D2 prompt but the LLM produces poor classifications: the consultant can adjust the prompt and re-generate examples.
- A checkbox field is mapped to a picklist: this uses D1 (Value Equivalence) since checkbox has two values (True/False) that need to be mapped to picklist values.
- A number field is mapped to a picklist: this uses D2 (Prompt) to classify numeric ranges into categories.
- The consultant opens a link that already has saved migration logic: the modal loads the existing logic (equivalences, prompt, or status) for editing.

## Type Compatibility Matrix

The section displayed in the migration logic modal is determined by the following matrix:

| Source Type | Destination Type | Section |
|-------------|-----------------|---------|
| Picklist | Checkbox | D1. Value Equivalence |
| Picklist | Picklist | D1. Value Equivalence |
| Picklist | Text | D4. "The value will be copied as-is" |
| Picklist | Number | D3. Error |
| Picklist | Date | D3. Error |
| Text | Number | D3. Error |
| Text | Picklist | D2. Prompt |
| Text | Date | D3. Error |
| Text | Checkbox | D3. Error |
| Text | Text | D4. "The value will be copied as-is" |
| Checkbox | Picklist | D1. Value Equivalence |
| Checkbox | Text | D4. "True or False" |
| Checkbox | Number | D4. "True=>1, False=>0" |
| Checkbox | Date | D3. Error |
| Checkbox | Checkbox | D4. "The value will be copied as-is" |
| Number | Text | D4. "The value will be copied as-is" |
| Number | Picklist | D2. Prompt |
| Number | Date | D3. Error |
| Number | Checkbox | D3. Error |
| Number | Number | D4. "The value will be copied as-is" |
| Date | Text | D4. "The value will be copied as-is" |
| Date | Picklist | D2. Prompt |
| Date | Number | D3. Error |
| Date | Checkbox | D3. Error |
| Date | Date | D4. "The value will be copied as-is" |

## Requirements

### Functional Requirements

- **FR-001**: Clicking a field link (C1) MUST open a migration logic detail modal (C2) showing source field (name + type) on the left and destination field (name + type) on the right.
- **FR-002**: The modal MUST display the appropriate section (D1, D2, D3, or D4) based on the source and destination field types according to the Type Compatibility Matrix.
- **FR-003**: The modal MUST display three action buttons: Cancel, Save, and Validate. For D3 (Error), only Cancel MUST be active.
- **FR-004**: **D1 (Value Equivalence)**: The system MUST display source picklist values on the left and destination picklist values on the right, allowing the consultant to draw lines between them.
- **FR-005**: **D1**: When the modal opens, values with identical or equivalent names MUST be automatically linked.
- **FR-006**: **D1**: A source value MUST map to at most one destination value. Multiple source values MAY map to the same destination value (many-to-one).
- **FR-007**: **D2 (Prompt)**: The system MUST display a text area for the classification prompt with a default placeholder.
- **FR-008**: **D2**: The system MUST display 4-5 example rows, each showing a real source record value and the LLM-generated classification.
- **FR-009**: **D2**: When the consultant modifies the prompt, the example classifications MUST refresh.
- **FR-010**: **D3 (Error)**: The system MUST display a red-bordered message explaining the incompatibility and the CSV fallback procedure.
- **FR-011**: **D4 (Informational)**: The system MUST display a grey-bordered message with the appropriate text based on the type combination.
- **FR-012**: Clicking Save MUST persist the migration logic and set the link status to "defined but not validated" (orange).
- **FR-013**: Clicking Validate MUST persist the migration logic and set the link status to "validated" (green).
- **FR-014**: The system MUST log migration logic creation, modification, and validation to the audit trail (Constitution Principle VI).

### UI Components

- **C2 — Link Detail Modal**: Two-column header (source field left, destination field right) with a type-specific section (D1-D4) in the center and action buttons (Cancel, Save, Validate) at the bottom.
- **D1 — Value Equivalence**: Two-column value list with drag-to-link interaction. Auto-links equivalent values on load.
- **D2 — Prompt**: Text area for classification prompt + 4-5 example rows with real source values and LLM classifications.
- **D3 — Error**: Red-bordered message explaining incompatibility and CSV fallback.
- **D4 — Informational**: Grey-bordered message with type-specific text (no action needed).

### Key Entities

- **MigrationLogic**: Belongs to a FieldMapping. Has an id, fieldMappingId, sectionType (VALUE_EQUIVALENCE | PROMPT | ERROR | INFORMATIONAL), status (DRAFT | DEFINED | VALIDATED), createdAt, updatedAt.
- **ValueEquivalence**: Belongs to a MigrationLogic (when sectionType = VALUE_EQUIVALENCE). Has an id, migrationLogicId, sourceValue, destinationValue.
- **ClassificationPrompt**: Belongs to a MigrationLogic (when sectionType = PROMPT). Has an id, migrationLogicId, promptText.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The migration logic modal opens within 2 seconds of clicking a link, with the correct section displayed.
- **SC-002**: Auto-equivalence of picklist values completes in under 1 second.
- **SC-003**: LLM classification examples are displayed within 5 seconds of opening a D2 section (or prompt modification).
- **SC-004**: A consultant can define value equivalences for a 20-value picklist in under 2 minutes.
- **SC-005**: 100% of type combinations in the matrix are handled -- no combination results in an empty or broken modal.
- **SC-006**: The Save/Validate workflow correctly updates link color status in real time.
- **SC-007**: 100% of migration logic operations are traceable in the audit trail.

## Assumptions

- Migration logic is defined at plan time but executed at migration time (feature 006). This feature covers definition, validation workflow, and LLM-powered classification preview only.
- The LLM for D2 classification is accessed via the Claude API (@anthropic-ai/sdk). If the API key is not configured, D2 sections show a fallback message but the prompt can still be saved.
- The Type Compatibility Matrix is defined at the application level and applies to all connector pairs. Connectors normalize their field types to the common set (Text, Number, Date, Picklist, Checkbox).
- "Equivalent names" for D1 auto-linking means case-insensitive string match or a known synonym table (e.g., "Web" = "Online" is NOT automatic -- only exact case-insensitive matches).
- The CSV fallback for D3 (Error) is a promise communicated to the user. The actual CSV generation is handled by feature 006 (migration execution).
- Real source record values for D2 examples are fetched on-demand from the source connector via the existing record preview capability (feature 009).
