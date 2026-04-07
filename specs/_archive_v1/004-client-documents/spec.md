# Feature Specification: Client Documents

**Feature Branch**: `004-client-documents`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Client documents — generate text document describing mappings in natural language and contractual document for client validation sign-off"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a text document describing the mapping in natural language (Priority: P1)

The consultant has finalized their mapping plan. They generate a text document that describes every
object mapping, field mapping, transformation rule, and validation rule in plain, non-technical
language. This document is meant for the client's project manager or business stakeholder who needs
to understand what will happen to their data without reading technical specifications.

**Why this priority**: This is the primary client-facing deliverable. Without it, the consultant
must manually write migration documentation — the core pain point Carbo-v0 solves. Even without
the contractual document, this text description is immediately useful.

**Independent Test**: Generate a text document from a completed mapping plan (SF Contact →
HS Contacts with 10+ field mappings and rules), read it, and verify that a non-technical person
can understand every mapping and rule described.

**Acceptance Scenarios**:

1. **Given** a completed mapping plan, **When** the consultant generates the text document,
   **Then** a document is produced containing: a summary section, one section per object mapping,
   and within each section, a description of every field mapping and its rules.
2. **Given** a field mapping with a transformation rule (e.g., `value.trim().toUpperCase()`),
   **When** the document is generated, **Then** the rule is described in plain language (e.g.,
   "The First Name field will be trimmed of leading/trailing spaces and converted to uppercase").
3. **Given** a field mapping with a validation rule (regex `^[A-Z]{2}$`), **When** the document
   is generated, **Then** the rule is described in plain language (e.g., "The Country Code field
   must contain exactly 2 uppercase letters").
4. **Given** unmapped source fields, **When** the document is generated, **Then** a dedicated
   section lists all unmapped fields with an explicit note that they will not be migrated.
5. **Given** migration filters on an object mapping, **When** the document is generated, **Then**
   the filters are described (e.g., "Only contacts created after January 1, 2020 will be migrated").
6. **Given** a mapping plan, **When** the document is generated, **Then** the document is
   downloadable as a PDF file.

---

### User Story 2 - Generate a contractual document for client sign-off (Priority: P2)

The consultant needs a formal document that the client can review and approve before the migration
is executed. This document is structured with clear sections: scope, field-by-field correspondence
table, transformation rules, validation rules, exclusions (unmapped fields), and a signature block
for client approval.

**Why this priority**: The contractual document formalizes the agreement between consultant and
client. It protects both parties. However, the text document (US1) is useful standalone — the
contractual document adds formality but not new information.

**Independent Test**: Generate a contractual document, verify it contains a complete correspondence
table, all rules, exclusions, and a signature block.

**Acceptance Scenarios**:

1. **Given** a completed mapping plan, **When** the consultant generates the contractual document,
   **Then** the document contains: header (project info, date, parties), scope section, field
   correspondence table, transformation rules section, validation rules section, exclusions
   section, and signature block.
2. **Given** field mappings with rules, **When** the document is generated, **Then** the
   correspondence table shows source field → destination field → transformation → validation
   for every mapping.
3. **Given** unmapped source fields, **When** the document is generated, **Then** the exclusions
   section lists every unmapped field — none are omitted.
4. **Given** migration filters, **When** the document is generated, **Then** the scope section
   explicitly states the filter criteria and estimated record count.
5. **Given** a contractual document, **When** the consultant downloads it, **Then** the document
   is available as a PDF with professional formatting.

---

### Edge Cases

- A mapping plan has zero field mappings: the documents are generated with an explicit "No
  mappings defined" message — not an empty document.
- A mapping plan has no transformation or validation rules: the documents describe the raw
  field-to-field correspondence without rule sections (or with "No rules defined" notes).
- A mapping contains a broken reference (schema changed): the document flags the broken mapping
  with a warning rather than silently omitting it.
- The mapping plan has multiple object mappings (e.g., Contact + Account + Deal): the documents
  contain one section per object mapping, clearly separated.
- A JavaScript transformation function is complex (multi-line): the text document describes the
  intent in plain language (best effort), and the contractual document includes the raw code
  alongside the description.
- The generated document exceeds reasonable size (200+ field mappings): the document is still
  complete but includes a table of contents for navigation.

## Clarifications

### Session 2026-03-19

- Q: Should the document generation use AI for natural language descriptions? → A: Yes — use an LLM to generate plain language descriptions of transformation rules and validation rules. Hardcoded templates for simple rules (fixed value, type check), LLM for complex ones (JS functions, regex patterns).
- Q: What format for the downloadable documents? → A: PDF for both documents. HTML preview in the app before download.
- Q: Can the consultant customize the document before download? → A: Not in v0. The document is generated as-is. Editing can be a future feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST generate a text document describing every object mapping, field
  mapping, transformation rule, validation rule, and unmapped field in plain, non-technical language.
- **FR-002**: The system MUST generate a contractual document with structured sections: header,
  scope, correspondence table, transformation rules, validation rules, exclusions, and signature
  block.
- **FR-003**: The system MUST describe transformation rules in natural language — JavaScript
  functions and regex patterns MUST be translated to human-readable descriptions.
- **FR-004**: The system MUST list all unmapped source fields explicitly in both documents — none
  may be omitted (Constitution Principle III).
- **FR-005**: The system MUST include migration filter criteria and estimated record counts in
  both documents.
- **FR-006**: The system MUST render both documents as HTML preview within the application before
  download.
- **FR-007**: The system MUST export both documents as downloadable PDF files.
- **FR-008**: The system MUST include a table of contents in documents with more than 3 object
  mappings.
- **FR-009**: The system MUST log document generation operations to the audit trail
  (Constitution Principle VI).
- **FR-010**: The system MUST flag broken mappings (schema changes detected) with a warning in
  both documents rather than silently omitting them.

### Key Entities

- **DocumentGeneration**: A record of a document generation event. Tracks which mapping plan was
  used, the document type (text or contractual), generation timestamp, and status.
- **GeneratedDocument**: The generated document content. Stores the HTML content and PDF binary
  for retrieval. Linked to a DocumentGeneration event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A text document is generated from a 50-field mapping plan in under 30 seconds.
- **SC-002**: 100% of field mappings, rules, and unmapped fields appear in both documents — no
  omissions.
- **SC-003**: The text document is understandable by a non-technical reader without external
  explanation.
- **SC-004**: The contractual document includes all required sections (header, scope, table,
  rules, exclusions, signature block) without manual editing.
- **SC-005**: All document generation operations are traceable in the audit trail.

## Assumptions

- Feature 003 (Mapping Plan) is implemented — the document generation consumes the mapping plan
  data model.
- PDF generation uses a server-side rendering approach (HTML → PDF conversion).
- LLM-powered natural language descriptions are generated server-side using the Claude API for
  complex rules. Simple rules use hardcoded templates.
- Documents are not editable after generation in v0. The consultant regenerates if the mapping
  changes.
- The contractual document format is a standard structure defined by Carbo-v0 — not customizable
  per client in v0.
