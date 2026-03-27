# Feature Specification: Field Mapping

**Feature**: 012-field-mapping
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 011-object-mapping

## User Story (atomic)

As a consultant, I can map individual source fields to destination properties within an object mapping and see type compatibility for each pairing. The system indicates whether a source field type and destination property type are compatible (green), require attention (yellow warning -- possible with transformation), or are incompatible (red -- likely data loss). Each source field maps to exactly one destination property within a given object mapping, and each destination property can receive at most one source field mapping.

**Independent Test**: A consultant opens an object mapping (Contact to Contacts), maps source field "FirstName" (string) to destination property "firstname" (string) and sees a green compatibility indicator. Then maps "AnnualRevenue" (currency) to "annualrevenue" (string) and sees a yellow warning. The mappings appear in the field mapping list.

**Acceptance Scenarios**:

1. **Given** an object mapping exists, **When** the consultant maps a source field to a destination property, **Then** the field mapping is created and displayed with a type compatibility indicator.
2. **Given** two fields with the same type (e.g., string to string), **When** the mapping is created, **Then** the compatibility indicator shows "compatible" (green).
3. **Given** two fields with convertible types (e.g., number to string), **When** the mapping is created, **Then** the compatibility indicator shows "warning" (yellow) with a note about the conversion.
4. **Given** two fields with incompatible types (e.g., boolean to date), **When** the mapping is created, **Then** the compatibility indicator shows "incompatible" (red) with an explanation.
5. **Given** a source field is already mapped to a destination property, **When** the consultant attempts to map the same source field to another destination property, **Then** the system rejects the duplicate -- one source field maps to exactly one destination property within an object mapping.
6. **Given** a field mapping exists, **When** the consultant removes it, **Then** the mapping and all its child data (transformation rules, validation rules) are removed, and the parent object mapping progress is updated.

## Edge Cases

- A source field has a type not recognized by the compatibility matrix (e.g., a proprietary Salesforce compound field): the system displays "unknown compatibility" and allows the mapping with a note.
- The destination property is read-only: the system warns that the mapping will fail at execution time unless the field is writable.
- A destination property is of type "enumeration" / "picklist": the system allows the mapping but notes that source values must match allowed values or a transformation rule is needed.
- The consultant removes all field mappings from an object mapping: progress returns to "0/N" and the plan status reverts to DRAFT.
- A source field of type "reference" / "lookup" is mapped to a string property: the system warns that the ID reference may not be meaningful in the destination.

## Functional Requirements

- **FR-001**: The system MUST allow the consultant to create a field mapping within an object mapping by selecting one source field and one destination property.
- **FR-002**: The system MUST enforce one-to-one mapping: each source field maps to at most one destination property, and each destination property receives at most one source field, within a given object mapping.
- **FR-003**: The system MUST display a type compatibility indicator for each field mapping based on a predefined compatibility matrix.
- **FR-004**: The type compatibility matrix MUST cover at minimum the following type pairs: string, number, boolean, date, datetime, email, phone, url, currency, percent, picklist/enumeration, reference/lookup, textarea/long text. Compatibility levels: compatible, warning (convertible with transformation), incompatible.
- **FR-005**: The system MUST allow removing a field mapping with cascade deletion of its transformation rules and validation rules.
- **FR-006**: The system MUST update the parent object mapping progress when field mappings are added or removed.
- **FR-007**: The system MUST log field mapping creation and removal to the audit trail (Constitution Principle VI).

## Key Entities

- **FieldMapping**: Belongs to an ObjectMapping. Has an id, objectMappingId, sourceFieldName, destinationPropertyName, sourceFieldType, destinationPropertyType, compatibilityStatus (COMPATIBLE | WARNING | INCOMPATIBLE), createdAt, updatedAt. Owns zero or more TransformationRules and ValidationRules.

## Success Criteria

- A consultant can create a field mapping in under 3 seconds.
- Type compatibility is evaluated and displayed instantly upon mapping creation.
- The compatibility matrix covers all common type pairs between Salesforce and HubSpot field types, expressed in generic terms.
- Field mapping operations are traceable in the audit trail.

## Assumptions

- Source field types and destination property types are provided by the Connector Interface in a normalized format (features 001 and 002). The field mapping does not query external systems.
- The compatibility matrix is defined at the application level, not per connector pair. Connectors normalize their types to a common set.
- One-to-one mapping is enforced within a single object mapping. The same source field can appear in different object mappings (e.g., if Contact is mapped to both Contacts and Leads).
- Compatibility indicators are advisory -- the system does not block incompatible mappings, as transformation rules may resolve the incompatibility.
