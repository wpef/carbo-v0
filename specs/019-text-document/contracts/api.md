# API Contracts: Text Document Generation

## Base URL

All routes are Next.js Route Handlers under `/api/plans/[planId]/documents/text`.

---

## POST /api/plans/[planId]/documents/text

**Purpose**: Generate a new text document from the current migration plan state (FR-001, FR-002).

**Request Body**: None (generation uses the current plan state).

**Response** `201 Created`:
```json
{
  "id": "string (cuid)",
  "mappingPlanId": "string",
  "status": "CURRENT",
  "fieldCount": 42,
  "ruleCount": 8,
  "unmappedCount": 5,
  "llmCallCount": 2,
  "generatedAt": "ISO 8601"
}
```

**Notes**: Does not return `htmlContent` in the creation response (can be large). Use `GET .../[documentId]` to retrieve the full document. All previous `CURRENT` text documents for this plan are NOT automatically transitioned to `OUTDATED` -- multiple `CURRENT` versions can coexist. The `OUTDATED` transition only happens on source/destination reconfiguration events (FR-013).

**Errors**:
- `404 Not Found`: Plan does not exist. Body: `{ "error": "Plan not found" }`.
- `400 Bad Request`: Plan has no object mappings. Body: `{ "error": "Plan has no object mappings -- nothing to document" }`.
- `500 Internal Server Error`: Generation failed mid-process. Body: `{ "error": "Document generation failed" }`. Partial documents are never persisted.

**Audit**: Logs `TEXT_DOCUMENT_GENERATED` with `entityType: "TextDocument"`, `entityId: <new doc id>`, `details: { planId, fieldCount, ruleCount, unmappedCount, llmCallCount, generationTimeMs }`.

---

## GET /api/plans/[planId]/documents/text

**Purpose**: List all text document versions for a plan.

**Response** `200 OK`:
```json
[
  {
    "id": "string (cuid)",
    "status": "CURRENT | OUTDATED",
    "fieldCount": 42,
    "ruleCount": 8,
    "unmappedCount": 5,
    "llmCallCount": 2,
    "generatedAt": "ISO 8601"
  }
]
```

**Notes**: Ordered by `generatedAt` descending (most recent first). Returns an empty array if no documents have been generated. Does not include `htmlContent` (lightweight for list view).

**Audit**: No audit log for list operations.

---

## GET /api/plans/[planId]/documents/text/[documentId]

**Purpose**: Retrieve a single text document with full HTML content.

**Response** `200 OK`:
```json
{
  "id": "string (cuid)",
  "mappingPlanId": "string",
  "htmlContent": "string (full HTML)",
  "status": "CURRENT | OUTDATED",
  "fieldCount": 42,
  "ruleCount": 8,
  "unmappedCount": 5,
  "llmCallCount": 2,
  "generatedAt": "ISO 8601"
}
```

**Errors**:
- `404 Not Found`: Document or plan does not exist. Body: `{ "error": "Document not found" }`.

**Audit**: No audit log for read operations.

---

## Service Function (internal)

The document generation logic is encapsulated in a service function, also callable in-process by feature 021 (PDF export).

```typescript
// src/features/text-document/services/text-document-service.ts

/**
 * Generate a text document for the given plan.
 * Loads plan data, generates rule descriptions (via 018), renders HTML template, persists to DB.
 *
 * @param planId - The migration plan ID
 * @returns The created TextDocument record (without htmlContent for response size)
 */
async function generateTextDocument(planId: string): Promise<TextDocumentRecord>

/**
 * Transition all CURRENT text documents for a plan to OUTDATED.
 * Called by reconfiguration cascade (features 002/006).
 *
 * @param planId - The migration plan ID
 * @returns Number of documents transitioned
 */
async function markTextDocumentsOutdated(planId: string): Promise<number>
```

---

## Error Response Format

All error responses follow the standard shape:

```json
{
  "error": "string (human-readable message)"
}
```

HTTP status codes used: `400` (validation), `404` (not found), `500` (internal server error).

---

## TypeScript Types (shared)

```typescript
// src/features/text-document/types.ts

interface TextDocumentRecord {
  id: string
  mappingPlanId: string
  htmlContent: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
  generatedAt: string
}

interface TextDocumentListItem {
  id: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
  generatedAt: string
}

interface GenerateTextDocumentResponse {
  id: string
  mappingPlanId: string
  status: 'CURRENT'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
  generatedAt: string
}
```
