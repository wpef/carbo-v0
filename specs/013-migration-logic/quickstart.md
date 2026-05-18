# Quickstart: Migration Logic

## What this feature provides

A modal interface for defining migration logic on field mappings. Supports four section types: value equivalence (picklist-to-picklist), LLM classification prompt (text-to-picklist), incompatible types error, and simple copy informational. Logic status (defined/validated) drives the link color-coding on the field mapping view.

## Prerequisites

- Feature 012 (Field Mapping) implemented -- FieldMapping model and API routes exist
- Feature 000 (Connector Interface) types available
- Prisma migrated with MigrationLogic, ValueEquivalence, ClassificationPrompt models
- `@anthropic-ai/sdk` installed for D2 classification (optional -- fallback when missing)
- `ANTHROPIC_API_KEY` environment variable set for LLM classification

## How to use

### 1. Get migration logic for a field mapping

```bash
curl http://localhost:3000/api/plans/clx.../object-mappings/clx.../field-mappings/clx.../migration-logic
```

Response (no logic defined yet):
```json
{
  "fieldMappingId": "clx...",
  "sectionType": "VALUE_EQUIVALENCE",
  "sourceField": {
    "name": "Industry",
    "type": "picklist",
    "picklistValues": ["Technology", "Finance", "Healthcare"]
  },
  "destinationField": {
    "name": "industry",
    "type": "picklist",
    "picklistValues": ["Tech", "Financial Services", "Health"]
  },
  "valueEquivalences": [],
  "classificationPrompt": null,
  "informationalMessage": null
}
```

### 2. Save value equivalences (D1 -- picklist to picklist)

```bash
curl -X PUT http://localhost:3000/api/plans/clx.../object-mappings/clx.../field-mappings/clx.../migration-logic \
  -H "Content-Type: application/json" \
  -d '{
    "action": "SAVE",
    "valueEquivalences": [
      { "sourceValue": "Technology", "destinationValue": "Tech" },
      { "sourceValue": "Finance", "destinationValue": "Financial Services" },
      { "sourceValue": "Healthcare", "destinationValue": "Health" }
    ]
  }'
```

Response:
```json
{
  "id": "clx...",
  "fieldMappingId": "clx...",
  "status": "DEFINED",
  "createdAt": "2026-05-18T...",
  "updatedAt": "2026-05-18T..."
}
```

The field link status changes to ORANGE (defined but not validated).

### 3. Validate migration logic

```bash
curl -X PUT http://localhost:3000/api/plans/clx.../object-mappings/clx.../field-mappings/clx.../migration-logic \
  -H "Content-Type: application/json" \
  -d '{
    "action": "VALIDATE",
    "valueEquivalences": [
      { "sourceValue": "Technology", "destinationValue": "Tech" },
      { "sourceValue": "Finance", "destinationValue": "Financial Services" },
      { "sourceValue": "Healthcare", "destinationValue": "Health" }
    ]
  }'
```

The field link status changes to GREEN (validated).

### 4. Preview LLM classification (D2 -- text to picklist)

```bash
curl -X POST http://localhost:3000/api/plans/clx.../object-mappings/clx.../field-mappings/clx.../migration-logic/classify \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Classify this text into one of the following categories",
    "destinationValues": ["Support", "Sales", "Other"],
    "sampleSourceValues": [
      "I need help with my account",
      "Can I get a demo?",
      "Invoice question",
      "Partnership opportunity"
    ]
  }'
```

Response:
```json
{
  "classifications": [
    { "sourceValue": "I need help with my account", "classifiedValue": "Support" },
    { "sourceValue": "Can I get a demo?", "classifiedValue": "Sales" },
    { "sourceValue": "Invoice question", "classifiedValue": "Support" },
    { "sourceValue": "Partnership opportunity", "classifiedValue": "Sales" }
  ]
}
```

### 5. Validate a simple copy (D4 -- text to text)

```bash
curl -X PUT http://localhost:3000/api/plans/clx.../object-mappings/clx.../field-mappings/clx.../migration-logic \
  -H "Content-Type: application/json" \
  -d '{ "action": "VALIDATE" }'
```

## UI Flow

1. Consultant opens the field mapping view for an object mapping
2. Clicks on a link (C1) between a source and destination field
3. Migration logic modal (C2) opens:
   - Header: source field name + type (left), destination field name + type (right)
   - Center: section determined by the Type Compatibility Matrix
   - Footer: Cancel / Save / Validate buttons
4. Consultant interacts with the section-specific UI
5. Clicks Save (link turns orange) or Validate (link turns green)
6. Modal closes, field mapping view reflects the updated link status

## Section Types

| Section | When | Interaction |
|---------|------|-------------|
| D1 Value Equivalence | picklist-to-picklist, checkbox-to-picklist | Draw lines between values, auto-equivalence on open |
| D2 Classification Prompt | text-to-picklist, number-to-picklist, date-to-picklist | Write prompt, see LLM examples, adjust |
| D3 Error | incompatible types (e.g., text-to-number) | Read error message, only Cancel |
| D4 Informational | compatible types (e.g., text-to-text) | Read message, click Validate |

## Dependencies

- **Depends on**: 012-field-mapping (FieldMapping model + API), 000-connector-interface (types)
- **Used by**: 012-field-mapping (link status color-coding), live migration preview (012 US7)
