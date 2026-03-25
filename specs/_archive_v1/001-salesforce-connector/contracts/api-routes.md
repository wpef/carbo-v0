# API Routes: Salesforce Source Connector

**Feature**: 001-salesforce-connector
**Date**: 2026-03-19

## Authentication

### POST /api/connectors/salesforce/connect

Initiates OAuth2 Authorization Code flow. Returns the Salesforce authorization URL for the user to be redirected to.

**Request**: empty body

**Response** (200):
```json
{
  "authorizationUrl": "https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=...&redirect_uri=..."
}
```

---

### GET /api/connectors/salesforce/callback?code={code}&state={state}

OAuth2 callback. Exchanges authorization code for tokens, creates the SalesforceConnection, and captures the initial schema snapshot.

**Query parameters**:
- `code` (string, required): Authorization code from Salesforce
- `state` (string, required): CSRF state token for verification

**Response** (200):
```json
{
  "connection": {
    "id": "uuid",
    "orgId": "00Dxx0000001234ABC",
    "orgName": "Acme Corp",
    "instanceUrl": "https://na1.salesforce.com",
    "status": "CONNECTED",
    "lastConnectedAt": "2026-03-19T10:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid or expired authorization code
- 403: Salesforce denied access (insufficient permissions)

---

### POST /api/connectors/salesforce/{connectionId}/disconnect

Revokes tokens and marks the connection as disconnected.

**Response** (200):
```json
{
  "status": "DISCONNECTED"
}
```

---

## Schema

### GET /api/connectors/salesforce/{connectionId}/objects

Returns all objects from the current schema snapshot.

**Query parameters**:
- `search` (string, optional): Filter objects by label or API name
- `type` (enum, optional): `standard`, `custom`, `all` (default: `all`)

**Response** (200):
```json
{
  "schemaId": "uuid",
  "capturedAt": "2026-03-19T10:00:00Z",
  "objectCount": 142,
  "objects": [
    {
      "id": "uuid",
      "apiName": "Contact",
      "label": "Contact",
      "isCustom": false,
      "fieldCount": 67,
      "recordCount": null
    },
    {
      "id": "uuid",
      "apiName": "Invoice__c",
      "label": "Invoice",
      "isCustom": true,
      "fieldCount": 23,
      "recordCount": null
    }
  ]
}
```

---

### GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/fields

Returns all fields for a specific object, including inaccessible fields marked as "no access".

**Response** (200):
```json
{
  "objectApiName": "Contact",
  "objectLabel": "Contact",
  "fieldCount": 67,
  "accessibleCount": 65,
  "restrictedCount": 2,
  "fields": [
    {
      "id": "uuid",
      "apiName": "FirstName",
      "label": "First Name",
      "dataType": "string",
      "isRequired": false,
      "isUnique": false,
      "isReadOnly": false,
      "isAccessible": true,
      "relationshipName": null,
      "referenceTo": null,
      "length": 40,
      "defaultValue": null
    },
    {
      "id": "uuid",
      "apiName": "SSN__c",
      "label": "Social Security Number",
      "dataType": "encryptedstring",
      "isRequired": false,
      "isUnique": false,
      "isReadOnly": false,
      "isAccessible": false,
      "relationshipName": null,
      "referenceTo": null,
      "length": null,
      "defaultValue": null
    }
  ]
}
```

---

## Records

### GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/records

Returns paginated records for a specific object, with optional basic field stats.

**Query parameters**:
- `page` (integer, optional): Page number (default: 1)
- `pageSize` (integer, optional): Records per page, max 2000 (default: 100)
- `includeStats` (boolean, optional): Include field-level stats (default: false)

**Response** (200):
```json
{
  "objectApiName": "Contact",
  "totalRecords": 45230,
  "page": 1,
  "pageSize": 100,
  "totalPages": 453,
  "records": [
    {
      "Id": "003xx000004TmjAAI",
      "FirstName": "John",
      "LastName": "Doe",
      "AccountId": "001xx000003DGbYAAW",
      "Account.Name": "Acme Corp"
    }
  ],
  "stats": {
    "FirstName": {
      "nullCount": 120,
      "distinctCount": 3450,
      "sampleValues": ["John", "Jane", "Ahmed", "Maria", "Li"]
    },
    "LastName": {
      "nullCount": 0,
      "distinctCount": 12300,
      "sampleValues": ["Smith", "Johnson", "Williams", "Brown", "Jones"]
    }
  }
}
```

**Notes**:
- Stats are computed from the full dataset (not just the current page) when `includeStats=true`. This may require additional API calls.
- Relationship fields (lookups) resolve to `RelationshipName.FieldName` format.
- Inaccessible fields (FLS) are excluded from record data but present in the field list.

**Errors**:
- 404: Object not found
- 429: Salesforce rate limit reached (includes `retryAfter` in response)

---

## Schema Refresh

### POST /api/connectors/salesforce/{connectionId}/schema/refresh

Captures a new schema snapshot and returns the diff against the previous one.

**Response** (200):
```json
{
  "schemaId": "uuid",
  "capturedAt": "2026-03-19T14:00:00Z",
  "objectCount": 143,
  "diff": {
    "objectsAdded": [
      { "apiName": "Opportunity__c", "label": "Opportunity Custom" }
    ],
    "objectsRemoved": [],
    "objectsModified": [
      {
        "apiName": "Contact",
        "fieldsAdded": [
          { "apiName": "PreferredLanguage__c", "label": "Preferred Language", "dataType": "picklist" }
        ],
        "fieldsRemoved": [],
        "fieldsModified": [
          {
            "apiName": "Phone",
            "changes": { "isRequired": { "from": false, "to": true } }
          }
        ]
      }
    ]
  }
}
```

**Notes**:
- If no previous snapshot exists (first capture), `diff` is null.
- The previous snapshot is replaced by the former current; the new snapshot becomes current.

**Errors**:
- 401: Token expired and refresh failed — user must re-authenticate
