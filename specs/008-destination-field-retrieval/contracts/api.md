# API Contract: Destination Field Retrieval

**Base path**: `/api/plans/[planId]/destination-fields`

## POST /api/plans/[planId]/destination-fields

Retrieve fields for all destination objects in the CURRENT schema snapshot.

**Request**: No body required.

**Response 201**:
```json
{
  "objectsWithFields": [
    {
      "objectApiName": "contacts",
      "objectLabel": "Contacts",
      "fieldCount": 45,
      "fields": [
        {
          "id": "uuid",
          "apiName": "email",
          "label": "Email",
          "dataType": "string",
          "isRequired": true,
          "isReadOnly": false,
          "isUnique": true,
          "isAccessible": true,
          "referenceTo": null,
          "relationshipType": null
        }
      ]
    }
  ],
  "totalFieldCount": 312,
  "failedObjects": []
}
```

**Response 200** (partial failure):
```json
{
  "objectsWithFields": [ "..." ],
  "totalFieldCount": 280,
  "failedObjects": [
    { "objectApiName": "custom_obj", "error": "Permission denied" }
  ]
}
```

**Response 400**: No destination schema snapshot exists.
```json
{ "error": "No destination schema. Retrieve schema first." }
```

## GET /api/plans/[planId]/destination-fields

Get persisted fields. Optional `object` query param to filter by object.

**Query params**:
- `object` (optional): Filter by object API name (e.g., `?object=contacts`)

**Response 200**:
```json
{
  "fields": [
    {
      "id": "uuid",
      "objectApiName": "contacts",
      "apiName": "email",
      "label": "Email",
      "dataType": "string",
      "isRequired": true,
      "isReadOnly": false,
      "isUnique": true,
      "isAccessible": true,
      "referenceTo": null,
      "relationshipType": null
    }
  ]
}
```

## Audit Trail Events

| Event | Payload |
|-------|---------|
| `destination.fields.retrieved` | `{ planId, connectionId, objectCount, totalFieldCount }` |
| `destination.fields.partial_failure` | `{ planId, connectionId, failedObjects }` |
| `destination.fields.failed` | `{ planId, connectionId, error }` |
