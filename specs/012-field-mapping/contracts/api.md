# API Contracts: Field Mapping

Base path: `/api/plans/[planId]/object-mappings/[mappingId]/fields`

## GET /api/plans/[planId]/object-mappings/[mappingId]/fields

List all field mappings for an object mapping, with link status.

**Response 200**:
```json
{
  "fieldMappings": [
    {
      "id": "uuid",
      "sourceFieldName": "FirstName",
      "destinationFieldName": "firstname",
      "sourceFieldType": "text",
      "destinationFieldType": "text",
      "compatibilityStatus": "COMPATIBLE",
      "autoCreated": true,
      "linkStatus": "GREEN",
      "createdAt": "2026-04-02T10:00:00Z"
    }
  ],
  "unmappedSourceFields": ["AnnualRevenue", "Description"],
  "unmappedDestinationFields": ["custom_field_1"]
}
```

Note: `linkStatus` is computed (not stored). `unmappedSourceFields` and `unmappedDestinationFields` support the unmapped fields detection feature (016).

## POST /api/plans/[planId]/object-mappings/[mappingId]/fields

Create a new field mapping.

**Request**:
```json
{
  "sourceFieldName": "Industry",
  "destinationFieldName": "industry",
  "sourceFieldType": "picklist",
  "destinationFieldType": "picklist"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "sourceFieldName": "Industry",
  "destinationFieldName": "industry",
  "sourceFieldType": "picklist",
  "destinationFieldType": "picklist",
  "compatibilityStatus": "NEEDS_LOGIC",
  "autoCreated": false,
  "linkStatus": "RED_SOLID"
}
```

**Response 409** (one-to-one violation):
```json
{
  "error": "Source field 'Industry' is already mapped to 'industry_type' in this object mapping"
}
```

## DELETE /api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]

Remove a field mapping and cascade-delete associated migration logic.

**Response 200**:
```json
{
  "deleted": {
    "fieldMapping": "uuid",
    "migrationLogicDeleted": true
  }
}
```

## POST /api/plans/[planId]/object-mappings/[mappingId]/fields/auto-match

Trigger auto-matching of native field correspondences. Idempotent.

**Response 200**:
```json
{
  "created": [
    { "sourceFieldName": "FirstName", "destinationFieldName": "firstname" },
    { "sourceFieldName": "LastName", "destinationFieldName": "lastname" }
  ],
  "skipped": [
    { "sourceFieldName": "Email", "destinationFieldName": "email", "reason": "already exists" }
  ]
}
```
