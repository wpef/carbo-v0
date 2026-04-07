# API Contracts: Mapping Integrity Check

Base path: `/api/plans/[planId]/integrity`

## GET /api/plans/[planId]/integrity

List active integrity issues for a plan.

**Response 200**:
```json
{
  "issues": [
    {
      "id": "uuid",
      "entityType": "FIELD_MAPPING",
      "entityId": "field-mapping-uuid",
      "issueType": "SOURCE_FIELD_DELETED",
      "description": "Source field 'CustomField__c' no longer exists in Contact schema",
      "detectedAt": "2026-04-02T10:00:00Z",
      "resolvedAt": null,
      "context": {
        "objectMappingId": "obj-mapping-uuid",
        "sourceObjectName": "Contact",
        "destinationObjectName": "Contact"
      }
    }
  ],
  "summary": {
    "totalActive": 3,
    "byType": {
      "SOURCE_FIELD_DELETED": 2,
      "TYPE_CHANGE_INCOMPATIBLE": 1
    }
  },
  "planStatus": "BROKEN"
}
```

**Response 200** (no issues):
```json
{
  "issues": [],
  "summary": { "totalActive": 0, "byType": {} },
  "planStatus": "DRAFT"
}
```

## POST /api/plans/[planId]/integrity

Trigger an integrity check. Compares all mappings against current schema snapshots.

**Response 200**:
```json
{
  "newIssues": [
    {
      "id": "uuid",
      "entityType": "FIELD_MAPPING",
      "issueType": "SOURCE_FIELD_DELETED",
      "description": "Source field 'CustomField__c' no longer exists in Contact schema"
    }
  ],
  "resolvedIssues": [
    {
      "id": "uuid",
      "entityType": "FIELD_MAPPING",
      "issueType": "DESTINATION_FIELD_DELETED",
      "description": "Previously missing field 'email' now exists"
    }
  ],
  "totalActive": 3,
  "planStatus": "BROKEN"
}
```

**Response 200** (all clear):
```json
{
  "newIssues": [],
  "resolvedIssues": [],
  "totalActive": 0,
  "planStatus": "DRAFT"
}
```
