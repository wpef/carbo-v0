# Contracts: Destination Schema Retrieval

## API Routes

### GET /api/plans/[planId]/destination/schema

**Purpose**: Retrieve the current destination schema snapshot with objects.

**Auth**: Tenant context required (planId ownership).

**Response 200**:
```json
{
  "snapshot": {
    "id": "cuid",
    "connectionId": "cuid",
    "side": "destination",
    "status": "CURRENT",
    "retrievedAt": "2026-05-18T10:00:00Z",
    "objectCount": 42,
    "objects": [
      {
        "id": "cuid",
        "apiName": "contacts",
        "label": "Contacts",
        "description": "HubSpot contacts",
        "isCustom": false,
        "fieldCount": 85
      }
    ]
  },
  "previousSnapshot": {
    "id": "cuid",
    "retrievedAt": "2026-05-17T10:00:00Z",
    "objectCount": 40
  } | null
}
```

**Response 404**: No destination connection or no schema retrieved yet.

---

### POST /api/plans/[planId]/destination/schema

**Purpose**: Trigger initial destination schema retrieval (full chain: schema + fields).

**Auth**: Tenant context required.

**Request body**: None.

**Preconditions**: Destination connection exists and status is CONNECTED. No CURRENT snapshot exists yet (use refresh for subsequent retrievals).

**Response 200**:
```json
{
  "snapshot": {
    "id": "cuid",
    "objectCount": 42,
    "retrievedAt": "2026-05-18T10:00:00Z"
  },
  "fieldCounts": {
    "contacts": 85,
    "companies": 62,
    "deals": 44
  }
}
```

**Response 409**: Schema retrieval already in progress for this connection (FR-003 concurrency guard from inherited 003 pattern).

**Response 400**: Connection not in CONNECTED status.

---

### POST /api/plans/[planId]/destination/schema/refresh

**Purpose**: Refresh destination schema (full chain + snapshot rotation + integrity check).

**Auth**: Tenant context required.

**Request body**: None.

**Preconditions**: Destination connection CONNECTED and a CURRENT snapshot exists.

**Behavior**:
1. Fetch live schema via adapter (`getSchema` + `getFields` for all objects)
2. Rotate snapshots (CURRENT -> PREVIOUS, new -> CURRENT)
3. Compute diff between new CURRENT and old PREVIOUS
4. Trigger `checkMappingIntegrity(planId)` (FR-005)
5. Return diff + integrity result

**Response 200**:
```json
{
  "snapshot": {
    "id": "cuid",
    "objectCount": 43,
    "retrievedAt": "2026-05-18T12:00:00Z"
  },
  "diff": {
    "addedObjects": ["custom_object_1"],
    "removedObjects": [],
    "modifiedObjects": [
      {
        "apiName": "contacts",
        "addedFields": ["new_prop"],
        "removedFields": ["old_prop"],
        "modifiedFields": [
          {
            "apiName": "email",
            "changes": {
              "isRequired": { "before": false, "after": true }
            }
          }
        ]
      }
    ]
  },
  "integrityResult": {
    "planStatus": "BROKEN" | "DRAFT" | "READY",
    "brokenMappings": [
      {
        "objectMappingId": "cuid",
        "reason": "destination field 'old_prop' removed"
      }
    ]
  }
}
```

**Response 409**: Refresh already in progress.

---

### GET /api/plans/[planId]/destination/drift

**Purpose**: Run read-only drift detection for the destination connection (FR-D-006).

**Auth**: Tenant context required.

**Request body**: None.

**Behavior**: Calls `detectLiveDrift(connectionId, 'destination')` — live re-fetch compared to CURRENT snapshot. No DB writes, no snapshot rotation.

**Response 200** (drift detected):
```json
{
  "connectionId": "cuid",
  "role": "destination",
  "checkedAt": "2026-05-18T12:30:00Z",
  "status": "drift",
  "changes": [
    {
      "type": "FIELD_BECAME_REQUIRED",
      "objectApiName": "contacts",
      "fieldApiName": "email",
      "before": { "isRequired": false },
      "after": { "isRequired": true },
      "severity": "warning",
      "affectsMapping": true
    }
  ],
  "severitySummary": { "critical": 0, "warning": 1, "info": 0 }
}
```

**Response 200** (no drift):
```json
{
  "connectionId": "cuid",
  "role": "destination",
  "checkedAt": "2026-05-18T12:30:00Z",
  "status": "ok",
  "changes": [],
  "severitySummary": { "critical": 0, "warning": 0, "info": 0 }
}
```

**Response 200** (unavailable):
```json
{
  "connectionId": "cuid",
  "role": "destination",
  "checkedAt": "2026-05-18T12:30:00Z",
  "status": "unavailable",
  "reason": "HubSpot API rate limit exceeded",
  "changes": [],
  "severitySummary": { "critical": 0, "warning": 0, "info": 0 }
}
```

**Response 404**: No destination connection or no CURRENT snapshot to compare against.

---

## Service Interfaces

### fetchDestinationSchema(connectionId: string): Promise<SchemaSnapshot>

Initial schema + field retrieval. Creates CURRENT snapshot. Called by `POST /schema`.

### refreshDestinationSchema(connectionId: string, planId: string): Promise<{ snapshot: SchemaSnapshot; diff: SchemaDiffResult; integrityResult: IntegrityResult }>

Full chain: fetch + rotate + diff + integrity check. Called by `POST /schema/refresh`.

### detectLiveDrift(connectionId: string, role: 'source' | 'destination'): Promise<DriftReport>

Shared service (defined in 003). Read-only live comparison. Destination wrapper applies severity tuning. Called by `GET /drift`.
