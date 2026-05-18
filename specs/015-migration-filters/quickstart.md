# Quickstart: Migration Filters

## What this feature provides

CRUD operations for migration filters on object mappings, a filter builder UI (field + operator + value), and estimated record count estimation via the source connector.

## Prerequisites

- Feature 011 (Object Mapping) implemented -- ObjectMapping model and API routes exist
- Feature 000 (Connector Interface) types available (ConnectorAdapter with getRecordCount)
- Prisma migrated with MigrationFilter model
- Source connection established (for record count estimation)

## How to use

### 1. List filters for an object mapping

```bash
curl http://localhost:3000/api/plans/clx.../object-mappings/clx.../filters
```

Response (no filters):
```json
{
  "filters": [],
  "count": 0
}
```

### 2. Add a filter

```bash
curl -X POST http://localhost:3000/api/plans/clx.../object-mappings/clx.../filters \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFieldName": "Email",
    "operator": "NOT_EQUALS",
    "value": ""
  }'
```

Response:
```json
{
  "id": "clx...",
  "objectMappingId": "clx...",
  "sourceFieldName": "Email",
  "operator": "NOT_EQUALS",
  "value": "",
  "createdAt": "2026-05-18T...",
  "updatedAt": "2026-05-18T..."
}
```

### 3. Add a date filter

```bash
curl -X POST http://localhost:3000/api/plans/clx.../object-mappings/clx.../filters \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFieldName": "CreatedDate",
    "operator": "DATE_AFTER",
    "value": "2020-01-01"
  }'
```

### 4. Get estimated record count

```bash
curl http://localhost:3000/api/plans/clx.../object-mappings/clx.../filters/estimate
```

Response:
```json
{
  "estimatedCount": 4200,
  "totalCount": 12500,
  "isFiltered": true,
  "isEstimateAvailable": true
}
```

### 5. Remove a filter

```bash
curl -X DELETE http://localhost:3000/api/plans/clx.../object-mappings/clx.../filters/clx...
```

Returns 204. The estimated count will update when re-fetched.

## UI Flow

1. Consultant opens the field mapping page for an object mapping
2. The filter panel appears above the field mapping table
3. The panel shows existing filters as rows (field, operator, value, delete button)
4. A form row at the bottom allows adding new filters:
   - Field dropdown (source fields from the schema)
   - Operator dropdown (9 supported operators)
   - Value text input (free text, date picker for date operators)
   - Add button
5. After each filter change, the estimated record count refreshes automatically
6. The count display shows "~4,200 of 12,500 records" or "Estimate unavailable"

## Supported Operators

| Operator | Description | Typical Use |
|----------|-------------|-------------|
| `EQUALS` | Exact match | Status = "Active" |
| `NOT_EQUALS` | Not equal | Email != "" (non-empty emails) |
| `CONTAINS` | Substring match | Name contains "Corp" |
| `STARTS_WITH` | Prefix match | Phone starts with "+33" |
| `ENDS_WITH` | Suffix match | Email ends with "@company.com" |
| `GREATER_THAN` | Numeric/string greater | Revenue > 10000 |
| `LESS_THAN` | Numeric/string less | Revenue < 1000000 |
| `DATE_AFTER` | Date after (ISO 8601) | CreatedDate after 2020-01-01 |
| `DATE_BEFORE` | Date before (ISO 8601) | CreatedDate before 2025-01-01 |

## Dependencies

- **Depends on**: 011-object-mapping (ObjectMapping model + API), 000-connector-interface (getRecordCount)
- **Used by**: 011-object-mapping (filter count in detail modal A3), 012-field-mapping (filter panel placement)
