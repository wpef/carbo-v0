# Contracts: Source Connection API

All routes are scoped to a plan: `/api/plans/[planId]/source/...`

---

## GET /api/plans/[planId]/source

**Purpose**: Get current source connection state for the plan.

**Response 200**:
```json
{
  "connection": {
    "id": "clx...",
    "adapterType": "salesforce",
    "status": "CONNECTED",
    "config": { "instanceUrl": "https://acme.my.salesforce.com", "sandbox": false },
    "createdAt": "2026-05-18T10:00:00Z",
    "updatedAt": "2026-05-18T10:05:00Z"
  },
  "schemaSnapshot": {
    "id": "clx...",
    "fetchedAt": "2026-05-18T10:05:00Z",
    "objectCount": 42,
    "fieldCount": 387
  }
}
```

**Response 200 (no connection)**:
```json
{
  "connection": null,
  "schemaSnapshot": null
}
```

**Response 404**: Plan not found.

**Notes**: `config` never includes secrets (FR-007). `schemaSnapshot` returns summary counts, not the full JSON blob.

---

## POST /api/plans/[planId]/source

**Purpose**: Connect a source to the plan (initial connection or reconnection).

**Request Body**:
```json
{
  "adapterType": "salesforce",
  "config": {
    "instanceUrl": "https://acme.my.salesforce.com",
    "sandbox": false
  },
  "credentials": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

For demo mode (FR-005):
```json
{
  "adapterType": "demo",
  "config": {},
  "credentials": {}
}
```

**Response 201**:
```json
{
  "connection": {
    "id": "clx...",
    "adapterType": "salesforce",
    "status": "CONNECTED",
    "config": { "instanceUrl": "https://acme.my.salesforce.com" }
  }
}
```

**Response 400**: Invalid adapter type or missing required config.
**Response 401**: Authentication failed (clear error message).
**Response 404**: Plan not found.
**Response 409**: Plan already has a source connection (must disconnect or reconfigure).

**Side Effects**:
- Creates `ConnectorConnection` row
- Sets `MigrationPlan.sourceConnectionId`
- Audit log: `source.connected`

---

## DELETE /api/plans/[planId]/source

**Purpose**: Disconnect the source from the plan (FR-004).

**Response 200**:
```json
{
  "disconnected": true,
  "cascadeDeleted": {
    "schemaSnapshots": 1,
    "objectSelections": 5
  }
}
```

**Response 404**: Plan not found or no source connection.

**Side Effects**:
- Deletes `SchemaSnapshot` for this connection + SOURCE side
- Cascade-deletes dependent selections
- Sets `MigrationPlan.sourceConnectionId = null`
- Resets `MigrationPlan.currentStep` to `SOURCE`
- Audit log: `source.disconnected`

---

## POST /api/plans/[planId]/source/refresh

**Purpose**: Refresh the schema snapshot (FR-018). Phase 1 simplified: overwrites snapshot without diff/confirmation (FR-019).

**Request Body**: None (uses existing connection credentials).

**Response 200**:
```json
{
  "refreshed": true,
  "schemaSnapshot": {
    "id": "clx...",
    "fetchedAt": "2026-05-18T12:00:00Z",
    "objectCount": 43,
    "fieldCount": 392
  }
}
```

**Response 404**: Plan not found or no source connection.
**Response 502**: External API error (adapter failed to fetch schema).

**Side Effects**:
- Replaces `SchemaSnapshot.data` with fresh schema
- Downstream orphaned references flagged `linkStatus=BROKEN` by existing mechanism
- Audit log: `source.schema.refreshed`

---

## POST /api/plans/[planId]/source/reconfigure/preview

**Purpose**: Compute schema diff and impact report without applying changes (FR-008, FR-009, FR-010).

**Request Body**:
```json
{
  "adapterType": "salesforce",
  "config": { "instanceUrl": "https://acme.my.salesforce.com" },
  "credentials": { "accessToken": "..." }
}
```

**Response 200 (impact exists)**:
```json
{
  "schemaDiff": {
    "addedObjects": ["CustomObj__c"],
    "removedObjects": ["OldObj__c"],
    "addedFields": { "Contact": ["NewField__c"] },
    "removedFields": { "Contact": ["OldField__c"] },
    "typeChangedFields": [
      {
        "objectApiName": "Account",
        "fieldApiName": "Revenue",
        "oldNormalizedType": "number",
        "newNormalizedType": "text"
      }
    ]
  },
  "impact": {
    "objectMappingsToDelete": [{ "id": "...", "sourceObjectName": "OldObj__c", "destObjectName": "OldObj" }],
    "fieldMappingsToDelete": [{ "id": "...", "sourceFieldName": "OldField__c", "destFieldName": "OldField", "objectMappingId": "..." }],
    "fieldMappingsToBreak": [{ "id": "...", "sourceFieldName": "Revenue", "reason": "Type incompatible: number -> text" }],
    "rulesToDelete": [],
    "rulesToFlag": [],
    "filtersToDelete": [],
    "documentsToOutdate": [],
    "suggestedStepRollback": "FIELD_MAPPING",
    "isEmpty": false
  },
  "newSchemaSnapshot": { "objects": ["..."] }
}
```

**Response 200 (no impact -- strict superset)**:
```json
{
  "schemaDiff": { "addedObjects": ["NewObj"], "removedObjects": [], "addedFields": {}, "removedFields": {}, "typeChangedFields": [] },
  "impact": { "isEmpty": true },
  "newSchemaSnapshot": { "objects": ["..."] }
}
```

**Response 400**: Invalid config.
**Response 401**: Authentication failed with new credentials.
**Response 404**: Plan not found or no existing source connection.

**Notes**: The response includes `newSchemaSnapshot` so the apply endpoint doesn't need to re-fetch from the external system.

---

## POST /api/plans/[planId]/source/reconfigure/apply

**Purpose**: Apply a confirmed reconfiguration atomically (FR-013).

**Request Body**:
```json
{
  "adapterType": "salesforce",
  "config": { "instanceUrl": "https://acme.my.salesforce.com" },
  "credentials": { "accessToken": "..." },
  "newSchemaSnapshot": { "objects": ["..."] },
  "confirmedImpact": true
}
```

**Response 200**:
```json
{
  "applied": true,
  "connection": {
    "id": "clx...",
    "adapterType": "salesforce",
    "status": "CONNECTED"
  },
  "cascadeApplied": {
    "objectMappingsDeleted": 1,
    "fieldMappingsDeleted": 3,
    "fieldMappingsBroken": 1,
    "rulesDeleted": 0,
    "rulesFlagged": 0,
    "filtersDeleted": 2,
    "documentsOutdated": 1
  },
  "stepRolledBackTo": "FIELD_MAPPING"
}
```

**Response 400**: `confirmedImpact` is false or missing (client must confirm).
**Response 404**: Plan not found or no source connection.
**Response 409**: Schema has changed since preview (stale preview -- client must re-preview).

**Side Effects**:
- Single DB transaction: updates connection, replaces snapshot, deletes/flags downstream artifacts
- Updates `MigrationPlan.currentStep` per FR-015
- Audit log: `source.reconfigured` with full impact report

---

## Adapter Registry Endpoint

### GET /api/adapters?side=source

**Purpose**: List available source adapters (FR-002).

**Response 200**:
```json
{
  "adapters": [
    { "type": "salesforce", "label": "Salesforce", "icon": "salesforce", "capabilities": { "canRead": true, "canWrite": false, "canWriteSchema": false } },
    { "type": "demo", "label": "Demo (données fictives)", "icon": "database", "capabilities": { "canRead": true, "canWrite": false, "canWriteSchema": false } }
  ]
}
```

---

## Error Response Format

All error responses follow:
```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "L'authentification Salesforce a échoué. Vérifiez vos identifiants.",
    "details": {}
  }
}
```

Error codes: `PLAN_NOT_FOUND`, `NO_SOURCE_CONNECTION`, `AUTH_FAILED`, `INVALID_ADAPTER`, `INVALID_CONFIG`, `EXTERNAL_API_ERROR`, `STALE_PREVIEW`, `CONFIRMATION_REQUIRED`.
