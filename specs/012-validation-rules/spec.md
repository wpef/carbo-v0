# Feature Specification: Validation Rules

**Feature**: 012-validation-rules
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 010-field-mapping

## User Story (atomic)

As a consultant, I can define validation rules on field mappings to ensure data quality before migration. Each rule is one of two types: TYPE_CHECK (the value must be of an expected data type, e.g., number, date, email) or REGEX (the value must match a regular expression pattern). Multiple validation rules can be attached to a single field mapping. Regex patterns are validated at definition time so the consultant gets immediate feedback on invalid patterns.

**Independent Test**: A consultant opens a field mapping, adds a TYPE_CHECK rule expecting "email", then adds a REGEX rule with pattern `^[A-Z]{2}$`. Both rules appear on the field mapping. The consultant then tries adding a REGEX rule with pattern `^[A-Z{2$` (invalid regex) -- the system rejects it with an error message.

**Acceptance Scenarios**:

1. **Given** a field mapping exists, **When** the consultant adds a TYPE_CHECK validation rule with an expected type (e.g., "number"), **Then** the rule is created and displayed with the expected type.
2. **Given** a field mapping exists, **When** the consultant adds a REGEX validation rule with a valid pattern (e.g., `^[A-Z]{2}$`), **Then** the rule is created and the pattern is displayed.
3. **Given** a field mapping exists, **When** the consultant adds a REGEX validation rule with an invalid regex pattern, **Then** the system rejects the rule immediately with a clear error message describing the regex syntax problem.
4. **Given** a field mapping with multiple validation rules, **When** the consultant views the rules, **Then** all rules are listed clearly with their type and configuration.
5. **Given** a validation rule exists, **When** the consultant removes it, **Then** the rule is deleted without affecting other rules on the same field mapping.

## Edge Cases

- A REGEX pattern is valid but extremely broad (e.g., `.*`): the system accepts it (the consultant is responsible for defining meaningful patterns).
- A TYPE_CHECK specifies a type that does not match the destination property type: the system allows it (the consultant may want to validate source data against a type different from the destination).
- A field mapping has both transformation rules and validation rules: the system supports both coexisting. The execution order (transform then validate, or validate then transform) is defined by feature 006.
- An empty regex pattern is provided: the system rejects it with a message that the pattern cannot be empty.
- The consultant adds duplicate validation rules (same type and same value): the system allows it but displays a warning.

## Functional Requirements

- **FR-001**: The system MUST support two validation rule types: TYPE_CHECK and REGEX.
- **FR-002**: The system MUST allow attaching multiple validation rules to a single field mapping.
- **FR-003**: The system MUST validate REGEX rule patterns for syntax errors at definition time. Invalid regex patterns MUST be rejected immediately with a descriptive error message.
- **FR-004**: TYPE_CHECK rules MUST support at minimum the following expected types: string, number, boolean, date, datetime, email.
- **FR-005**: The system MUST allow removing individual validation rules without affecting other rules on the same field mapping.
- **FR-006**: The system MUST log validation rule creation and removal to the audit trail (Constitution Principle VI).

## Key Entities

- **ValidationRule**: Belongs to a FieldMapping. Has an id, fieldMappingId, type (TYPE_CHECK | REGEX), value (the expected type name or regex pattern depending on type), createdAt, updatedAt.

## Success Criteria

- Regex pattern validation responds in under 1 second.
- Invalid regex patterns are never accepted -- 100% of syntax errors are caught at definition time.
- Validation rules are correctly persisted and displayed on their parent field mapping.
- All rule operations are traceable in the audit trail.

## Assumptions

- Validation rules are defined at plan time but evaluated at migration time (feature 006). This feature only covers definition and validation of rule syntax.
- The interaction between transformation rules and validation rules (order of execution) is defined by feature 006, not this feature.
- TYPE_CHECK expected types use a common type vocabulary shared across connectors, not connector-specific type names.
- Validation rule failures at migration time will flag the record but not halt the migration (behavior defined by feature 006).
