# Contracts: Source Object Selection

## API Routes

Base path: `/api/plans/[planId]/source/objects`

---

### GET `/api/plans/[planId]/source/objects`

**Purpose**: Retrieve all objects from the CURRENT schema snapshot with their selection state (FR-001, FR-007, FR-009).

**Query Parameters**: None (full list returned; filtering is client-side per research Decision 1).

**Response 200**:
```json
{
  "objects": [
    {
      "apiName": "Account",
      "label": "Account",
      "description": "Standard CRM account object",
      "isCustom": false,
      "isSelected": true,
      "category": "business"
    },
    {
      "apiName": "ApexClass",
      "label": "Apex Class",
      "description": "System metadata object",
      "isCustom": false,
      "isSelected": false,
      "category": "system"
    },
    {
      "apiName": "Invoice__c",
      "label": "Invoice",
      "description": null,
      "isCustom": true,
      "isSelected": true,
      "category": "custom"
    }
  ],
  "summary": {
    "selectedCount": 42,
    "totalCount": 1234,
    "orphanedCount": 0
  },
  "snapshotId": "snap-uuid-123",
  "connectionId": "conn-uuid-456"
}
```

**Response 404**: Plan has no source connection or no CURRENT snapshot.
```json
{ "error": "NO_SOURCE_CONNECTION" | "NO_CURRENT_SNAPSHOT" }
```

**Implementation**:
1. Resolve `planId` -> source `connectionId` -> CURRENT `snapshotId`.
2. JOIN `SchemaObject` (from snapshot) with `ObjectSelection` (from same connection+snapshot).
3. If no `ObjectSelection` rows exist for this snapshot, compute defaults first (initial load).
4. Compute `category` from `isCustom` + common business objects config.
5. Return sorted: custom first, then business, then system. Within each group, alphabetical by label.

---

### PUT `/api/plans/[planId]/source/objects`

**Purpose**: Save object selection changes (FR-007). Handles both single toggle and bulk actions (FR-006).

**Request Body**:
```json
{
  "selections": [
    { "objectApiName": "Account", "isSelected": true },
    { "objectApiName": "ApexClass", "isSelected": false }
  ]
}
```

**Validation**:
- `selections` must be a non-empty array.
- Each `objectApiName` must exist in the CURRENT schema snapshot.
- `isSelected` must be a boolean.

**Response 200**:
```json
{
  "updated": 2,
  "summary": {
    "selectedCount": 43,
    "totalCount": 1234,
    "orphanedCount": 0
  }
}
```

**Response 400**: Validation error.
```json
{ "error": "INVALID_PAYLOAD", "details": "..." }
```

**Response 404**: Plan has no source connection or no CURRENT snapshot.

**Implementation**:
1. Resolve `planId` -> source `connectionId` -> CURRENT `snapshotId`.
2. Validate all `objectApiName` values exist in the snapshot.
3. Upsert `ObjectSelection` rows in a transaction.
4. Set `selectedAt = now()` when `isSelected = true`, `selectedAt = null` when `false`.
5. Log selection change to audit trail (FR-010): action type `OBJECT_SELECTION_CHANGED`, details include list of toggled objects.
6. Return updated summary.

---

### GET `/api/plans/[planId]/source/objects/[objectApiName]/expand`

**Purpose**: On-demand fetch of record count, fields, and sample records for a single object (FR-005).

**Response 200**:
```json
{
  "objectApiName": "Account",
  "recordCount": 4521,
  "fields": [
    {
      "apiName": "Name",
      "label": "Account Name",
      "dataType": "string",
      "isRequired": true,
      "isReadOnly": false,
      "isUnique": false,
      "referenceTo": null,
      "relationshipType": null
    }
  ],
  "sampleRecords": [
    { "Name": "Acme Corp", "Industry": "Technology", "AnnualRevenue": 5000000 },
    { "Name": "Globex", "Industry": "Manufacturing", "AnnualRevenue": 12000000 },
    { "Name": "Initech", "Industry": "Consulting", "AnnualRevenue": 800000 }
  ]
}
```

**Response 404**: Object not found in CURRENT snapshot.
```json
{ "error": "OBJECT_NOT_FOUND", "objectApiName": "UnknownObject__c" }
```

**Response 504**: Expand calls timed out (30s threshold per spec edge case).
```json
{ "error": "EXPAND_TIMEOUT", "objectApiName": "Account" }
```

**Implementation**:
1. Resolve `planId` -> source `connectionId`.
2. Verify `objectApiName` exists in CURRENT snapshot.
3. Call adapter methods in parallel: `getRecordCount(connectionId, objectApiName)`, `getFields(connectionId, objectApiName)`, `getRecords(connectionId, objectApiName, 1, 5)`.
4. Apply a 30-second timeout (AbortController or Promise.race).
5. Return merged result.
6. Console log: start/end of expand call with timing (Principle VII).

---

## Validation Rules

| Rule | Endpoint | Behavior |
|------|----------|----------|
| Plan must have a source connection | All | 404 `NO_SOURCE_CONNECTION` |
| Source connection must have a CURRENT snapshot | All | 404 `NO_CURRENT_SNAPSHOT` |
| objectApiName must exist in snapshot | PUT, GET expand | 400/404 |
| At least 1 object must be selected to proceed | Client-side (FR-008) | Disable "Retrieve Fields" button + validation message |

## Audit Trail Events (FR-010)

| Action | Logged Data |
|--------|-------------|
| `OBJECT_SELECTION_INITIALIZED` | connectionId, snapshotId, selectedCount, totalCount, method ('defaults' or 'migrated') |
| `OBJECT_SELECTION_CHANGED` | connectionId, snapshotId, changes: `[{ objectApiName, isSelected }]`, trigger ('manual' or 'bulk') |
