# Data Model: HubSpot Destination Connector

**Feature**: 002-hubspot-connector
**Date**: 2026-03-19

## Entities

### HubSpotConnection

Represents a configured and authenticated connection to a HubSpot portal.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| portalId | string | unique, required | HubSpot portal ID |
| portalName | string | required | Human-readable portal name |
| accessToken | string (encrypted) | required | Private app token or OAuth2 access token, stored encrypted |
| refreshToken | string (encrypted) | nullable | OAuth2 refresh token (null for private app auth) |
| tokenExpiresAt | datetime | nullable | When the access token expires (null for private app — no expiry) |
| authType | enum | required | PRIVATE_APP, OAUTH2 |
| lastConnectedAt | datetime | required | Timestamp of last successful connection |
| status | enum | required | CONNECTED, EXPIRED, ERROR |
| createdAt | datetime | required | Record creation timestamp |
| updatedAt | datetime | required | Last update timestamp |

**Relationships**: One HubSpotConnection has zero, one, or two DestinationSchemas (current + previous).

**State transitions**:
```
[NEW] → CONNECTED (successful auth)
CONNECTED → EXPIRED (token expired, for OAuth2 only)
EXPIRED → CONNECTED (successful token refresh)
EXPIRED → ERROR (refresh failed)
ERROR → CONNECTED (user re-authenticates)
```

---

### DestinationSchema

A point-in-time snapshot of a HubSpot portal's schema. Maximum two per connection (current + previous).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| connectionId | UUID | FK → HubSpotConnection, required | Parent connection |
| snapshotType | enum | required | CURRENT, PREVIOUS |
| objectCount | integer | required | Total number of objects in this snapshot |
| capturedAt | datetime | required | When this snapshot was taken |
| hubspotApiVersion | string | required | API version used (e.g., "v3") |
| createdAt | datetime | required | Record creation timestamp |

**Relationships**: One DestinationSchema has many DestinationObjects.

**Lifecycle**: Same as SourceSchema (001) — promote current to previous, insert new as current.

---

### DestinationObject

An object (standard or custom) within a schema snapshot.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| schemaId | UUID | FK → DestinationSchema, required | Parent schema snapshot |
| apiName | string | required | HubSpot API name (e.g., "contacts", "companies", "p_custom_obj") |
| label | string | required | Human-readable label |
| isCustom | boolean | required | True if custom object |
| propertyCount | integer | required | Total number of properties |
| recordCount | integer | nullable | Total records (populated on demand) |

**Uniqueness**: (schemaId, apiName) is unique.

---

### DestinationProperty

A property within an object, including metadata and constraints.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| objectId | UUID | FK → DestinationObject, required | Parent object |
| apiName | string | required | HubSpot internal name (e.g., "firstname") |
| label | string | required | Human-readable label |
| dataType | string | required | HubSpot property type (string, number, date, datetime, enumeration, bool) |
| fieldType | string | required | HubSpot field type (text, textarea, select, checkbox, date, number, etc.) |
| isRequired | boolean | required | True if property is required |
| isReadOnly | boolean | required | True if property cannot be modified (calculated, etc.) |
| groupName | string | required | Property group (e.g., "contactinformation") |
| description | string | nullable | Property description |
| options | JSON | nullable | Enumeration options (if type is enumeration) |
| createdByCarbo | boolean | required | True if this property was created by Carbo-v0 (not pre-existing) |

**Uniqueness**: (objectId, apiName) is unique.

---

### AuditLog (shared with 001)

Same entity as defined in feature 001 data model. Extended with HubSpot-specific operation types.

Additional operation enum values for this feature:
- PROPERTY_CREATE
- OBJECT_CREATE
- PROPERTY_CREATE_FAILED
- OBJECT_CREATE_FAILED

## Entity Relationship Diagram (text)

```
HubSpotConnection (1) ──── (0..2) DestinationSchema
                                      │
                                      ├── (many) DestinationObject
                                      │              │
                                      │              └── (many) DestinationProperty
                                      │
HubSpotConnection (1) ──── (many) AuditLog
```

## Cross-Feature Entity Mapping

For the future Connector SDK, these entity pairs are analogous:

| Source (001) | Destination (002) | SDK abstraction |
|-------------|-------------------|-----------------|
| SalesforceConnection | HubSpotConnection | ConnectorConnection |
| SourceSchema | DestinationSchema | ConnectorSchema |
| SourceObject | DestinationObject | ConnectorObject |
| SourceField | DestinationProperty | ConnectorField |
