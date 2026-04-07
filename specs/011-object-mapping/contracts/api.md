# API Contracts: Object Mapping

Base path: `/api/plans/[planId]/object-mappings`

## GET /api/plans/[planId]/object-mappings

List all object mappings for a plan.

**Response 200**:
```json
{
  "objectMappings": [
    {
      "id": "uuid",
      "sourceObjectName": "Account",
      "destinationObjectName": "Company",
      "autoCreated": true,
      "fieldMappingCount": 12,
      "migrationFilterCount": 2,
      "createdAt": "2026-04-02T10:00:00Z"
    }
  ]
}
```

## POST /api/plans/[planId]/object-mappings

Create a new object mapping.

**Request**:
```json
{
  "sourceObjectName": "Lead",
  "destinationObjectName": "Contact"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "sourceObjectName": "Lead",
  "destinationObjectName": "Contact",
  "autoCreated": false,
  "createdAt": "2026-04-02T10:00:00Z"
}
```

**Response 409** (duplicate):
```json
{
  "error": "ObjectMapping already exists for Lead -> Contact in this plan"
}
```

**Response 200** (fan-in warning, still created):
```json
{
  "id": "uuid",
  "sourceObjectName": "Lead",
  "destinationObjectName": "Contact",
  "autoCreated": false,
  "warning": "Multiple source objects map to Contact. Record conflicts may occur during execution."
}
```

## DELETE /api/plans/[planId]/object-mappings/[mappingId]

Remove an object mapping and cascade-delete all child data.

**Response 200**:
```json
{
  "deleted": {
    "objectMapping": "uuid",
    "fieldMappings": 12,
    "migrationLogicRules": 8,
    "migrationFilters": 2,
    "fieldExclusions": 3
  }
}
```

**Response 404**:
```json
{
  "error": "ObjectMapping not found"
}
```

## POST /api/plans/[planId]/object-mappings/auto-link

Trigger auto-linking of predictable object pairs. Idempotent -- skips pairs that already exist.

**Response 200**:
```json
{
  "created": [
    { "sourceObjectName": "Account", "destinationObjectName": "Company" },
    { "sourceObjectName": "Contact", "destinationObjectName": "Contact" }
  ],
  "skipped": [
    { "sourceObjectName": "Opportunity", "destinationObjectName": "Deal", "reason": "already exists" }
  ]
}
```

## GET /api/plans/[planId]/object-mappings/[mappingId]/detail

Get detail info for an object mapping (for detail modal).

**Response 200**:
```json
{
  "id": "uuid",
  "sourceObjectName": "Contact",
  "destinationObjectName": "Contact",
  "sourceRecordCount": 12340,
  "fieldsToValidate": 18,
  "totalSourceFields": 25,
  "migrationFilterCount": 2
}
```
