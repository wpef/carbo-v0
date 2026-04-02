# API Contracts: Unmapped Fields Detection

Base path: `/api/plans/[planId]/object-mappings/[mappingId]`

## GET .../unmapped

Get unmapped fields for an object mapping.

**Response 200**:
```json
{
  "unmappedSourceFields": [
    { "fieldName": "AnnualRevenue", "fieldType": "number" },
    { "fieldName": "Description", "fieldType": "text" },
    { "fieldName": "Fax", "fieldType": "text" }
  ],
  "unmappedRequiredDestFields": [
    { "fieldName": "email", "fieldType": "text", "isRequired": true }
  ],
  "excludedFields": [
    { "id": "uuid", "sourceFieldName": "SystemModstamp", "reason": "System field" },
    { "id": "uuid", "sourceFieldName": "IsDeleted", "reason": null }
  ],
  "summary": {
    "totalSourceFields": 25,
    "mappedSourceFields": 18,
    "excludedSourceFields": 2,
    "unmappedSourceFields": 5,
    "unmappedRequiredDestFields": 1
  }
}
```

## POST .../exclusions

Create field exclusion(s). Supports single and bulk.

**Request (single)**:
```json
{
  "sourceFieldNames": ["Fax"],
  "reason": "Not relevant to migration"
}
```

**Request (bulk)**:
```json
{
  "sourceFieldNames": ["Fax", "SystemModstamp", "IsDeleted", "LastModifiedById"],
  "reason": "System fields"
}
```

**Response 201**:
```json
{
  "created": [
    { "id": "uuid", "sourceFieldName": "Fax", "reason": "Not relevant to migration" }
  ],
  "skipped": [
    { "sourceFieldName": "SystemModstamp", "reason": "already excluded" }
  ]
}
```

## DELETE .../exclusions/[exclusionId]

Remove a field exclusion (field reappears in unmapped list).

**Response 200**:
```json
{
  "deleted": "uuid",
  "sourceFieldName": "Fax"
}
```
