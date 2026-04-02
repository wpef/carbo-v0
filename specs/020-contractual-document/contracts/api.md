# API Contracts: Contractual Document Generation

## POST /api/plans/[planId]/documents/contractual

Generate a new contractual document for the plan. Creates a new immutable version with a unique reference number.

### Request

No body required. The route loads all plan data.

### Response 201

```json
{
  "id": "clxyz123",
  "mappingPlanId": "clxyz000",
  "referenceNumber": "CARBO-20260325-0001",
  "generatedAt": "2026-03-25T14:30:00.000Z",
  "stats": {
    "fieldCount": 40,
    "ruleCount": 8,
    "unmappedCount": 5,
    "filterCount": 2,
    "llmCallCount": 2
  }
}
```

Note: `htmlContent` is NOT included in the POST response. Use GET with document ID.

### Response 404

```json
{ "error": "Plan not found" }
```

### Response 500

```json
{ "error": "Document generation failed", "details": "..." }
```

---

## GET /api/plans/[planId]/documents/contractual

List all contractual document versions for a plan, ordered by most recent first.

### Response 200

```json
{
  "documents": [
    {
      "id": "clxyz123",
      "referenceNumber": "CARBO-20260325-0001",
      "generatedAt": "2026-03-25T14:30:00.000Z",
      "stats": {
        "fieldCount": 40,
        "ruleCount": 8,
        "unmappedCount": 5,
        "filterCount": 2,
        "llmCallCount": 2
      }
    }
  ]
}
```

---

## GET /api/plans/[planId]/documents/contractual/[documentId]

Retrieve a specific contractual document including its HTML content.

### Response 200

```json
{
  "id": "clxyz123",
  "mappingPlanId": "clxyz000",
  "referenceNumber": "CARBO-20260325-0001",
  "htmlContent": "<!DOCTYPE html><html>...</html>",
  "generatedAt": "2026-03-25T14:30:00.000Z",
  "stats": {
    "fieldCount": 40,
    "ruleCount": 8,
    "unmappedCount": 5,
    "filterCount": 2,
    "llmCallCount": 2
  }
}
```

### Response 404

```json
{ "error": "Document not found" }
```
