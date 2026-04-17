# Feature Specification: Text Document Generation

**Feature**: 019-text-document
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 018-rule-description-engine, 016-unmapped-fields-detection

## User Story (atomic)

As a consultant, I can generate a readable text document that describes the entire mapping plan for my client, so that non-technical stakeholders can review every object mapping, field mapping, transformation rule, validation rule, migration filter, and unmapped field warning in plain language before the migration is executed.

**Independent Test**: A consultant opens a mapping plan with 2 object mappings (Contact to Contacts with 15 field mappings and 3 rules, Account to Companies with 10 field mappings and 2 rules), plus 3 unmapped source fields and 1 migration filter. The consultant generates a text document and sees: a summary section, two object sections with field mapping tables, rule descriptions in plain language, an unmapped fields warning section, and a filter description. The document is previewed as HTML in the application.

**Acceptance Scenarios**:

1. **Given** a completed mapping plan with one or more object mappings, **When** the consultant triggers text document generation, **Then** an HTML document is generated containing: a summary section (plan name, source system, destination system, object count, field count, rule count), and one section per object mapping.
2. **Given** an object mapping with field mappings, **When** the document is generated, **Then** each object section contains a field mapping table with columns: source field (label + API name), destination field (label + API name), data types (source and destination), transformation rule description (if any), and validation rule description (if any).
3. **Given** field mappings with migration logic, **When** the document is generated, **Then** rule descriptions are obtained from the Rule Description Engine (feature 018) and displayed in plain language.
4. **Given** unmapped source fields detected by feature 016, **When** the document is generated, **Then** a dedicated "Unmapped Fields" section lists every unmapped field per object with an explicit warning that these fields will NOT be migrated (Constitution Principle III).
5. **Given** migration filters defined on an object mapping, **When** the document is generated, **Then** each object section includes a filter description explaining which records will be included (e.g., "Only records where CreatedDate is after 2020-01-01 will be migrated").
6. **Given** a generated text document, **When** the consultant views it in the application, **Then** the document is rendered as HTML and displayed in a preview pane within the application.
7. **Given** a generated text document, **When** the consultant checks the generation stats, **Then** the system displays: total field count, total rule count, unmapped field count, and LLM call count (from rule descriptions).
8. **Given** a mapping plan that has changed since the last document generation, **When** the consultant views the existing document, **Then** the document is NOT automatically updated — the consultant must explicitly regenerate to get a new version reflecting current mappings.
9. **Given** a mapping plan with zero field mappings, **When** the consultant generates a text document, **Then** the document is generated with an explicit "No field mappings defined" message in each affected object section — not an empty document.

## Edge Cases

- A mapping plan has zero object mappings: the document is generated with a summary indicating "No object mappings defined" and no object sections.
- A field mapping has no transformation or validation rules: the table cells for rules show "No transformation" / "No validation" rather than being empty.
- An object mapping has hundreds of field mappings (200+): the document renders all fields without truncation; a table of contents is included if 3+ object mappings exist.
- A rule description from the Rule Description Engine is a fallback (raw code + "requires developer review"): it is displayed as-is in the document with visual distinction (e.g., monospace font, warning styling).
- The document generation encounters an error mid-generation (e.g., database read failure): the generation is aborted, no partial document is saved, and the error is reported to the consultant.
- A mapping plan references a broken mapping (schema changed): the broken mapping is included in the document with a warning flag, not silently omitted.
- Multiple consecutive generations for the same plan: each generation creates a new immutable document version.

## Functional Requirements

- **FR-001**: The system MUST load the complete mapping plan including all object mappings, field mappings, transformation rules, validation rules, migration filters, and unmapped field detections before generating the document.
- **FR-002**: The system MUST generate an HTML document using a template engine with the following structure: summary section, per-object sections (each with field mapping table, rule descriptions, filter descriptions), and unmapped fields section.
- **FR-003**: The summary section MUST include: plan name, plan description (if set), source system name, destination system name, total object mapping count, total field mapping count, total rule count, and generation timestamp.
- **FR-004**: Each object section MUST include: source object name, destination object name, a field mapping table, a transformation rules subsection, a validation rules subsection, a migration filters subsection, and an unmapped fields list for that object.
- **FR-005**: The field mapping table MUST display: source field label and API name, destination field label and API name, source data type, destination data type, transformation description, and validation description.
- **FR-006**: Rule descriptions MUST be obtained from the Rule Description Engine (feature 018) — the document generator MUST NOT generate rule descriptions itself.
- **FR-007**: Unmapped source fields MUST be listed explicitly per object with a warning that they will NOT be migrated (Constitution Principle III).
- **FR-008**: The generated document MUST be immutable once created. Modifications to the mapping plan do NOT retroactively update existing documents. The consultant MUST regenerate to get an updated version.
- **FR-009**: The system MUST track and display generation statistics: total field count, total rule count, unmapped field count, and LLM call count (from the Rule Description Engine batch response).
- **FR-010**: The system MUST preview the generated document as rendered HTML within the application.
- **FR-011**: The system MUST log document generation events (start, completion, error) to the audit trail with plan ID, document type, and generation stats (Constitution Principle VI).
- **FR-012**: The system MUST include a table of contents at the top of the document when the mapping plan contains 3 or more object mappings.
- **FR-013**: The generated document MUST carry a `status` field with values `CURRENT` (default on generation) or `OUTDATED`. Source/destination reconfiguration (see 002 FR-013 and 006 FR-012) MAY transition a `CURRENT` document to `OUTDATED` when the reconfiguration impacts downstream mappings or rules. An `OUTDATED` document MUST remain viewable but MUST display a banner indicating it no longer reflects the current plan and MUST prompt regeneration.
  <!-- Added: 2026-04-17 — supports the reconfiguration cascade defined in 002/006 -->


## Key Entities

- **TextDocument**: An immutable generated text document. Fields: id, mappingPlanId, htmlContent, generatedAt, stats (fieldCount, ruleCount, unmappedCount, llmCallCount).

## Success Criteria

- A text document is generated from a 50-field mapping plan in under 30 seconds (including LLM calls for complex rules).
- 100% of field mappings, rules, unmapped fields, and filters from the mapping plan appear in the generated document — no omissions.
- The document is readable by a non-technical person without external explanation.
- Generation statistics are accurate and match the actual content of the document.
- All document generation events are traceable in the audit trail.

## Assumptions

- Features 013 (migration logic), 016 (unmapped fields detection), and 018 (rule description engine) are implemented before this feature.
- The HTML template is a server-side template (not a React component) rendered by the backend. The template is internal to this feature and not customizable by the consultant in v0.
- The document preview uses an iframe or equivalent to render the HTML within the application shell.
- The text document is not editable after generation in v0. Editing can be a future feature.
- PDF export is handled by feature 019, not by this feature. This feature produces HTML only.
