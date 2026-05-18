# API Contracts: Migration Logic

## Base URL

All routes are Next.js Route Handlers nested under the field mapping resource:
`/api/plans/[planId]/object-mappings/[objectMappingId]/field-mappings/[fieldMappingId]/migration-logic`

---

## GET /api/plans/[planId]/object-mappings/[objectMappingId]/field-mappings/[fieldMappingId]/migration-logic

**Purpose**: Retrieve the migration logic for a field mapping (FR-001, FR-002).

**Response** `200 OK`:
```json
{
  "id": "string (cuid)",
  "fieldMappingId": "string",
  "status": "DRAFT | DEFINED | VALIDATED",
  "sectionType": "VALUE_EQUIVALENCE | PROMPT | ERROR | INFORMATIONAL",
  "valueEquivalences": [
    {
      "id": "string",
      "sourceValue": "string",
      "destinationValue": "string"
    }
  ],
  "classificationPrompt": {
    "id": "string",
    "promptText": "string"
  } | null,
  "informationalMessage": "string | null",
  "sourceField": {
    "name": "string",
    "type": "string",
    "picklistValues": ["string"] | null
  },
  "destinationField": {
    "name": "string",
    "type": "string",
    "picklistValues": ["string"] | null
  },
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Response** `404 Not Found` (no logic exists yet):
```json
{
  "fieldMappingId": "string",
  "sectionType": "VALUE_EQUIVALENCE | PROMPT | ERROR | INFORMATIONAL",
  "sourceField": {
    "name": "string",
    "type": "string",
    "picklistValues": ["string"] | null
  },
  "destinationField": {
    "name": "string",
    "type": "string",
    "picklistValues": ["string"] | null
  },
  "informationalMessage": "string | null",
  "valueEquivalences": [],
  "classificationPrompt": null
}
```

**Notes**: When no MigrationLogic record exists, the response still returns field metadata and the computed sectionType so the modal can render the correct section. The `sectionType` is computed from the Type Compatibility Matrix, not stored. `picklistValues` is populated only for picklist/checkbox fields. `informationalMessage` is populated only for D4 sections (e.g., "La valeur sera copiee").

**Audit**: No audit log for read operations.

---

## PUT /api/plans/[planId]/object-mappings/[objectMappingId]/field-mappings/[fieldMappingId]/migration-logic

**Purpose**: Create or update migration logic for a field mapping (FR-012, FR-013).

**Request Body** (D1 -- Value Equivalence):
```json
{
  "action": "SAVE | VALIDATE",
  "valueEquivalences": [
    {
      "sourceValue": "string",
      "destinationValue": "string"
    }
  ]
}
```

**Request Body** (D2 -- Classification Prompt):
```json
{
  "action": "SAVE | VALIDATE",
  "classificationPrompt": "string"
}
```

**Request Body** (D4 -- Informational):
```json
{
  "action": "VALIDATE"
}
```

**Response** `200 OK`:
```json
{
  "id": "string (cuid)",
  "fieldMappingId": "string",
  "status": "DEFINED | VALIDATED",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Validation**:
- `action` must be `SAVE` or `VALIDATE`. SAVE sets status to DEFINED (orange). VALIDATE sets status to VALIDATED (green).
- For D1: `valueEquivalences` must be an array. Each entry must have non-empty `sourceValue` and `destinationValue`. A source value must not appear more than once (FR-006).
- For D2: `classificationPrompt` must be a non-empty string.
- For D4: No additional body fields required -- only `action: "VALIDATE"`.
- D3 (Error) does NOT accept PUT requests -- the section has no Save/Validate (FR-003).

**Errors**:
- `400 Bad Request`: Validation failure. Body: `{ "error": "string" }`.
- `404 Not Found`: Field mapping does not exist.
- `409 Conflict`: Attempting to save logic for a D3 (incompatible types) field mapping. Body: `{ "error": "Cannot define migration logic for incompatible field types" }`.

**Audit**: Logs `MIGRATION_LOGIC_SAVED` or `MIGRATION_LOGIC_VALIDATED` with `entityType: "MigrationLogic"`, `entityId: <logic id>`, `details: { fieldMappingId, sectionType, action, valueEquivalenceCount? }`.

**Transaction**: The upsert is wrapped in a Prisma transaction: delete existing ValueEquivalence rows (if D1), then upsert MigrationLogic + create new ValueEquivalence/ClassificationPrompt.

---

## POST /api/plans/[planId]/object-mappings/[objectMappingId]/field-mappings/[fieldMappingId]/migration-logic/classify

**Purpose**: Generate LLM classification preview for D2 sections (FR-008, FR-009).

**Request Body**:
```json
{
  "prompt": "string",
  "destinationValues": ["string"],
  "sampleSourceValues": ["string (4-5 values)"]
}
```

**Response** `200 OK`:
```json
{
  "classifications": [
    {
      "sourceValue": "string",
      "classifiedValue": "string"
    }
  ]
}
```

**Notes**: The LLM is called server-side via `@anthropic-ai/sdk`. The system prompt constrains the output to one of the `destinationValues`. Each source value is classified independently. This endpoint is stateless -- it does not persist anything. The client debounces calls (500ms after last keystroke).

**Errors**:
- `400 Bad Request`: Missing required fields.
- `503 Service Unavailable`: LLM API unreachable or API key not configured. Body: `{ "error": "Classification unavailable -- check LLM configuration" }`.

**Audit**: No audit log for preview operations (stateless).

---

## Error Response Format

All error responses follow a consistent shape:

```json
{
  "error": "string (human-readable message)"
}
```

HTTP status codes used: `400` (validation), `404` (not found), `409` (conflict), `500` (internal server error), `503` (LLM unavailable).

---

## TypeScript Types (shared)

```typescript
// src/features/migration-logic/types.ts

type SectionType = 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL'

type LinkStatus = 'GREEN' | 'ORANGE' | 'RED_SOLID' | 'RED_DASHED' | 'BROKEN'

interface MigrationLogicDetail {
  id?: string
  fieldMappingId: string
  status?: 'DRAFT' | 'DEFINED' | 'VALIDATED'
  sectionType: SectionType
  sourceField: {
    name: string
    type: string
    picklistValues: string[] | null
  }
  destinationField: {
    name: string
    type: string
    picklistValues: string[] | null
  }
  valueEquivalences: ValueEquivalenceItem[]
  classificationPrompt: { id?: string; promptText: string } | null
  informationalMessage: string | null
  createdAt?: string
  updatedAt?: string
}

interface ValueEquivalenceItem {
  id?: string
  sourceValue: string
  destinationValue: string
}

interface SaveMigrationLogicInput {
  action: 'SAVE' | 'VALIDATE'
  valueEquivalences?: ValueEquivalenceItem[]
  classificationPrompt?: string
}

interface ClassifyRequest {
  prompt: string
  destinationValues: string[]
  sampleSourceValues: string[]
}

interface ClassifyResponse {
  classifications: {
    sourceValue: string
    classifiedValue: string
  }[]
}
```
