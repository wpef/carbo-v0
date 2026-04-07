# API Contract: Source Connection

Base path: `/api/plans/[planId]/source`

---

## GET /api/plans/[planId]/source

Get the current source connection for a plan.

**Response 200** (connection exists):
```json
{
  "id": "clxyz...",
  "planId": "clxyz...",
  "adapterType": "salesforce",
  "status": "CONNECTED",
  "connectedAt": "2026-04-01T10:00:00Z"
}
```

**Response 200** (no connection):
```json
{
  "id": null,
  "status": "NONE"
}
```

**Response 404**: Plan not found.

---

## POST /api/plans/[planId]/source

Connect to a source system. Replaces any existing connection (disconnect + reconnect).

**Request body**:
```json
{
  "adapterType": "salesforce",
  "config": {
    "instanceUrl": "https://myorg.salesforce.com",
    "accessToken": "..."
  }
}
```

For demo mode:
```json
{
  "adapterType": "demo",
  "config": {}
}
```

**Response 201**:
```json
{
  "id": "clxyz...",
  "planId": "clxyz...",
  "adapterType": "salesforce",
  "status": "CONNECTED",
  "connectedAt": "2026-04-01T10:00:00Z"
}
```

**Response 400**: Invalid adapter type or missing required config fields.
```json
{
  "error": "INVALID_ADAPTER",
  "message": "Adapter type 'unknown' is not registered."
}
```

**Response 401**: Authentication failed with the external system.
```json
{
  "error": "AUTH_FAILED",
  "message": "Salesforce authentication failed: invalid token."
}
```

**Response 404**: Plan not found.

---

## DELETE /api/plans/[planId]/source

Disconnect the source and cascade-delete all dependent data (schema snapshots, object selections, field metadata).

**Response 200**:
```json
{
  "deleted": true,
  "cascadeDeleted": {
    "schemaSnapshots": 2,
    "objectSelections": 42,
    "objectFields": 1230
  }
}
```

**Response 404**: Plan not found or no source connection to delete.

---

## GET /api/connectors/registry

List all available adapter types (used by AdapterPicker component).

**Response 200**:
```json
{
  "adapters": [
    {
      "type": "salesforce",
      "label": "Salesforce",
      "role": "source",
      "configFields": [
        { "name": "instanceUrl", "label": "Instance URL", "type": "text", "required": true },
        { "name": "accessToken", "label": "Access Token", "type": "password", "required": true }
      ]
    },
    {
      "type": "demo",
      "label": "Demo Data",
      "role": "source",
      "configFields": []
    }
  ]
}
```
