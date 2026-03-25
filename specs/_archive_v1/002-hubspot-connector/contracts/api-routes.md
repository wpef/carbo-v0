# API Routes: HubSpot Destination Connector

**Feature**: 002-hubspot-connector
**Date**: 2026-03-19

## Authentication

### POST /api/connectors/hubspot/connect

Initiates connection using a private app token (v0) or OAuth2 flow (future).

**Request** (200):
```json
{
  "accessToken": "pat-na1-xxxxxxxx",
  "authType": "PRIVATE_APP"
}
```

**Response** (200):
```json
{
  "connection": {
    "id": "uuid",
    "portalId": "12345678",
    "portalName": "Acme Corp",
    "authType": "PRIVATE_APP",
    "status": "CONNECTED",
    "lastConnectedAt": "2026-03-19T10:00:00Z"
  }
}
```

**Errors**:
- 401: Invalid token or insufficient scopes
- 400: Missing required fields

---

### POST /api/connectors/hubspot/{connectionId}/disconnect

Clears stored token and marks the connection as disconnected.

**Response** (200):
```json
{
  "status": "DISCONNECTED"
}
```

---

## Schema

### GET /api/connectors/hubspot/{connectionId}/objects

Returns all objects from the current schema snapshot.

**Query parameters**:
- `search` (string, optional): Filter objects by label or API name
- `type` (enum, optional): `standard`, `custom`, `all` (default: `all`)

**Response** (200):
```json
{
  "schemaId": "uuid",
  "capturedAt": "2026-03-19T10:00:00Z",
  "objectCount": 12,
  "objects": [
    {
      "id": "uuid",
      "apiName": "contacts",
      "label": "Contacts",
      "isCustom": false,
      "propertyCount": 145,
      "recordCount": null
    }
  ]
}
```

---

### GET /api/connectors/hubspot/{connectionId}/objects/{apiName}/properties

Returns all properties for a specific object.

**Response** (200):
```json
{
  "objectApiName": "contacts",
  "objectLabel": "Contacts",
  "propertyCount": 145,
  "properties": [
    {
      "id": "uuid",
      "apiName": "firstname",
      "label": "First Name",
      "dataType": "string",
      "fieldType": "text",
      "isRequired": false,
      "isReadOnly": false,
      "groupName": "contactinformation",
      "description": "A contact's first name",
      "options": null,
      "createdByCarbo": false
    }
  ]
}
```

---

## Records

### GET /api/connectors/hubspot/{connectionId}/objects/{apiName}/records

Returns paginated records using HubSpot Search API.

**Query parameters**:
- `page` (integer, optional): Page number (default: 1)
- `pageSize` (integer, optional): Records per page, max 100 (default: 50)
- `includeStats` (boolean, optional): Include property-level stats (default: false)

**Response** (200):
```json
{
  "objectApiName": "contacts",
  "totalRecords": 23450,
  "page": 1,
  "pageSize": 50,
  "totalPages": 469,
  "records": [
    {
      "id": "123",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john@acme.com"
    }
  ],
  "stats": {
    "firstname": {
      "nullCount": 45,
      "distinctCount": 1200,
      "sampleValues": ["John", "Jane", "Ahmed"]
    }
  }
}
```

---

## Schema Write

### POST /api/connectors/hubspot/{connectionId}/objects/{apiName}/properties/create

Creates a new property on an existing HubSpot object.

**Request**:
```json
{
  "label": "Migration Source ID",
  "name": "migration_source_id",
  "type": "string",
  "fieldType": "text",
  "groupName": "contactinformation",
  "description": "Original record ID from source system"
}
```

**Response** (201):
```json
{
  "property": {
    "apiName": "migration_source_id",
    "label": "Migration Source ID",
    "dataType": "string",
    "fieldType": "text",
    "groupName": "contactinformation",
    "createdByCarbo": true
  }
}
```

**Errors**:
- 409: Property with this name already exists (includes existing property details)
- 400: Invalid property definition (missing required fields, invalid type)
- 403: Insufficient permissions to create properties

---

### POST /api/connectors/hubspot/{connectionId}/objects/create

Creates a new custom object in HubSpot.

**Request**:
```json
{
  "name": "invoice",
  "labels": {
    "singular": "Invoice",
    "plural": "Invoices"
  },
  "primaryDisplayProperty": "invoice_number",
  "description": "Custom invoice object for migrated data"
}
```

**Response** (201):
```json
{
  "object": {
    "apiName": "p_invoice",
    "label": "Invoice",
    "isCustom": true,
    "propertyCount": 1
  }
}
```

**Errors**:
- 409: Object with this name already exists
- 403: Custom objects not available (requires Enterprise tier)
- 400: Invalid object definition

---

## Schema Refresh

### POST /api/connectors/hubspot/{connectionId}/schema/refresh

Captures a new schema snapshot and returns the diff against the previous one. Same pattern as Salesforce connector (001).

**Response** (200):
```json
{
  "schemaId": "uuid",
  "capturedAt": "2026-03-19T14:00:00Z",
  "objectCount": 13,
  "diff": {
    "objectsAdded": [
      { "apiName": "p_invoice", "label": "Invoice" }
    ],
    "objectsRemoved": [],
    "objectsModified": [
      {
        "apiName": "contacts",
        "propertiesAdded": [
          { "apiName": "migration_source_id", "label": "Migration Source ID", "dataType": "string" }
        ],
        "propertiesRemoved": [],
        "propertiesModified": []
      }
    ]
  }
}
```
