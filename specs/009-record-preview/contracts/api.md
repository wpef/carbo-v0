# API Contract: Record Preview

**Base path**: `/api/plans/[planId]/records/[objectApiName]`

## GET /api/plans/[planId]/records/[objectApiName]

Fetch a paginated page of records from the external system.

**Query params**:
- `role` (required): `"source"` or `"destination"` — determines which connection to use
- `page` (optional, default `1`): Page number (1-based)
- `pageSize` (optional, default `50`): Records per page. Allowed: 25, 50, 100

**Response 200**:
```json
{
  "records": [
    {
      "Id": "001ABC",
      "Name": "John Doe",
      "Email": "john@example.com",
      "Company": null,
      "Description": "A very long text that is truncated at 200 chars...",
      "AccountId": "Acme Corp"
    }
  ],
  "totalCount": 15432,
  "pageSize": 50,
  "currentPage": 1,
  "hasNextPage": true,
  "objectApiName": "Contact",
  "role": "source"
}
```

**Field value conventions**:
- `null` values: returned as JSON `null` (UI displays as "null" badge)
- Empty strings: returned as `""` (UI displays as empty cell)
- Relationship fields: resolved to display name when adapter supports it; raw ID otherwise
- Long text (200+ chars): truncated server-side with `"...[truncated]"` suffix in response; full value available via separate endpoint or client expansion
- Binary/blob: returned as `"[binary data]"`

**Response 400**: Invalid role or page size.
```json
{ "error": "Invalid role. Must be 'source' or 'destination'." }
```

**Response 400**: No connection for given role.
```json
{ "error": "No source connection on this plan." }
```

**Response 404**: Object not found in schema.
```json
{ "error": "Object 'InvalidObj' not found in schema." }
```

**Response 500**: External system error.
```json
{ "error": "Failed to fetch records: API timeout" }
```

## Audit Trail Events

| Event | Payload |
|-------|---------|
| `records.previewed` | `{ planId, connectionId, objectApiName, role, page, pageSize, recordCount }` |
| `records.preview_failed` | `{ planId, connectionId, objectApiName, role, error }` |
