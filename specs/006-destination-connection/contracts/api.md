# Contracts: Destination Connection API

## Routes Overview

| Method | Path | Purpose | FR |
|--------|------|---------|-----|
| POST | `/api/plans/[planId]/destination` | Connect destination | FR-001..004 |
| DELETE | `/api/plans/[planId]/destination` | Disconnect destination | FR-001 |
| GET | `/api/plans/[planId]/destination` | Get destination connection status + config | FR-005, FR-006 |
| POST | `/api/plans/[planId]/destination/refresh` | Refresh schema (MVP silent overwrite) | FR-016..018 |
| POST | `/api/plans/[planId]/destination/reconfigure` | Preview or apply reconfiguration | FR-005..015 |

---

## POST `/api/plans/[planId]/destination`

Connect a destination to the plan.

**Request**:
```json
{
  "adapterType": "hubspot",
  "config": {
    "accessToken": "pat-xxx",
    "portalId": "12345"
  }
}
```

For demo mode (FR-004):
```json
{
  "adapterType": "demo-destination",
  "config": {}
}
```

**Response 201**:
```json
{
  "connection": {
    "id": "clxyz...",
    "adapterType": "hubspot",
    "status": "CONNECTED",
    "createdAt": "2026-05-18T10:00:00Z"
  }
}
```

**Response 400**: Invalid adapter type or missing required config fields.
**Response 409**: Plan already has a destination connection. Use reconfigure or disconnect first.

**Side effects**:
- Creates `ConnectorConnection` row.
- Sets `MigrationPlan.destinationConnectionId`.
- Logs `DESTINATION_CONNECTED` to audit trail.

---

## DELETE `/api/plans/[planId]/destination`

Disconnect the destination from the plan.

**Response 200**:
```json
{ "disconnected": true }
```

**Response 404**: No destination connection exists.

**Side effects**:
- Deletes the `ConnectorConnection` row.
- Sets `MigrationPlan.destinationConnectionId` to null.
- Cascade-deletes dependent data (schema snapshot).
- Logs `DESTINATION_DISCONNECTED` to audit trail.

---

## GET `/api/plans/[planId]/destination`

Get current destination connection info. Used by the page to render connected state and pre-fill reconfiguration form.

**Response 200** (connected):
```json
{
  "connection": {
    "id": "clxyz...",
    "adapterType": "hubspot",
    "status": "CONNECTED",
    "config": {
      "portalId": "12345"
    },
    "hasSchemaSnapshot": true,
    "schemaObjectCount": 15,
    "createdAt": "2026-05-18T10:00:00Z",
    "updatedAt": "2026-05-18T10:05:00Z"
  }
}
```

Note: `config` excludes secret fields (FR-006). Only non-secret values are returned.

**Response 200** (not connected):
```json
{
  "connection": null
}
```

---

## POST `/api/plans/[planId]/destination/refresh`

Refresh the destination schema. MVP behavior (FR-017/018): overwrites the snapshot silently, marks orphaned field mappings as BROKEN, no diff dialog.

**Request**: Empty body (uses existing connection credentials).

**Response 200**:
```json
{
  "refreshed": true,
  "schemaObjectCount": 15,
  "schemaFieldCount": 142,
  "brokenFieldMappings": 2
}
```

**Response 404**: No destination connection.
**Response 502**: Adapter failed to fetch schema (external API error).

**Side effects**:
- Fetches fresh schema via adapter's `getSchema()` + `getFields()`.
- Overwrites `ConnectorConnection.schemaSnapshot`.
- Marks field mappings referencing removed fields as `linkStatus=BROKEN`.
- Logs `DESTINATION_SCHEMA_REFRESHED` to audit trail.

---

## POST `/api/plans/[planId]/destination/reconfigure`

Two-phase reconfiguration. Controlled by `mode` query param.

### Preview mode: `?mode=preview`

Computes schema diff and impact report without mutations.

**Request**:
```json
{
  "adapterType": "hubspot",
  "config": {
    "accessToken": "pat-new-token",
    "portalId": "12345"
  }
}
```

**Response 200** (non-empty impact):
```json
{
  "schemaDiff": {
    "addedObjects": ["Tickets"],
    "removedObjects": [],
    "addedFields": [{ "objectApiName": "Contacts", "fieldApiName": "preferred_language" }],
    "removedFields": [{ "objectApiName": "Contacts", "fieldApiName": "fax" }],
    "typeChangedFields": [{ "objectApiName": "Deals", "fieldApiName": "amount", "oldType": "number", "newType": "string" }]
  },
  "impactReport": {
    "objectMappingsToDelete": [],
    "fieldMappingsToDelete": [{ "id": "fm1", "sourceField": "Phone_Fax__c", "destField": "fax" }],
    "fieldMappingsToFlagBroken": [{ "id": "fm2", "sourceField": "Amount__c", "destField": "amount", "reason": "Type changed: number -> string" }],
    "rulesToDelete": [],
    "rulesToFlagNeedsReview": [{ "id": "r1", "description": "Amount format rule" }],
    "filtersToDelete": [],
    "documentsToMarkOutdated": [{ "id": "d1", "title": "Migration Contract v1" }],
    "isEmpty": false
  },
  "stepRollbackTo": "FIELD_MAPPING"
}
```

**Response 200** (empty impact — superset or no change):
```json
{
  "schemaDiff": { "addedObjects": ["Tickets"], "removedObjects": [], "addedFields": [], "removedFields": [], "typeChangedFields": [] },
  "impactReport": { "objectMappingsToDelete": [], "fieldMappingsToDelete": [], "fieldMappingsToFlagBroken": [], "rulesToDelete": [], "rulesToFlagNeedsReview": [], "filtersToDelete": [], "documentsToMarkOutdated": [], "isEmpty": true },
  "stepRollbackTo": null
}
```

**Response 401**: New credentials failed authentication.

### Confirm mode: `?mode=confirm`

Applies the reconfiguration atomically. Same request body as preview.

**Response 200**:
```json
{
  "reconfigured": true,
  "applied": {
    "connectionUpdated": true,
    "schemaReplaced": true,
    "fieldMappingsDeleted": 1,
    "fieldMappingsFlaggedBroken": 1,
    "rulesDeleted": 0,
    "rulesFlaggedNeedsReview": 1,
    "documentsMarkedOutdated": 1,
    "stepRolledBackTo": "FIELD_MAPPING"
  }
}
```

**Response 401**: New credentials failed authentication.
**Response 409**: Plan state changed since preview (concurrent edit). Client should re-preview.

**Side effects** (confirm only):
- Updates `ConnectorConnection` (adapter type, config, schema snapshot) in single transaction.
- Deletes/flags mappings, rules, filters per impact report.
- Marks documents as outdated.
- Rolls back `MigrationPlan.currentStep` per FR-015 rules.
- Logs `DESTINATION_RECONFIGURED` to audit trail with full impact report.

---

## Adapters Endpoint (shared with 002)

### GET `/api/adapters?side=destination`

Lists available destination adapters from the registry.

**Response 200**:
```json
{
  "adapters": [
    { "type": "hubspot", "label": "HubSpot", "capabilities": { "canRead": true, "canWrite": true, "canWriteSchema": true } },
    { "type": "demo-destination", "label": "Demo (Destination)", "capabilities": { "canRead": true, "canWrite": false, "canWriteSchema": false } }
  ]
}
```
