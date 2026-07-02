# API Contracts: Contractual Document Generation

## Base URL

All routes are Next.js Route Handlers under `/api/plans/[planId]/documents/contractual`.

---

## POST /api/plans/[planId]/documents/contractual

**Purpose**: Generate a new contractual document from the current migration plan state (FR-001).

**Request Body**: None (generation uses the current plan state).

**Response** `201 Created`:
```json
{
  "id": "string (cuid)",
  "mappingPlanId": "string",
  "referenceNumber": "CARBO-20260518-0001",
  "status": "CURRENT",
  "fieldCount": 42,
  "ruleCount": 8,
  "unmappedCount": 5,
  "filterCount": 2,
  "llmCallCount": 2,
  "generatedAt": "ISO 8601"
}
```

**Notes**: Does not return `htmlContent` in the creation response. The reference number is generated automatically (FR-013). Each generation creates a new document with a new reference number, even if the plan has not changed.

**Errors**:
- `404 Not Found`: Plan does not exist. Body: `{ "error": "Plan not found" }`.
- `400 Bad Request`: Plan has no object mappings. Body: `{ "error": "Plan has no object mappings -- nothing to document" }`.
- `500 Internal Server Error`: Generation failed mid-process. Body: `{ "error": "Document generation failed" }`. No partial document persisted.

**Audit**: Logs `CONTRACTUAL_DOCUMENT_GENERATED` with `entityType: "ContractualDocument"`, `entityId: <new doc id>`, `details: { planId, referenceNumber, fieldCount, ruleCount, unmappedCount, filterCount, llmCallCount, generationTimeMs }`.

---

## GET /api/plans/[planId]/documents/contractual

**Purpose**: List all contractual document versions for a plan.

**Response** `200 OK`:
```json
[
  {
    "id": "string (cuid)",
    "referenceNumber": "CARBO-20260518-0001",
    "status": "CURRENT | OUTDATED",
    "fieldCount": 42,
    "ruleCount": 8,
    "unmappedCount": 5,
    "filterCount": 2,
    "llmCallCount": 2,
    "generatedAt": "ISO 8601"
  }
]
```

**Notes**: Ordered by `generatedAt` descending (most recent first). Returns an empty array if no documents have been generated. Does not include `htmlContent`.

**Audit**: No audit log for list operations.

---

## GET /api/plans/[planId]/documents/contractual/[documentId]

**Purpose**: Retrieve a single contractual document with full HTML content.

**Response** `200 OK`:
```json
{
  "id": "string (cuid)",
  "mappingPlanId": "string",
  "referenceNumber": "CARBO-20260518-0001",
  "htmlContent": "string (full HTML)",
  "status": "CURRENT | OUTDATED",
  "fieldCount": 42,
  "ruleCount": 8,
  "unmappedCount": 5,
  "filterCount": 2,
  "llmCallCount": 2,
  "generatedAt": "ISO 8601"
}
```

**Errors**:
- `404 Not Found`: Document or plan does not exist. Body: `{ "error": "Document not found" }`.

**Audit**: No audit log for read operations.

---

## Service Functions (internal)

```typescript
// src/features/contractual-document/services/contractual-document-service.ts

/**
 * Generate a contractual document for the given plan.
 * Loads plan data, generates rule descriptions (via 018), generates reference number,
 * renders HTML template, persists to DB.
 *
 * @param planId - The migration plan ID
 * @returns The created ContractualDocument record (without htmlContent)
 */
async function generateContractualDocument(planId: string): Promise<ContractualDocumentRecord>

/**
 * Transition all CURRENT contractual documents for a plan to OUTDATED.
 * Called by reconfiguration cascade (features 002/006).
 *
 * @param planId - The migration plan ID
 * @returns Number of documents transitioned
 */
async function markContractualDocumentsOutdated(planId: string): Promise<number>
```

```typescript
// src/features/contractual-document/services/reference-number-generator.ts

/**
 * Generate a globally unique reference number in CARBO-YYYYMMDD-XXXX format.
 * Queries the database for existing references on the same day to compute the counter.
 * Retries up to 3 times on uniqueness conflict (concurrent generation).
 *
 * @returns Unique reference number string
 */
async function generateReferenceNumber(): Promise<string>
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
// src/features/contractual-document/types.ts

interface ContractualDocumentRecord {
  id: string
  mappingPlanId: string
  referenceNumber: string
  htmlContent: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  filterCount: number
  llmCallCount: number
  generatedAt: string
}

interface ContractualDocumentListItem {
  id: string
  referenceNumber: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  filterCount: number
  llmCallCount: number
  generatedAt: string
}

interface GenerateContractualDocumentResponse {
  id: string
  mappingPlanId: string
  referenceNumber: string
  status: 'CURRENT'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  filterCount: number
  llmCallCount: number
  generatedAt: string
}
```
