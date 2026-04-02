# API Contracts: Text Document Generation

## POST /api/plans/[planId]/documents/text

Generate a new text document for the plan. Creates a new immutable version.

### Request

No body required. The route loads all plan data.

### Response 201

```json
{
  "id": "clxyz123",
  "mappingPlanId": "clxyz000",
  "generatedAt": "2026-03-25T14:30:00.000Z",
  "stats": {
    "fieldCount": 25,
    "ruleCount": 8,
    "unmappedCount": 3,
    "llmCallCount": 2
  }
}
```

Note: `htmlContent` is NOT included in the POST response to keep it lightweight. Use GET with document ID to retrieve content.

### Response 404

```json
{ "error": "Plan not found" }
```

### Response 500

```json
{ "error": "Document generation failed", "details": "..." }
```

---

## GET /api/plans/[planId]/documents/text

List all text document versions for a plan, ordered by most recent first.

### Response 200

```json
{
  "documents": [
    {
      "id": "clxyz123",
      "generatedAt": "2026-03-25T14:30:00.000Z",
      "stats": {
        "fieldCount": 25,
        "ruleCount": 8,
        "unmappedCount": 3,
        "llmCallCount": 2
      }
    }
  ]
}
```

---

## GET /api/plans/[planId]/documents/text/[documentId]

Retrieve a specific text document including its HTML content.

### Response 200

```json
{
  "id": "clxyz123",
  "mappingPlanId": "clxyz000",
  "htmlContent": "<!DOCTYPE html><html>...</html>",
  "generatedAt": "2026-03-25T14:30:00.000Z",
  "stats": {
    "fieldCount": 25,
    "ruleCount": 8,
    "unmappedCount": 3,
    "llmCallCount": 2
  }
}
```

### Response 404

```json
{ "error": "Document not found" }
```
