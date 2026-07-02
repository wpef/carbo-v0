# API Routes: HubSpot Adapter

**Feature**: adapters/hubspot
**Date**: 2026-05-18

## Authentication

### POST /api/connectors/hubspot/connect

Validates a Private App access token by calling the HubSpot account info endpoint. Creates a connection on success.

**Request**:
```json
{
  "accessToken": "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Response** (200):
```json
{
  "connection": {
    "id": "uuid",
    "portalId": "12345678",
    "portalName": "Acme Corp",
    "status": "CONNECTED",
    "authMethod": "private_app",
    "connectedAt": "2026-05-18T10:00:00Z"
  }
}
```

**Errors**:
- 401: Invalid or revoked token (message: "Invalid HubSpot Private App token. Verify the token in HubSpot Settings > Integrations > Private Apps.")
- 400: Missing accessToken in request body

---

### GET /api/connectors/hubspot/oauth

Initiates the OAuth2 authorization code flow. Returns the HubSpot authorization URL.

**Response** (200):
```json
{
  "authorizationUrl": "https://app.hubspot.com/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=..."
}
```

**Notes**:
- `state` is a random CSRF token stored server-side for verification on callback.
- Scopes requested: `crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write crm.objects.deals.read crm.objects.deals.write crm.objects.custom.read crm.objects.custom.write crm.schemas.contacts.read crm.schemas.companies.read crm.schemas.deals.read crm.schemas.custom.read crm.schemas.custom.write`.

---

### GET /api/connectors/hubspot/oauth/callback?code={code}&state={state}

OAuth2 callback. Exchanges the authorization code for tokens, validates the account, and creates the connection. Redirects to the destination page with a `?connected=hubspot` query parameter (per feature 006 FR-016).

**Query parameters**:
- `code` (string, required): Authorization code from HubSpot
- `state` (string, required): CSRF state token for verification

**Response**: 302 redirect to `/plans/{planId}/destination?connected=hubspot`

**Errors**:
- 400: Invalid or expired authorization code
- 400: State mismatch (CSRF protection)
- 403: HubSpot denied access (insufficient scopes)

---

### POST /api/connectors/hubspot/{connectionId}/disconnect

Marks the connection as disconnected. Does not revoke the HubSpot token (Private App tokens are managed in HubSpot UI; OAuth tokens expire naturally).

**Response** (200):
```json
{
  "status": "DISCONNECTED"
}
```

---

## Schema

### GET /api/connectors/hubspot/{connectionId}/objects

Returns all objects from the HubSpot portal: standard CRM objects + custom objects (if Enterprise).

**Query parameters**:
- `search` (string, optional): Filter objects by label or API name

**Response** (200):
```json
{
  "connectionId": "uuid",
  "retrievedAt": "2026-05-18T10:01:00Z",
  "objectCount": 7,
  "objects": [
    {
      "apiName": "contacts",
      "label": "Contacts",
      "isCustom": false
    },
    {
      "apiName": "companies",
      "label": "Companies",
      "isCustom": false
    },
    {
      "apiName": "deals",
      "label": "Deals",
      "isCustom": false
    },
    {
      "apiName": "tickets",
      "label": "Tickets",
      "isCustom": false
    },
    {
      "apiName": "line_items",
      "label": "Line Items",
      "isCustom": false
    },
    {
      "apiName": "2-12345",
      "label": "Migration Entity",
      "isCustom": true
    }
  ],
  "customObjectsNote": null
}
```

**When custom objects are unavailable** (non-Enterprise portal):
```json
{
  "objectCount": 5,
  "objects": [ /* standard objects only */ ],
  "customObjectsNote": "Custom objects require HubSpot Enterprise tier. Only standard objects are available."
}
```

**Errors**:
- 401: Token expired or invalid

---

### GET /api/connectors/hubspot/{connectionId}/objects/{apiName}/fields

Returns all properties for a specific HubSpot object.

**Response** (200):
```json
{
  "objectApiName": "contacts",
  "objectLabel": "Contacts",
  "propertyCount": 87,
  "fields": [
    {
      "apiName": "firstname",
      "label": "First Name",
      "dataType": "string",
      "fieldType": "text",
      "groupName": "contactinformation",
      "description": "A contact's first name",
      "isRequired": false,
      "isReadOnly": false,
      "isUnique": false,
      "isCreatable": true
    },
    {
      "apiName": "hs_lead_status",
      "label": "Lead Status",
      "dataType": "enumeration",
      "fieldType": "select",
      "groupName": "contactinformation",
      "description": "",
      "isRequired": false,
      "isReadOnly": false,
      "isUnique": false,
      "isCreatable": true,
      "options": [
        { "label": "New", "value": "NEW" },
        { "label": "Open", "value": "OPEN" },
        { "label": "In Progress", "value": "IN_PROGRESS" }
      ]
    },
    {
      "apiName": "hs_analytics_source",
      "label": "Original Source",
      "dataType": "enumeration",
      "fieldType": "select",
      "groupName": "analyticsinformation",
      "description": "",
      "isRequired": false,
      "isReadOnly": true,
      "isUnique": false,
      "isCreatable": false,
      "nonCreatableReason": "Calculated property managed by HubSpot"
    }
  ]
}
```

**Notes**:
- `isCreatable` indicates whether this property type can be created from Carbo-v0. Non-creatable types (calculation, score, rich_text, object_coordinates) are flagged.
- `options` is present only for enumeration properties.

**Errors**:
- 404: Object not found
- 401: Token expired or invalid

---

## Records

### GET /api/connectors/hubspot/{connectionId}/objects/{apiName}/records

Returns paginated records for a specific object, with optional field-level stats.

**Query parameters**:
- `page` (integer, required): Page number (1-indexed per FR-012). Must be >= 1.
- `pageSize` (integer, optional): Records per page, max 100 (default: 25). HubSpot Search API limit.
- `includeStats` (boolean, optional): Include field-level stats (default: false)

**Response** (200):
```json
{
  "objectApiName": "contacts",
  "totalCount": 15420,
  "page": 1,
  "pageSize": 25,
  "hasNextPage": true,
  "records": [
    {
      "hs_object_id": "12345",
      "firstname": "John",
      "lastname": "Doe",
      "email": "john.doe@example.com",
      "createdate": "2025-11-01T08:30:00Z"
    }
  ],
  "stats": {
    "firstname": {
      "fieldApiName": "firstname",
      "nullCount": 342,
      "distinctCount": 4200,
      "sampleValues": ["John", "Jane", "Ahmed", "Maria", "Li"]
    },
    "email": {
      "fieldApiName": "email",
      "nullCount": 0,
      "distinctCount": 15420,
      "sampleValues": ["john@example.com", "jane@acme.co", "info@test.org"]
    }
  }
}
```

**Notes**:
- `totalCount` comes from a separate count query (Search API with `limit=0`).
- Stats are computed from the retrieved records on the current page (not from the full dataset -- HubSpot Search API has a 10,000 result cap). This is a known limitation documented in the UI.
- Cursor-based pagination is used internally. The adapter caches cursors per connection+object to avoid re-walking for subsequent pages.

**Errors**:
- 400: `page` < 1 (contract violation per FR-012)
- 404: Object not found
- 429: Rate limit exceeded (includes `retryAfter` in response)

---

## Schema Write

### POST /api/connectors/hubspot/{connectionId}/schema-write/property

Creates a new property on an existing HubSpot object.

**Request**:
```json
{
  "objectApiName": "contacts",
  "property": {
    "name": "migration_source_id",
    "label": "Migration Source ID",
    "type": "string",
    "fieldType": "text",
    "groupName": "contactinformation",
    "description": "Source system record ID for migration traceability"
  }
}
```

**Response** (201):
```json
{
  "created": true,
  "field": {
    "apiName": "migration_source_id",
    "label": "Migration Source ID",
    "dataType": "string",
    "fieldType": "text",
    "groupName": "contactinformation",
    "isRequired": false,
    "isReadOnly": false,
    "isUnique": false
  }
}
```

**Errors**:
- 400: Missing required fields (name, label, type, fieldType, groupName)
- 400: Invalid property type (not in creatable types: string, number, date, datetime, enumeration, boolean)
- 409: Property with the same name already exists on this object. Response includes existing property details:
  ```json
  {
    "error": "PROPERTY_EXISTS",
    "message": "A property named 'migration_source_id' already exists on 'contacts'.",
    "existingProperty": {
      "apiName": "migration_source_id",
      "label": "Migration Source ID",
      "dataType": "string",
      "isReadOnly": false
    }
  }
  ```
- 400: Custom property limit reached (HubSpot error message forwarded)
- 401: Token expired or invalid

---

### POST /api/connectors/hubspot/{connectionId}/schema-write/object

Creates a new custom object on the HubSpot portal (requires Enterprise tier).

**Request**:
```json
{
  "object": {
    "name": "custom_migration_entity",
    "labels": {
      "singular": "Migration Entity",
      "plural": "Migration Entities"
    },
    "primaryDisplayProperty": "name",
    "properties": [
      {
        "name": "name",
        "label": "Name",
        "type": "string",
        "fieldType": "text"
      }
    ]
  }
}
```

**Response** (201):
```json
{
  "created": true,
  "object": {
    "apiName": "2-12345",
    "label": "Migration Entity",
    "isCustom": true
  }
}
```

**Errors**:
- 403: Portal does not have Enterprise tier. Response:
  ```json
  {
    "error": "ENTERPRISE_REQUIRED",
    "message": "Custom object creation requires HubSpot Enterprise tier. This portal does not have the required subscription."
  }
  ```
- 400: Missing required fields (name, labels, primaryDisplayProperty, properties)
- 409: Object with the same name already exists
- 401: Token expired or invalid

---

## Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description of what went wrong.",
  "details": {}
}
```

Error codes:
- `INVALID_TOKEN` -- token is invalid, expired, or revoked
- `RATE_LIMITED` -- 429 response after max retries exhausted
- `PROPERTY_EXISTS` -- property name conflict
- `ENTERPRISE_REQUIRED` -- operation requires Enterprise tier
- `INVALID_TYPE` -- property type not in creatable list
- `VALIDATION_ERROR` -- missing or invalid request fields
- `HUBSPOT_ERROR` -- unclassified error from HubSpot API (original message forwarded)
