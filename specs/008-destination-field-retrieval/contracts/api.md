# Contracts: Destination Field Retrieval

## API Routes

### POST /api/plans/[planId]/destination/fields

Trigger field retrieval for all objects in the destination's CURRENT schema snapshot.

**Request**: No body required. The endpoint resolves the destination connection and CURRENT snapshot from the plan.

**Response (200)**:
```json
{
  "totalFields": 147,
  "objectResults": [
    { "objectApiName": "contacts", "fieldCount": 42, "status": "success" },
    { "objectApiName": "companies", "fieldCount": 35, "status": "success" },
    { "objectApiName": "deals", "fieldCount": 28, "status": "success" },
    { "objectApiName": "custom_object_1", "fieldCount": 0, "status": "error", "error": "Permission denied" }
  ],
  "durationMs": 4200
}
```

**Error Responses**:
- `404`: Plan not found, or no destination connection, or no CURRENT snapshot
- `409`: Field retrieval already in progress for this connection
- `500`: Unexpected server error

**Side Effects**:
- Creates `ObjectField` rows for each object's fields in the database
- Logs `DESTINATION_FIELDS_RETRIEVED` to audit trail (FR-003)

**Notes**: This endpoint is typically called as part of the full chain (schema -> fields) from 007. It should not normally be called in isolation, but it is exposed as a separate endpoint for resilience (retry on partial failure).

---

### GET /api/plans/[planId]/destination/fields

Retrieve persisted field metadata for destination objects.

**Query Parameters**:
- `objectId` (optional): Filter fields by a specific object ID
- `objectApiName` (optional): Filter fields by object API name

**Response (200)**:
```json
{
  "fields": [
    {
      "id": "clx...",
      "objectId": "clx...",
      "snapshotId": "clx...",
      "apiName": "email",
      "label": "Email",
      "dataType": "string",
      "isRequired": true,
      "isReadOnly": false,
      "isUnique": true,
      "isAccessible": true,
      "referenceTo": null,
      "relationshipType": null
    },
    {
      "id": "clx...",
      "objectId": "clx...",
      "snapshotId": "clx...",
      "apiName": "company_id",
      "label": "Associated Company",
      "dataType": "string",
      "isRequired": false,
      "isReadOnly": false,
      "isUnique": false,
      "isAccessible": true,
      "referenceTo": "companies",
      "relationshipType": "lookup"
    }
  ],
  "totalCount": 42
}
```

**Error Responses**:
- `404`: Plan not found, or no destination connection, or no CURRENT snapshot

---

### GET /api/plans/[planId]/destination/objects/[objectId]/fields

Convenience route: retrieve fields for a single destination object.

**Response (200)**:
```json
{
  "object": {
    "id": "clx...",
    "apiName": "contacts",
    "label": "Contacts"
  },
  "fields": [ /* same shape as above */ ],
  "totalCount": 42
}
```

**Error Responses**:
- `404`: Plan, connection, snapshot, or object not found

## Service Interface

```typescript
// src/features/destination/services/destination-field-service.ts

/**
 * Retrieve fields for ALL objects in the destination's CURRENT snapshot.
 * Called as part of the full chain (schema -> fields).
 * Delegates to the shared field-service for per-object retrieval.
 */
async function retrieveDestinationFields(params: {
  connectionId: string
  snapshotId: string
  planId: string
}): Promise<RetrieveFieldsResult>

/**
 * Get persisted fields for a specific destination object.
 */
async function getDestinationFieldsByObject(params: {
  snapshotId: string
  objectId: string
}): Promise<ObjectField[]>

/**
 * Get all persisted fields for the destination's CURRENT snapshot.
 */
async function getAllDestinationFields(params: {
  snapshotId: string
}): Promise<ObjectField[]>
```

## Shared Field Service Interface

```typescript
// src/features/shared/services/field-service.ts

/**
 * Retrieve and persist fields for a single object via the adapter.
 * Shared between source (005) and destination (008).
 */
async function retrieveAndPersistFieldsForObject(params: {
  connectionId: string
  snapshotId: string
  objectId: string
  objectApiName: string
  adapterType: string
}): Promise<{ fieldCount: number; status: 'success' | 'error'; error?: string }>
```
