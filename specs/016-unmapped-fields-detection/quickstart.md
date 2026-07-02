# Quickstart: Unmapped Fields Detection

## What this feature provides

Detection and visualization of unmapped fields for each object mapping. Lists unmapped source fields and unmapped required destination properties with coverage percentage. Allows consultants to mark source fields as "intentionally excluded" to separate deliberate omissions from forgotten ones.

## Prerequisites

- Feature 012 (Field Mapping) implemented -- FieldMapping model and API routes exist
- Feature 011 (Object Mapping) implemented -- ObjectMapping model exists
- Feature 000 (Connector Interface) types available (ConnectorField with isRequired)
- Prisma migrated with FieldExclusion model
- Schema snapshots available for source and destination objects

## How to use

### 1. Get unmapped fields report

```bash
curl http://localhost:3000/api/plans/clx.../object-mappings/clx.../unmapped-fields
```

Response:
```json
{
  "unmappedSourceFields": [
    { "apiName": "Fax", "label": "Fax", "dataType": "text", "isRequired": false },
    { "apiName": "MailingCity", "label": "Mailing City", "dataType": "text", "isRequired": false },
    { "apiName": "AssistantName", "label": "Assistant Name", "dataType": "text", "isRequired": false }
  ],
  "excludedSourceFields": [
    { "id": "clx...", "sourceFieldName": "OwnerId", "reason": "System field", "createdAt": "2026-05-18T..." },
    { "id": "clx...", "sourceFieldName": "IsDeleted", "reason": "System field", "createdAt": "2026-05-18T..." }
  ],
  "unmappedRequiredDestFields": [
    { "apiName": "email", "label": "Email", "dataType": "text", "isRequired": true }
  ],
  "sourceCoverage": 80,
  "destinationRequiredCoverage": 75,
  "totalSourceFields": 25,
  "mappedSourceFields": 18,
  "totalRequiredDestFields": 4,
  "mappedRequiredDestFields": 3,
  "fieldsRemainingToValidate": 4,
  "isComplete": false
}
```

### 2. Exclude a source field

```bash
curl -X POST http://localhost:3000/api/plans/clx.../object-mappings/clx.../unmapped-fields/exclusions \
  -H "Content-Type: application/json" \
  -d '{ "sourceFieldName": "Fax", "reason": "Obsolete field, client confirmed not needed" }'
```

Response:
```json
{
  "id": "clx...",
  "objectMappingId": "clx...",
  "sourceFieldName": "Fax",
  "reason": "Obsolete field, client confirmed not needed",
  "createdAt": "2026-05-18T..."
}
```

The field moves from the unmapped warning list to the excluded section. Source coverage increases.

### 3. Bulk exclude multiple fields

```bash
curl -X POST http://localhost:3000/api/plans/clx.../object-mappings/clx.../unmapped-fields/exclusions \
  -H "Content-Type: application/json" \
  -d '{
    "exclusions": [
      { "sourceFieldName": "MailingCity", "reason": "Not relevant for this migration" },
      { "sourceFieldName": "AssistantName", "reason": "Not relevant for this migration" }
    ]
  }'
```

### 4. Reverse an exclusion

```bash
curl -X DELETE http://localhost:3000/api/plans/clx.../object-mappings/clx.../unmapped-fields/exclusions/clx...
```

Returns 204. The field reappears in the unmapped warning list. Source coverage decreases.

### 5. List all exclusions

```bash
curl http://localhost:3000/api/plans/clx.../object-mappings/clx.../unmapped-fields/exclusions
```

## UI Layout

The unmapped fields panel is displayed on the field mapping page, below the field mapping table (or as a collapsible section). It contains:

1. **Warning section -- Unmapped source fields** (yellow/amber border):
   - Lists each unmapped source field with name, type, and a checkbox for bulk selection
   - "Select all" checkbox + "Exclure la selection" button for bulk exclusion
   - Each field has an individual "Exclure" button

2. **Warning section -- Unmapped required destination fields** (red border):
   - Lists each unmapped required destination field with name and type
   - No exclusion option -- these must be resolved by creating a field mapping

3. **Info section -- Excluded fields** (grey border, collapsed by default):
   - Lists each intentionally excluded field with name and reason
   - Each field has a "Restaurer" button to reverse the exclusion

4. **Coverage badges** (displayed at the top or in the object mapping tab):
   - Source coverage: "80% couvert (18/25 champs)"
   - Destination required coverage: "75% couvert (3/4 obligatoires)"
   - Overall status: green checkmark when both are 100%

## Auto-Clear Behavior

When a FieldMapping is created for a source field that was previously excluded, the exclusion is automatically cleared:
- The field disappears from the excluded section
- No manual un-exclusion needed
- The field appears as "mapped" in the field mapping table
- Source coverage is not affected (mapped replaces excluded in the numerator)

## Dependencies

- **Depends on**: 012-field-mapping (FieldMapping model + field lists), 011-object-mapping (ObjectMapping model), 000-connector-interface (ConnectorField.isRequired)
- **Used by**: 011-object-mapping (fields remaining to validate count in detail modal A3), 012-field-mapping (unmapped field warnings in the field mapping view)
