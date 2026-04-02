# API Contract: Source Field Retrieval

Base path: `/api/plans/[planId]/source/fields`

---

## POST /api/plans/[planId]/source/fields

Trigger batch field retrieval for all selected objects. Retrieves field metadata from the adapter for each selected object sequentially. Persists results as they complete.

**Request body**: None.

**Response 201**:
```json
{
  "result": {
    "succeeded": [
      { "objectApiName": "Account", "objectId": "clxyz...", "status": "success", "fieldCount": 67 },
      { "objectApiName": "Contact", "objectId": "clxyz...", "status": "success", "fieldCount": 42 }
    ],
    "failed": [
      { "objectApiName": "CustomObj__c", "objectId": "clxyz...", "status": "error", "error": "Insufficient permissions" }
    ],
    "totalFields": 109,
    "duration": 12340
  }
}
```

**Response 404**: Plan not found, no source connection, no schema, or no selected objects.

**Response 409**: Field retrieval already in progress.
```json
{
  "error": "RETRIEVAL_IN_PROGRESS",
  "message": "Field retrieval is already in progress."
}
```

---

## GET /api/plans/[planId]/source/fields

Get all persisted fields grouped by object. Only returns fields for selected objects.

**Response 200**:
```json
{
  "objects": [
    {
      "objectId": "clxyz...",
      "objectApiName": "Account",
      "objectLabel": "Account",
      "fieldCount": 67,
      "fields": [
        {
          "id": "clxyz...",
          "apiName": "Id",
          "label": "Account ID",
          "dataType": "id",
          "isRequired": true,
          "isReadOnly": true,
          "isUnique": true,
          "isAccessible": true,
          "referenceTo": null,
          "relationshipType": null
        },
        {
          "id": "clxyz...",
          "apiName": "ParentId",
          "label": "Parent Account ID",
          "dataType": "reference",
          "isRequired": false,
          "isReadOnly": false,
          "isUnique": false,
          "isAccessible": true,
          "referenceTo": "Account",
          "relationshipType": "Lookup"
        }
      ]
    }
  ],
  "summary": {
    "objectCount": 2,
    "totalFields": 109,
    "inaccessibleFields": 3
  }
}
```

**Response 200** (no fields retrieved yet):
```json
{
  "objects": [],
  "summary": {
    "objectCount": 0,
    "totalFields": 0,
    "inaccessibleFields": 0
  }
}
```

**Response 404**: Plan not found, no source connection, or no schema.

---

## GET /api/plans/[planId]/source/fields/[objectId]

Get fields for a specific object.

**Response 200**:
```json
{
  "objectId": "clxyz...",
  "objectApiName": "Account",
  "objectLabel": "Account",
  "fieldCount": 67,
  "fields": [
    {
      "id": "clxyz...",
      "apiName": "Id",
      "label": "Account ID",
      "dataType": "id",
      "isRequired": true,
      "isReadOnly": true,
      "isUnique": true,
      "isAccessible": true,
      "referenceTo": null,
      "relationshipType": null
    }
  ]
}
```

**Response 404**: Object not found or no fields retrieved for this object.
