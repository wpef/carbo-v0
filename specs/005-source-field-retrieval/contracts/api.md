# Contracts: Source Field Retrieval

## API Routes

### POST /api/plans/[planId]/source/fields

**Purpose**: Trigger field retrieval for all selected objects (FR-001). Called after object selection confirmation or when the consultant triggers a re-retrieval.

**Request**: No body required. The service reads selected objects from the database.

**Response** (200):
```json
{
  "status": "completed",
  "summary": {
    "totalObjects": 42,
    "succeeded": 41,
    "failed": 1,
    "totalFields": 1523,
    "failures": [
      {
        "objectApiName": "CustomObj__c",
        "error": "Insufficient permissions to describe object"
      }
    ]
  }
}
```

**Response** (400 — no selected objects):
```json
{
  "error": "No selected objects found. Select objects before retrieving fields."
}
```

**Response** (404 — plan or connection not found):
```json
{
  "error": "Plan not found" | "No source connection found for this plan"
}
```

**Behavior**:
1. Resolve the source connection for the plan
2. Load all `SchemaObject` where `isSelected=true` for the CURRENT snapshot
3. For each selected object, call `adapter.getFields(connectionId, objectApiName)` with bounded concurrency (5)
4. Persist results as `ObjectField` rows (upsert: delete existing fields for the object, then insert)
5. Log the retrieval event to the audit trail (FR-007)
6. Return the summary

**Idempotency**: Safe to call multiple times. Each call replaces existing fields for selected objects with fresh data. Concurrent calls for the same plan are rejected (409).

**Response** (409 — concurrent retrieval):
```json
{
  "error": "Field retrieval already in progress for this plan"
}
```

---

### GET /api/plans/[planId]/source/fields

**Purpose**: List all persisted fields for all selected objects in the CURRENT snapshot.

**Response** (200):
```json
{
  "objects": [
    {
      "objectApiName": "Account",
      "objectLabel": "Account",
      "fieldCount": 65,
      "fields": [
        {
          "id": "clu...",
          "apiName": "Name",
          "label": "Account Name",
          "dataType": "string",
          "isRequired": true,
          "isReadOnly": false,
          "isUnique": false,
          "isAccessible": true,
          "referenceTo": null,
          "relationshipType": null
        },
        {
          "id": "clu...",
          "apiName": "OwnerId",
          "label": "Owner",
          "dataType": "reference",
          "isRequired": true,
          "isReadOnly": false,
          "isUnique": false,
          "isAccessible": true,
          "referenceTo": "User",
          "relationshipType": "lookup"
        },
        {
          "id": "clu...",
          "apiName": "InternalScore__c",
          "label": "Internal Score",
          "dataType": "double",
          "isRequired": false,
          "isReadOnly": false,
          "isUnique": false,
          "isAccessible": false,
          "referenceTo": null,
          "relationshipType": null
        }
      ]
    }
  ]
}
```

**Response** (404): Plan or connection not found.

---

### GET /api/plans/[planId]/source/fields/[objectApiName]

**Purpose**: List persisted fields for a single object.

**Response** (200):
```json
{
  "objectApiName": "Account",
  "objectLabel": "Account",
  "fieldCount": 65,
  "fields": [...]
}
```

**Response** (404): Object not found or not selected.

---

## Validation Rules

| Rule | Endpoint | Condition |
|------|----------|-----------|
| Plan must exist | All | 404 if missing |
| Source connection must exist and be CONNECTED | All | 404 / 400 if missing or not connected |
| At least one object must be selected | POST | 400 if zero selected |
| No concurrent retrieval | POST | 409 if already in progress |
| Object must be selected | GET /[objectApiName] | 404 if not selected |

## Audit Trail Events (FR-007)

| Event | Logged data |
|-------|-------------|
| `FIELD_RETRIEVAL_STARTED` | planId, connectionId, objectCount |
| `FIELD_RETRIEVAL_COMPLETED` | planId, connectionId, totalFields, succeededObjects, failedObjects (with error messages) |
| `FIELD_RETRIEVAL_FAILED` | planId, connectionId, error message (when entire batch fails) |
