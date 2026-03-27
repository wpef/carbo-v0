# Feature Specification: Transformation Rules

**Feature**: 013-transformation-rules
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 012-field-mapping

## User Story (atomic)

As a consultant, I can define transformation rules on field mappings to control how data is converted during migration. Each rule is one of three types: FIXED_VALUE (a literal value replaces the source value), FIELD_REFERENCE (the value comes from a different source field), or JS_FUNCTION (a JavaScript expression transforms the value). Multiple rules can be attached to a single field mapping and are executed in order (pipeline). JavaScript functions are syntax-validated at definition time using an AST parser so the consultant gets immediate feedback on code errors.

**Independent Test**: A consultant opens a field mapping (FirstName to firstname), adds a JS_FUNCTION rule with body `value.trim().toUpperCase()` -- it is accepted. Then adds a FIXED_VALUE rule with value "UNKNOWN" as a second rule. Both rules appear in order. The consultant then tries adding a JS_FUNCTION with body `value.trim(.` -- the system rejects it with a syntax error message.

**Acceptance Scenarios**:

1. **Given** a field mapping exists, **When** the consultant adds a FIXED_VALUE transformation rule with a literal value (e.g., "FR"), **Then** the rule is created, attached to the field mapping, and displayed with its type and value.
2. **Given** a field mapping exists, **When** the consultant adds a FIELD_REFERENCE transformation rule referencing another source field (e.g., "MailingCountry"), **Then** the rule is created with the referenced field name clearly displayed.
3. **Given** a field mapping exists, **When** the consultant adds a JS_FUNCTION transformation rule with valid JavaScript (e.g., `value.trim().toUpperCase()`), **Then** the rule is created and the function body is displayed.
4. **Given** a field mapping exists, **When** the consultant adds a JS_FUNCTION transformation rule with invalid JavaScript syntax, **Then** the system rejects the rule immediately with a clear syntax error message including the line and position of the error.
5. **Given** a field mapping with multiple transformation rules, **When** the consultant views the rules, **Then** they are displayed in execution order and the consultant can reorder them.
6. **Given** a transformation rule exists, **When** the consultant removes it, **Then** the rule is deleted and remaining rules maintain their order.

## Edge Cases

- A FIELD_REFERENCE references a source field that does not exist in the source object: the system rejects the rule with a clear error.
- A FIXED_VALUE is an empty string: the system allows it (empty string is a valid literal value).
- A JS_FUNCTION body is syntactically valid but semantically nonsensical (e.g., `undefined`): the system accepts it at definition time (only syntax is validated; semantic validation happens at execution time in feature 006).
- A field mapping has 10+ transformation rules: the system supports it without limit, displaying all rules in order.
- The consultant reorders rules: the execution order updates accordingly.
- A FIELD_REFERENCE references a field from the same source object only -- cross-object references are not supported.

## Functional Requirements

- **FR-001**: The system MUST support three transformation rule types: FIXED_VALUE, FIELD_REFERENCE, and JS_FUNCTION.
- **FR-002**: The system MUST allow attaching multiple transformation rules to a single field mapping, with an explicit execution order.
- **FR-003**: The system MUST validate JS_FUNCTION rule bodies for syntax errors at definition time using an AST parser (e.g., acorn). Syntax errors MUST be reported immediately with line and position information.
- **FR-004**: The system MUST validate that FIELD_REFERENCE rules reference an existing field in the source object's schema.
- **FR-005**: The system MUST allow reordering transformation rules on a field mapping.
- **FR-006**: The system MUST allow removing individual transformation rules without affecting other rules on the same field mapping.
- **FR-007**: The system MUST log transformation rule creation, modification, reordering, and removal to the audit trail (Constitution Principle VI).

## Key Entities

- **TransformationRule**: Belongs to a FieldMapping. Has an id, fieldMappingId, type (FIXED_VALUE | FIELD_REFERENCE | JS_FUNCTION), value (the literal value, field name, or function body depending on type), executionOrder (integer), createdAt, updatedAt.

## Success Criteria

- JavaScript syntax validation responds in under 1 second for function bodies up to 500 characters.
- Transformation rules are persisted and displayed in the correct execution order.
- Invalid JavaScript is never accepted -- 100% of syntax errors are caught at definition time.
- All rule operations are traceable in the audit trail.

## Assumptions

- Transformation rules are defined at plan time but executed at migration time (feature 006). This feature only covers definition and validation.
- JS_FUNCTION rules receive a `value` variable representing the current field value at execution time. The exact execution context is defined by feature 006.
- Syntax validation uses static analysis only -- no code is executed at definition time.
- FIELD_REFERENCE is limited to fields within the same source object. Cross-object references are out of scope.
