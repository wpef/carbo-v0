# API Contract: Source Schema Retrieval

Base path: `/api/plans/[planId]/source/schema`

---

## POST /api/plans/[planId]/source/schema

Trigger schema retrieval from the connected source. Rotates snapshots (CURRENT -> PREVIOUS). Returns the new snapshot and diff (if PREVIOUS exists).

**Request body**: None.

**Response 201** (first retrieval, no diff):
```json
{
  "snapshot": {
    "id": "clxyz...",
    "connectionId": "clxyz...",
    "status": "CURRENT",
    "objectCount": 142,
    "retrievedAt": "2026-04-01T10:00:00Z"
  },
  "objects": [
    {
      "id": "clxyz...",
      "apiName": "Account",
      "label": "Account",
      "description": "Business account",
      "isCustom": false
    }
  ],
  "diff": null
}
```

**Response 201** (refresh, with diff):
```json
{
  "snapshot": { "..." : "..." },
  "objects": [ "..." ],
  "diff": {
    "added": [{ "apiName": "NewObject__c", "label": "New Object", "isCustom": true }],
    "removed": [{ "apiName": "OldObject__c", "label": "Old Object", "isCustom": true }],
    "modified": [{
      "current": { "apiName": "Contact", "label": "Contact (renamed)", "isCustom": false },
      "previous": { "apiName": "Contact", "label": "Contact", "isCustom": false },
      "changes": ["label"]
    }],
    "unchanged": 140
  }
}
```

**Response 404**: Plan not found or no source connection.

**Response 409**: Schema retrieval already in progress.
```json
{
  "error": "RETRIEVAL_IN_PROGRESS",
  "message": "A schema retrieval is already in progress for this connection."
}
```

**Response 502**: Adapter failed to retrieve schema.
```json
{
  "error": "ADAPTER_ERROR",
  "message": "Failed to retrieve schema from Salesforce: connection timeout."
}
```

---

## GET /api/plans/[planId]/source/schema

Get the CURRENT schema snapshot with all objects.

**Response 200**:
```json
{
  "snapshot": {
    "id": "clxyz...",
    "connectionId": "clxyz...",
    "status": "CURRENT",
    "objectCount": 142,
    "retrievedAt": "2026-04-01T10:00:00Z"
  },
  "objects": [
    {
      "id": "clxyz...",
      "apiName": "Account",
      "label": "Account",
      "description": "Business account",
      "isCustom": false
    }
  ]
}
```

**Response 200** (no snapshot yet):
```json
{
  "snapshot": null,
  "objects": []
}
```

**Response 404**: Plan not found or no source connection.

---

## GET /api/plans/[planId]/source/schema/diff

Get the diff between CURRENT and PREVIOUS snapshots.

**Response 200** (diff available):
```json
{
  "diff": {
    "added": [],
    "removed": [],
    "modified": [],
    "unchanged": 142
  }
}
```

**Response 200** (no PREVIOUS snapshot):
```json
{
  "diff": null,
  "message": "No previous snapshot to compare against."
}
```

**Response 404**: Plan not found, no source connection, or no CURRENT snapshot.
