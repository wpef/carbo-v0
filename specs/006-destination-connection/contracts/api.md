# API Contract: Destination Connection

**Base path**: `/api/plans/[planId]/destination-connection`

## POST /api/plans/[planId]/destination-connection

Connect a destination system to the plan.

**Request**:
```json
{
  "adapterType": "hubspot" | "demo-destination",
  "config": {
    "accessToken": "pat-xxx"   // HubSpot only; omitted for demo
  }
}
```

**Response 201**:
```json
{
  "connection": {
    "id": "uuid",
    "planId": "uuid",
    "role": "destination",
    "adapterType": "hubspot",
    "status": "CONNECTED",
    "createdAt": "2026-04-02T10:00:00Z"
  }
}
```

**Response 400**: Plan already has a destination connection.
```json
{ "error": "Plan already has a destination connection. Disconnect first." }
```

**Response 404**: Plan not found.

**Response 500**: Adapter connection failed.
```json
{ "error": "Connection failed: invalid access token" }
```

## GET /api/plans/[planId]/destination-connection

Get current destination connection status.

**Response 200**:
```json
{
  "connection": {
    "id": "uuid",
    "planId": "uuid",
    "role": "destination",
    "adapterType": "hubspot",
    "status": "CONNECTED",
    "createdAt": "2026-04-02T10:00:00Z"
  }
}
```

**Response 200** (no connection):
```json
{ "connection": null }
```

## DELETE /api/plans/[planId]/destination-connection

Disconnect the destination. Cascade-deletes schema snapshots, objects, and fields.

**Response 200**:
```json
{ "success": true }
```

**Response 404**: No destination connection exists.

## Audit Trail Events

| Event | Payload |
|-------|---------|
| `destination.connected` | `{ planId, adapterType, connectionId }` |
| `destination.disconnected` | `{ planId, connectionId, cascadeDeleted: { snapshots, objects, fields } }` |
| `destination.connection_failed` | `{ planId, adapterType, error }` |
