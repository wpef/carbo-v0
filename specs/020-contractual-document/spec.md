# Feature Specification: Contractual Document Generation

**Feature**: 020-contractual-document
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 018-rule-description-engine, 016-unmapped-fields-detection

## User Story (atomic)

As a consultant, I can generate a formal contractual document with signature block for client sign-off, so that the client can review, approve, and sign a structured document that precisely describes the migration scope, field-by-field correspondences, migration logic rules (013), explicit exclusions, and filters before execution begins.

**Independent Test**: A consultant opens a migration plan with 3 object mappings, 40 field mappings, 8 migration logic rules, 5 unmapped fields, and 2 migration filters. The consultant generates a contractual document and sees: a header with document reference, a table of contents (3+ object mappings), a scope section, correspondence tables per object, a migration logic rules section, exclusions section listing all unmapped fields, a filter table, and a signature block with fields for client name, date, and signature. The document is previewed as HTML.

**Acceptance Scenarios**:

1. **Given** a completed migration plan, **When** the consultant triggers contractual document generation, **Then** an HTML document is generated with formal layout containing all required sections: header, scope, correspondence tables, migration logic rules, exclusions, filters, and signature block.
2. **Given** the generated document, **When** the consultant views the header section, **Then** it contains: a document reference number (auto-generated, unique), the plan name, source system name, destination system name, generation date, and consultant name (from application context or plan metadata).
3. **Given** a migration plan with 3 or more object mappings, **When** the document is generated, **Then** a table of contents is included after the header, listing all sections with their page/section references.
4. **Given** a migration plan with 2 or fewer object mappings, **When** the document is generated, **Then** no table of contents is included.
5. **Given** the scope section, **When** the consultant reads it, **Then** it describes the migration perimeter: which source system, which destination system, how many objects, how many fields, and any active migration filters with their criteria.
6. **Given** an object mapping with field mappings, **When** the correspondence table is generated, **Then** it contains one row per field mapping with columns: source field (label + API name), destination field (label + API name), source type, destination type, and migration logic rule description.
7. **Given** field mappings with migration logic rules (013), **When** the migration logic rules section is generated, **Then** each rule is listed with: the field it applies to (source and destination), the rule type (any of the kinds defined in 013), and the plain language description from the Rule Description Engine (feature 018).
8. **Given** unmapped source fields, **When** the exclusions section is generated, **Then** it lists every unmapped field per object under the heading "Will NOT be migrated" with explicit acknowledgment that these fields are excluded from the migration scope (Constitution Principle III).
9. **Given** migration filters defined on object mappings, **When** the filter table is generated, **Then** it lists each filter with: the object it applies to, the field, the operator, the value, and a plain language description of the filter's effect.
10. **Given** the signature block, **When** the consultant views it, **Then** it contains fields for: client approval (checkbox or line), client name, date, and signature (line for manual signature).
11. **Given** a generated contractual document, **When** the consultant views it, **Then** the document is rendered as HTML in a preview pane within the application, with formal styling distinct from the text document.
12. **Given** a migration plan that has changed since the last document generation, **When** the consultant views the existing contractual document, **Then** the document is NOT updated — the consultant must explicitly regenerate.

## Edge Cases

- A migration plan has zero field mappings: the document is generated with correspondence tables showing "No field mappings defined" and the exclusions section lists all source fields as unmapped.
- A migration plan has no migration logic rules: the rules section is included with a "No migration logic rules defined" note — the section is not omitted.
- A migration plan has no unmapped fields (100% mapped): the exclusions section is included with "All source fields are mapped — no exclusions" — the section is not omitted.
- A migration plan has no migration filters: the filter table is included with "No migration filters defined" — the section is not omitted.
- A broken mapping (schema changed) is present: it appears in the correspondence table with a warning flag and an explanatory note, not silently omitted.
- A migration plan has a single object mapping: no table of contents; all sections still present.
- Multiple consecutive generations: each creates a new immutable document version with a unique reference number.
- The document reference number must be unique across all generated documents, not just within a plan.

