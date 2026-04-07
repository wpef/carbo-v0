# API Contract: Source Object Selection

Base path: `/api/plans/[planId]/source/objects`

---

## GET /api/plans/[planId]/source/objects

List all objects from the CURRENT snapshot with their selection status. Initializes default selections if none exist yet.

**Query params**:
- `includeSystem=true|false` (default: false) -- include system/internal objects

**Response 200**:
```json
{
  "snapshotId": "clxyz...",
  "objects": [
    {
      "id": "clxyz...",
      "apiName": "Account",
      "label": "Account",
      "description": "Business account",
      "isCustom": false,
      "isSystem": false,
      "selection": {
        "id": "clxyz...",
        "isSelected": true,
        "selectedAt": "2026-04-01T10:00:00Z"
      }
    }
  ],
  "summary": {
    "total": 142,
    "selected": 42,
    "system": 85,
    "custom": 12
  }
}
```

**Response 404**: Plan not found, no source connection, or no schema snapshot.

---

## PUT /api/plans/[planId]/source/objects

Bulk update object selections. Accepts an array of selection changes.

**Request body**:
```json
{
  "selections": [
    { "objectId": "clxyz...", "isSelected": true },
    { "objectId": "clxyz...", "isSelected": false }
  ]
}
```

**Response 200**:
```json
{
  "updated": 2,
  "summary": {
    "total": 142,
    "selected": 43
  }
}
```

**Response 400**: Empty selections array or invalid objectId.

**Response 404**: Plan not found or no schema snapshot.

---

## PATCH /api/plans/[planId]/source/objects/[objectId]

Toggle selection for a single object.

**Request body**:
```json
{
  "isSelected": true
}
```

**Response 200**:
```json
{
  "id": "clxyz...",
  "objectApiName": "Account",
  "isSelected": true,
  "selectedAt": "2026-04-01T10:05:00Z"
}
```

**Response 404**: Object not found in current snapshot.

---

## GET /api/plans/[planId]/source/objects/[objectId]/expand

On-demand expansion: record count, field preview, and sample records. Calls the adapter directly (not persisted).

**Response 200**:
```json
{
  "objectApiName": "Account",
  "recordCount": 1523,
  "fields": [
    {
      "apiName": "Id",
      "label": "Account ID",
      "dataType": "id",
      "isRequired": true,
      "isReadOnly": true,
      "isUnique": true
    },
    {
      "apiName": "Name",
      "label": "Account Name",
      "dataType": "string",
      "isRequired": true,
      "isReadOnly": false,
      "isUnique": false
    }
  ],
  "sampleRecords": [
    { "Id": "001xx000003DGbY", "Name": "Acme Corp", "Industry": "Technology" },
    { "Id": "001xx000003DGbZ", "Name": "Global Media", "Industry": "Media" }
  ]
}
```

**Response 404**: Object not found.

**Response 504**: Adapter timeout (> 30 seconds).
```json
{
  "error": "EXPAND_TIMEOUT",
  "message": "Record count or sample data retrieval timed out after 30 seconds."
}
```
