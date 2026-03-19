# Data Model: Salesforce Source Connector

**Feature**: 001-salesforce-connector
**Date**: 2026-03-19

## Entities

### SalesforceConnection

Represents a configured and authenticated connection to a Salesforce org.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| orgId | string | unique, required | Salesforce org ID (18-char) |
| orgName | string | required | Human-readable org name |
| instanceUrl | string | required | Salesforce instance URL (e.g., https://na1.salesforce.com) |
| refreshToken | string (encrypted) | required | OAuth2 refresh token, stored encrypted |
| accessToken | string | nullable | Current access token (short-lived, nullable when expired) |
| tokenExpiresAt | datetime | nullable | When the current access token expires |
| lastConnectedAt | datetime | required | Timestamp of last successful connection |
| status | enum | required | CONNECTED, EXPIRED, ERROR |
| createdAt | datetime | required | Record creation timestamp |
| updatedAt | datetime | required | Last update timestamp |

**Relationships**: One SalesforceConnection has zero, one, or two SourceSchemas (current + previous).

**State transitions**:
```
[NEW] → CONNECTED (successful OAuth2 flow)
CONNECTED → EXPIRED (access token expired, refresh not yet attempted)
EXPIRED → CONNECTED (successful token refresh)
EXPIRED → ERROR (refresh token revoked or invalid)
ERROR → CONNECTED (user re-authenticates)
```

---

### SourceSchema

A point-in-time snapshot of a Salesforce org's schema. Maximum two per connection (current + previous).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| connectionId | UUID | FK → SalesforceConnection, required | Parent connection |
| snapshotType | enum | required | CURRENT, PREVIOUS |
| objectCount | integer | required | Total number of objects in this snapshot |
| capturedAt | datetime | required | When this snapshot was taken |
| salesforceApiVersion | string | required | API version used (e.g., "v59.0") |
| createdAt | datetime | required | Record creation timestamp |

**Relationships**: One SourceSchema has many SourceObjects.

**Lifecycle**: When a new schema is captured:
1. Delete any PREVIOUS snapshot (and its objects/fields)
2. Promote current CURRENT snapshot to PREVIOUS
3. Insert new snapshot as CURRENT

---

### SourceObject

An object (standard or custom) within a schema snapshot.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| schemaId | UUID | FK → SourceSchema, required | Parent schema snapshot |
| apiName | string | required | Salesforce API name (e.g., "Contact", "Invoice__c") |
| label | string | required | Human-readable label |
| isCustom | boolean | required | True if custom object (ends in __c) |
| fieldCount | integer | required | Total number of fields |
| recordCount | integer | nullable | Total records (populated on demand, not at schema capture) |

**Relationships**: One SourceObject has many SourceFields.

**Uniqueness**: (schemaId, apiName) is unique.

---

### SourceField

A field within an object, including metadata and accessibility info.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| objectId | UUID | FK → SourceObject, required | Parent object |
| apiName | string | required | Salesforce API name (e.g., "FirstName") |
| label | string | required | Human-readable label |
| dataType | string | required | Salesforce field type (string, double, date, picklist, reference, etc.) |
| isRequired | boolean | required | True if field is required for creation |
| isUnique | boolean | required | True if field has unique constraint |
| isReadOnly | boolean | required | True if field cannot be written (formula, auto-number, etc.) |
| isAccessible | boolean | required | True if current user has read access (FLS) |
| isCreateable | boolean | required | True if current user can set value on create |
| isUpdateable | boolean | required | True if current user can modify value |
| relationshipName | string | nullable | Name of the relationship (if lookup/master-detail) |
| referenceTo | string | nullable | API name of the related object (if lookup/master-detail) |
| picklistValues | JSON | nullable | Array of picklist values (if type is picklist/multipicklist) |
| defaultValue | string | nullable | Default value if defined |
| length | integer | nullable | Max length for string fields |
| precision | integer | nullable | Precision for numeric fields |
| scale | integer | nullable | Scale for numeric fields |

**Uniqueness**: (objectId, apiName) is unique.

---

### AuditLog

Records all significant connector operations for traceability (Constitution Principle VI).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| connectionId | UUID | FK → SalesforceConnection, nullable | Related connection (null for system events) |
| operation | enum | required | CONNECT, DISCONNECT, SCHEMA_RETRIEVE, SCHEMA_REFRESH, RECORD_READ, TOKEN_REFRESH, ERROR |
| status | enum | required | SUCCESS, FAILURE, WARNING |
| detail | string | nullable | Human-readable description of the operation |
| metadata | JSON | nullable | Additional context (e.g., object name, record count, error message) |
| apiCallsUsed | integer | nullable | Number of Salesforce API calls consumed by this operation |
| timestamp | datetime | required | When the operation occurred |

## Entity Relationship Diagram (text)

```
SalesforceConnection (1) ──── (0..2) SourceSchema
                                        │
                                        ├── (many) SourceObject
                                        │              │
                                        │              └── (many) SourceField
                                        │
SalesforceConnection (1) ──── (many) AuditLog
```
