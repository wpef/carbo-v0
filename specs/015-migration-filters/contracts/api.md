# API Contracts: Migration Filters

Base path: `/api/plans/[planId]/object-mappings/[mappingId]/filters`

## GET .../filters

List all filters for an object mapping.

**Response 200**:
```json
{
  "filters": [
    {
      "id": "uuid",
      "sourceFieldName": "Email",
      "operator": "NOT_EQUALS",
      "value": "",
      "createdAt": "2026-04-02T10:00:00Z"
    },
    {
      "id": "uuid",
      "sourceFieldName": "CreatedDate",
      "operator": "DATE_AFTER",
      "value": "2020-01-01",
      "createdAt": "2026-04-02T10:01:00Z"
    }
  ],
  "combinationLogic": "AND"
}
```

## POST .../filters

Create a new filter.

**Request**:
```json
{
  "sourceFieldName": "Status",
  "operator": "EQUALS",
  "value": "Active"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "sourceFieldName": "Status",
  "operator": "EQUALS",
  "value": "Active",
  "createdAt": "2026-04-02T10:05:00Z"
}
```

**Response 400** (invalid field):
```json
{
  "error": "Source field 'InvalidField' does not exist in the source object schema"
}
```

## DELETE .../filters/[filterId]

Remove a filter.

**Response 200**:
```json
{
  "deleted": "uuid"
}
```

## GET .../filters/estimate

Get estimated record count based on current filters.

**Response 200**:
```json
{
  "estimatedCount": 4200,
  "totalCount": 12340,
  "filterCount": 2
}
```

**Response 200** (source unavailable):
```json
{
  "estimatedCount": null,
  "totalCount": null,
  "filterCount": 2,
  "error": "Estimate unavailable -- source system unreachable"
}
```