## Functional Requirements

- **FR-001**: The system MUST generate an HTML document with formal contractual layout, visually distinct from the text document (feature 017).
- **FR-002**: The document MUST contain a header section with: auto-generated unique document reference number, plan name, source system name, destination system name, generation date, and consultant identifier.
- **FR-003**: The document MUST contain a table of contents when the migration plan has 3 or more object mappings. The table of contents MUST list all sections.
- **FR-004**: The document MUST contain a scope section describing: the migration perimeter (source system, destination system, object count, field count), and any active migration filters with their criteria.
- **FR-005**: The document MUST contain one correspondence table per object mapping with columns: source field (label + API name), destination field (label + API name), source type, destination type, and migration logic rule description.
- **FR-006**: The document MUST contain a dedicated migration logic rules section listing all rules across all object mappings (covering every rule kind defined in 013), with field references and plain language descriptions from the Rule Description Engine (feature 018).
- **FR-007**: The document MUST contain an exclusions section titled "Will NOT be migrated" listing every unmapped source field per object (Constitution Principle III). If no fields are unmapped, the section MUST state "All source fields are mapped — no exclusions".
- **FR-008**: The document MUST contain a filter table listing each migration filter with: object, field, operator, value, and plain language effect description.
- **FR-009**: The document MUST contain a signature block with: client approval field, client name field, date field, and signature field (for manual print-and-sign or future digital signature).
- **FR-010**: The generated document MUST be immutable once created. Modifications to the migration plan do NOT retroactively update existing documents.
- **FR-011**: The system MUST preview the generated document as rendered HTML within the application.
- **FR-012**: The system MUST log document generation events to the audit trail with plan ID, document type, reference number, and generation stats (Constitution Principle VI).
- **FR-013**: The document reference number MUST be unique across all generated contractual documents (e.g., `CARBO-YYYYMMDD-XXXX` format).
- **FR-014**: All sections (scope, correspondence, rules, exclusions, filters, signature) MUST be present in every generated document, even if empty — no section is conditionally omitted.
- **FR-015**: The generated document MUST carry a `status` field with values `CURRENT` (default on generation) or `OUTDATED`. Source/destination reconfiguration (see 002 FR-013 and 006 FR-012) MAY transition a `CURRENT` document to `OUTDATED` when the reconfiguration impacts downstream mappings, rules, or the signed scope. An `OUTDATED` contractual document MUST remain viewable (audit/legal trail) but MUST display a prominent banner indicating it no longer reflects the current plan; regeneration MUST produce a new document with a new reference number, never overwriting the outdated one.
  <!-- Added: 2026-04-17 — supports the reconfiguration cascade defined in 002/006 -->


## Key Entities

- **ContractualDocument**: An immutable generated contractual document. Fields: id, mappingPlanId, referenceNumber (unique), htmlContent, generatedAt, stats (fieldCount, ruleCount, unmappedCount, filterCount, llmCallCount).

## Success Criteria

- A contractual document is generated from a 50-field migration plan in under 30 seconds.
- 100% of field mappings, rules, unmapped fields, and filters appear in the document — no omissions.
- The document contains all required sections (header, scope, correspondence, migration logic rules, exclusions, filters, signature block) without manual editing.
- The table of contents is present when 3+ object mappings exist, absent otherwise.
- All document generation events are traceable in the audit trail.
- The document reference number is unique across all generated documents.

## Assumptions

- Features 018 (rule description engine) and 016 (unmapped fields detection) are implemented before this feature.
- The formal layout is defined by an internal HTML/CSS template, not customizable by the consultant in v0.
- The signature block is designed for print-and-sign workflow. Digital signature is out of scope for v0.
- PDF export is handled by feature 019, not by this feature. This feature produces HTML only.
- The consultant identifier in the header comes from application context or plan metadata — user authentication is not required (out of scope until Phase 3).
