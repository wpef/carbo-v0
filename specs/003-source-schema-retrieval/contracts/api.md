# Contracts: Source Schema Retrieval

## API Routes

### POST `/api/plans/[planId]/source/schema`

Trigger a full schema retrieval for the plan's source connection. Fetches all objects via the connector adapter, persists as a new CURRENT snapshot (rotating previous), and returns the snapshot with diff if a previous snapshot existed.

**FR coverage**: FR-001, FR-002, FR-003, FR-004, FR-007, FR-008, FR-009, FR-010, FR-011

**Request**: No body. The `planId` identifies the connection.

**Response** (201 Created):
```json
{
  "snapshot": {
    "id": "clx...",
    "connectionId": "clx...",
    "status": "CURRENT",
    "objectCount": 245,
    "retrievedAt": "2026-05-18T14:30:00.000Z",
    "objects": [
      {
        "id": "clx...",
        "apiName": "Account",
        "label": "Account",
        "description": "Business accounts",
        "isCustom": false
      }
    ]
  },
  "diff": {
    "addedObjects": ["NewObject__c"],
    "removedObjects": [],
    "modifiedObjects": []
  },
  "integrityResult": {
    "brokenMappings": 0,
    "planStatus": "DRAFT"
  }
}
```

`diff` is `null` when no PREVIOUS snapshot existed (first retrieval).
`integrityResult` is the output of `checkMappingIntegrity` (017) triggered at the end of the chain.

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | Plan not found or no source connection | `{ "error": "NO_SOURCE_CONNECTION" }` |
| 409 | Concurrent retrieval in progress (FR-007) | `{ "error": "RETRIEVAL_IN_PROGRESS" }` |
| 502 | Connector adapter error (network, permissions) | `{ "error": "ADAPTER_ERROR", "message": "..." }` |

---

### GET `/api/plans/[planId]/source/schema`

Return the CURRENT schema snapshot with all objects.

**FR coverage**: FR-003

**Response** (200 OK):
```json
{
  "snapshot": {
    "id": "clx...",
    "connectionId": "clx...",
    "status": "CURRENT",
    "objectCount": 245,
    "retrievedAt": "2026-05-18T14:30:00.000Z",
    "objects": [
      {
        "id": "clx...",
        "apiName": "Account",
        "label": "Account",
        "description": "Business accounts",
        "isCustom": false
      }
    ]
  }
}
```

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | No source connection or no CURRENT snapshot | `{ "error": "NO_SNAPSHOT" }` |

---

### GET `/api/plans/[planId]/source/schema/diff`

Return the diff between CURRENT and PREVIOUS snapshots.

**FR coverage**: FR-005, FR-006

**Response** (200 OK):
```json
{
  "diff": {
    "addedObjects": ["NewObject__c"],
    "removedObjects": ["OldObject__c"],
    "modifiedObjects": [
      {
        "apiName": "Contact",
        "addedFields": ["MiddleName"],
        "removedFields": ["Fax"],
        "modifiedFields": [
          {
            "apiName": "Phone",
            "changes": { "dataType": { "before": "string", "after": "phone" } }
          }
        ]
      }
    ]
  },
  "hasPrevious": true
}
```

When `hasPrevious` is `false`, diff is `null` (only one snapshot exists).

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | No source connection or no CURRENT snapshot | `{ "error": "NO_SNAPSHOT" }` |

---

### GET `/api/plans/[planId]/source/drift`

Run live drift detection without writing to the DB. Compares CURRENT snapshot to a live re-fetch of the connected system.

**FR coverage**: FR-012, FR-013, FR-014, FR-015, FR-016

**Response** (200 OK):
```json
{
  "connectionId": "clx...",
  "side": "source",
  "checkedAt": "2026-05-18T14:35:00.000Z",
  "status": "drift",
  "changes": [
    {
      "type": "FIELD_REMOVED",
      "objectApiName": "Contact",
      "fieldApiName": "Fax",
      "before": { "dataType": "string", "isRequired": false },
      "after": null,
      "severity": "critical",
      "affectsMapping": true
    },
    {
      "type": "OBJECT_ADDED",
      "objectApiName": "NewObject__c",
      "severity": "info",
      "affectsMapping": false
    }
  ],
  "severitySummary": { "critical": 1, "warning": 0, "info": 1 }
}
```

When no drift is detected: `{ "status": "ok", "changes": [], "severitySummary": { "critical": 0, "warning": 0, "info": 0 } }`.

When live re-fetch fails (FR-015): `{ "status": "unavailable", "reason": "RATE_LIMIT_EXCEEDED", "changes": [], "severitySummary": { "critical": 0, "warning": 0, "info": 0 } }`.

**Error responses**:

| Status | Condition | Body |
|--------|-----------|------|
| 404 | No source connection or no CURRENT snapshot | `{ "error": "NO_SNAPSHOT" }` |

---

## Service Functions (internal API)

These are imported by other features (001, 002, 005, 007, 017). Not exposed as HTTP routes.

### `retrieveSchema(planId: string, side: SnapshotSide): Promise<RetrievalResult>`

Full chain: fetch objects via adapter -> rotate snapshots (old CURRENT becomes PREVIOUS) -> compute diff -> trigger integrity check (FR-010, FR-011). Used by the POST route and by the source/destination page refresh buttons.

### `computeSchemaDiff(current: SchemaObject[], previous: SchemaObject[]): SchemaDiffResult`

Pure function. Compares two object lists by `apiName`. Returns added/removed/modified. Used by `retrieveSchema` and by the GET diff route.

### `detectLiveDrift(connectionId: string, side: SnapshotSide, planId?: string): Promise<DriftReport>`

Read-only. Fetches live schema via adapter, compares to CURRENT snapshot (matching `connectionId` + `side`), categorizes changes per canonical taxonomy. When `planId` is provided, field-level inspection is scoped to mapped objects (FR-016). Returns `{ status: 'unavailable', reason }` on failure (FR-015).
