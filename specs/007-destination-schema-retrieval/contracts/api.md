# API Contract: Destination Schema Retrieval

**Base path**: `/api/plans/[planId]/destination-schema`

## POST /api/plans/[planId]/destination-schema

Retrieve (or refresh) the destination schema. Creates a new CURRENT snapshot, demoting the previous CURRENT to PREVIOUS.

**Request**: No body required.

**Response 201** (first retrieval):
```json
{
  "snapshot": {
    "id": "uuid",
    "connectionId": "uuid",
    "status": "CURRENT",
    "retrievedAt": "2026-04-02T10:00:00Z",
    "objectCount": 42
  },
  "objects": [
    {
      "id": "uuid",
      "apiName": "contacts",
      "label": "Contacts",
      "description": "HubSpot contacts",
      "isCustom": false
    }
  ],
  "diff": null
}
```

**Response 200** (refresh with diff):
```json
{
  "snapshot": { "..." },
  "objects": [ "..." ],
  "diff": {
    "addedObjects": [{ "apiName": "custom_obj", "label": "Custom Object" }],
    "removedObjects": [],
    "modifiedObjects": []
  }
}
```

**Response 400**: No destination connection on this plan.
```json
{ "error": "No destination connection. Connect a destination first." }
```

**Response 409**: Schema retrieval already in progress.
```json
{ "error": "Schema retrieval already in progress." }
```

## GET /api/plans/[planId]/destination-schema

Get the current destination schema snapshot and objects.

**Response 200**:
```json
{
  "snapshot": {
    "id": "uuid",
    "connectionId": "uuid",
    "status": "CURRENT",
    "retrievedAt": "2026-04-02T10:00:00Z",
    "objectCount": 42
  },
  "objects": [ "..." ]
}
```

**Response 200** (no schema retrieved yet):
```json
{ "snapshot": null, "objects": [] }
```

## Audit Trail Events

| Event | Payload |
|-------|---------|
| `destination.schema.retrieved` | `{ planId, connectionId, snapshotId, objectCount }` |
| `destination.schema.refreshed` | `{ planId, connectionId, snapshotId, diff: { added, removed, modified } }` |
| `destination.schema.failed` | `{ planId, connectionId, error }` |
