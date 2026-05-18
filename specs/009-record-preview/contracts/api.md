# Contracts: Record Preview

## API Routes

### GET /api/plans/[planId]/[side]/records/[objectApiName]

**Purpose**: Fetch a paginated page of records for the given object (FR-001). Used by the record preview UI.

**Path Parameters**:
- `planId` (string, required): Migration plan ID
- `side` (`"source"` | `"destination"`, required): Which connection to use
- `objectApiName` (string, required): API name of the object to preview

**Query Parameters**:
- `page` (number, optional, default: 1): Page number (1-indexed per FR-012 from 000)
- `pageSize` (number, optional, default: 50): Records per page. Allowed values: 25, 50, 100 (FR-002)

**Response** (200):
```json
{
  "objectApiName": "Contact",
  "objectLabel": "Contact",
  "records": [
    {
      "FirstName": {
        "raw": "Jane",
        "display": "Jane",
        "type": "text",
        "isTruncated": false
      },
      "LastName": {
        "raw": "Doe",
        "display": "Doe",
        "type": "text",
        "isTruncated": false
      },
      "Email": {
        "raw": null,
        "display": "null",
        "type": "null",
        "isTruncated": false
      },
      "AccountId": {
        "raw": "001ABC",
        "display": "Acme Corp",
        "type": "reference",
        "isTruncated": false
      },
      "Description": {
        "raw": "Very long text that exceeds 200 chars...",
        "display": "Very long text that exceeds 200 ch...",
        "type": "text",
        "isTruncated": true,
        "fullValue": "Very long text that exceeds 200 chars... (full content)"
      }
    }
  ],
  "totalCount": 15432,
  "pageSize": 50,
  "currentPage": 1,
  "hasNextPage": true,
  "hasPreviousPage": false,
  "fieldMetadata": [
    {
      "apiName": "FirstName",
      "label": "First Name",
      "dataType": "string",
      "referenceTo": null,
      "relationshipType": null
    },
    {
      "apiName": "AccountId",
      "label": "Account",
      "dataType": "reference",
      "referenceTo": "Account",
      "relationshipType": "lookup"
    }
  ]
}
```

**Response** (400 — invalid parameters):
```json
{
  "error": "Invalid page size. Allowed values: 25, 50, 100"
}
```

```json
{
  "error": "Invalid page number. Must be >= 1"
}
```

```json
{
  "error": "Invalid side parameter. Must be 'source' or 'destination'"
}
```

**Response** (404 — plan, connection, or object not found):
```json
{
  "error": "Plan not found"
}
```

```json
{
  "error": "No source connection found for this plan"
}
```

```json
{
  "error": "Object 'InvalidObj' not found in schema"
}
```

**Response** (502 — connector error):
```json
{
  "error": "Failed to fetch records from connector",
  "details": "Connection timeout after 30s"
}
```

**Behavior**:
1. Validate path and query parameters
2. Resolve the connection for the given plan and side
3. Load the connector adapter for the connection type
4. Load field metadata from persisted `ObjectField` rows (from 005/008)
5. Call `adapter.getRecords(connectionId, objectApiName, page, pageSize)`
6. Transform raw `ConnectorRecord[]` into `FormattedRecord[]` using field metadata (classify types, truncate long text, format nulls/empty)
7. Log `RECORD_PREVIEW_VIEWED` to audit trail (FR-008)
8. Return the formatted response

---

### GET /api/plans/[planId]/[side]/records/[objectApiName]/count

**Purpose**: Fetch the total record count for an object (FR-004). Separate endpoint to avoid blocking the first page load with a potentially slow count query.

**Path Parameters**: Same as above.

**Response** (200):
```json
{
  "objectApiName": "Contact",
  "totalCount": 15432
}
```

**Response** (404): Plan, connection, or object not found (same as records endpoint).

**Response** (502): Connector error (same pattern as records endpoint).

**Behavior**:
1. Validate path parameters
2. Resolve connection and adapter
3. Call `adapter.getRecordCount(connectionId, objectApiName)`
4. Return the count

---

## Validation Rules

| Rule | Endpoint | Condition |
|------|----------|-----------|
| Plan must exist | All | 404 if missing |
| Connection must exist for the given side | All | 404 if missing |
| Connection must be CONNECTED | All | 400 if expired or errored |
| `side` must be "source" or "destination" | All | 400 if invalid |
| `page` must be >= 1 | GET records | 400 if < 1 |
| `pageSize` must be 25, 50, or 100 | GET records | 400 if invalid |
| Object must exist in schema | All | 404 if not found |

## Audit Trail Events (FR-008)

| Event | Logged data |
|-------|-------------|
| `RECORD_PREVIEW_VIEWED` | planId, side, objectApiName, page, pageSize, recordCount (number of records returned on this page) |
