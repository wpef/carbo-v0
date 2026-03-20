# Data Model: Mapping Plan

**Feature**: 003-mapping-plan
**Date**: 2026-03-19

## Entities

### MappingPlan

The top-level plan linking a source connection to a destination connection.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | string | required | Human-readable plan name |
| description | string | nullable | Optional description |
| sourceConnectionId | UUID | FK → SalesforceConnection, required | Source connector |
| destinationConnectionId | UUID | FK → HubSpotConnection, required | Destination connector |
| status | enum | required | DRAFT, COMPLETE, BROKEN |
| createdAt | datetime | required | Record creation timestamp |
| updatedAt | datetime | required | Last update timestamp |

**Relationships**: One MappingPlan has many ObjectMappings.

**State transitions**:
```
[NEW] → DRAFT (created, no mappings yet)
DRAFT → COMPLETE (all required destination fields mapped, no broken references)
COMPLETE → BROKEN (schema change detected that breaks existing mappings)
BROKEN → DRAFT (consultant fixes broken mappings)
DRAFT → COMPLETE (all issues resolved)
```

---

### ObjectMapping

A correspondence between one source object and one destination object.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| planId | UUID | FK → MappingPlan, required | Parent plan |
| sourceObjectApiName | string | required | Source object API name (e.g., "Contact") |
| sourceObjectLabel | string | required | Source object label |
| destinationObjectApiName | string | required | Destination object API name (e.g., "contacts") |
| destinationObjectLabel | string | required | Destination object label |
| totalSourceFields | integer | required | Total fields in source object |
| mappedFieldCount | integer | required | Number of mapped fields |
| createdAt | datetime | required | Record creation timestamp |
| updatedAt | datetime | required | Last update timestamp |

**Relationships**: One ObjectMapping has many FieldMappings and many MigrationFilters.

**Uniqueness**: (planId, sourceObjectApiName, destinationObjectApiName) is unique.

---

### FieldMapping

A correspondence between one source field and one destination property.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| objectMappingId | UUID | FK → ObjectMapping, required | Parent object mapping |
| sourceFieldApiName | string | required | Source field API name |
| sourceFieldLabel | string | required | Source field label |
| sourceFieldType | string | required | Source field data type |
| destinationPropertyApiName | string | required | Destination property API name |
| destinationPropertyLabel | string | required | Destination property label |
| destinationPropertyType | string | required | Destination property data type |
| isTypeCompatible | boolean | required | Whether source and destination types are directly compatible |
| status | enum | required | VALID, WARNING (type mismatch), BROKEN (field deleted) |
| createdAt | datetime | required | Record creation timestamp |
| updatedAt | datetime | required | Last update timestamp |

**Relationships**: One FieldMapping has many TransformationRules and many ValidationRules.

**Uniqueness**: (objectMappingId, sourceFieldApiName) is unique (one source field maps once per object mapping).

---

### TransformationRule

A rule applied to transform a source value before writing to the destination.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| fieldMappingId | UUID | FK → FieldMapping, required | Parent field mapping |
| type | enum | required | FIXED_VALUE, FIELD_REFERENCE, JS_FUNCTION |
| value | string | required | The rule value: fixed string, source field API name, or JS code |
| orderIndex | integer | required | Execution order (0-based) |
| createdAt | datetime | required | Record creation timestamp |

**Notes**:
- FIXED_VALUE: `value` contains the literal value to use.
- FIELD_REFERENCE: `value` contains the API name of another source field.
- JS_FUNCTION: `value` contains JavaScript code. Syntax validated at definition time via acorn.

---

### ValidationRule

A rule that validates a value against a constraint before migration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| fieldMappingId | UUID | FK → FieldMapping, required | Parent field mapping |
| type | enum | required | TYPE_CHECK, REGEX |
| value | string | required | Expected type name or regex pattern |
| createdAt | datetime | required | Record creation timestamp |

**Notes**:
- TYPE_CHECK: `value` contains the expected type (e.g., "string", "number", "date").
- REGEX: `value` contains the regex pattern (e.g., `^[A-Z]{2}$`).

---

### MigrationFilter

A filter condition on source records for an object mapping.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| objectMappingId | UUID | FK → ObjectMapping, required | Parent object mapping |
| sourceFieldApiName | string | required | Source field to filter on |
| sourceFieldLabel | string | required | Source field label |
| operator | enum | required | EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GREATER_THAN, LESS_THAN, DATE_AFTER, DATE_BEFORE |
| value | string | required | Filter value |
| orderIndex | integer | required | Order within the filter list (combined with AND) |
| createdAt | datetime | required | Record creation timestamp |

## Entity Relationship Diagram (text)

```
MappingPlan (1) ──── (many) ObjectMapping
                                │
                                ├── (many) FieldMapping
                                │              │
                                │              ├── (many) TransformationRule
                                │              │
                                │              └── (many) ValidationRule
                                │
                                └── (many) MigrationFilter

MappingPlan ──── FK → SalesforceConnection (source)
MappingPlan ──── FK → HubSpotConnection (destination)
```
