# API Contracts: Migration Logic

Base path: `/api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]`

## GET .../migration-logic

Get existing migration logic for a field mapping (or null if none exists).

**Response 200**:
```json
{
  "migrationLogic": {
    "id": "uuid",
    "sectionType": "VALUE_EQUIVALENCE",
    "status": "DEFINED",
    "valueEquivalences": [
      { "id": "uuid", "sourceValue": "Web", "destinationValue": "Online" },
      { "id": "uuid", "sourceValue": "Referral", "destinationValue": "Partner" }
    ],
    "classificationPrompt": null,
    "createdAt": "2026-04-02T10:00:00Z"
  }
}
```

**Response 200** (no logic defined yet):
```json
{
  "migrationLogic": null,
  "suggestedSection": "D1",
  "sourceFieldType": "picklist",
  "destinationFieldType": "picklist"
}
```

## PUT .../migration-logic

Create or update migration logic for a field mapping.

**Request (D1 - Value Equivalence, Save)**:
```json
{
  "sectionType": "VALUE_EQUIVALENCE",
  "status": "DEFINED",
  "valueEquivalences": [
    { "sourceValue": "Web", "destinationValue": "Online" },
    { "sourceValue": "Referral", "destinationValue": "Partner" },
    { "sourceValue": "Cold Call", "destinationValue": "Outbound" }
  ]
}
```

**Request (D2 - Prompt, Validate)**:
```json
{
  "sectionType": "PROMPT",
  "status": "VALIDATED",
  "promptText": "Classify this industry description into one of the given categories based on the primary business sector."
}
```

**Request (D4 - Informational, Validate)**:
```json
{
  "sectionType": "INFORMATIONAL",
  "status": "VALIDATED"
}
```

**Response 200**:
```json
{
  "id": "uuid",
  "sectionType": "VALUE_EQUIVALENCE",
  "status": "DEFINED",
  "updatedAt": "2026-04-02T10:05:00Z"
}
```

## POST .../classify

Preview LLM classification for D2 sections. Stateless -- does not persist.

**Request**:
```json
{
  "promptText": "Classify this industry description into the appropriate category.",
  "destinationValues": ["Support", "Sales", "Marketing", "Other"],
  "sampleSourceValues": [
    "We need help with our billing system",
    "Looking to expand our sales pipeline",
    "Want to set up email campaigns",
    "General inquiry about pricing"
  ]
}
```

**Response 200**:
```json
{
  "classifications": [
    { "sourceValue": "We need help with our billing system", "classification": "Support" },
    { "sourceValue": "Looking to expand our sales pipeline", "classification": "Sales" },
    { "sourceValue": "Want to set up email campaigns", "classification": "Marketing" },
    { "sourceValue": "General inquiry about pricing", "classification": "Other" }
  ]
}
```

**Response 200** (LLM unavailable):
```json
{
  "classifications": [
    { "sourceValue": "We need help...", "classification": null, "error": "Classification unavailable -- check ANTHROPIC_API_KEY" }
  ]
}
```
