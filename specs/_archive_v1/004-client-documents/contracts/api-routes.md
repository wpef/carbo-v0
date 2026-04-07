# API Routes: Client Documents

**Feature**: 004-client-documents
**Date**: 2026-03-19

## Generation

### POST /api/documents/generate

Generate a document from a mapping plan.

**Request**:
```json
{
  "planId": "uuid",
  "documentType": "TEXT"
}
```

**Response** (202 — Accepted, generation in progress):
```json
{
  "generationId": "uuid",
  "status": "GENERATING",
  "estimatedDuration": "15-30 seconds"
}
```

**Errors**:
- 400: Invalid plan ID or document type
- 404: Mapping plan not found
- 409: Generation already in progress for this plan/type

---

### GET /api/documents/generate/{generationId}/status

Poll generation status.

**Response** (200):
```json
{
  "generationId": "uuid",
  "status": "COMPLETE",
  "documentId": "uuid",
  "fieldMappingCount": 45,
  "unmappedFieldCount": 22,
  "ruleCount": 12,
  "generatedAt": "2026-03-19T10:00:30Z"
}
```

---

## Retrieval

### GET /api/documents/{documentId}

Retrieve the generated document HTML for in-app preview.

**Response** (200):
```json
{
  "id": "uuid",
  "title": "Migration Plan: Salesforce → HubSpot — Text Description",
  "documentType": "TEXT",
  "htmlContent": "<html>...",
  "generatedAt": "2026-03-19T10:00:30Z",
  "plan": {
    "id": "uuid",
    "name": "SF → HS Q1 Migration"
  }
}
```

---

### GET /api/documents/{documentId}/pdf

Download the document as PDF. Generated on demand from stored HTML.

**Response** (200):
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="migration-plan-text-2026-03-19.pdf"`
- Body: PDF binary

**Errors**:
- 500: PDF generation failed (Puppeteer error)

---

## List

### GET /api/documents?planId={planId}

List all generated documents, optionally filtered by plan.

**Response** (200):
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Migration Plan: SF → HS — Text Description",
      "documentType": "TEXT",
      "generatedAt": "2026-03-19T10:00:30Z",
      "fieldMappingCount": 45,
      "planName": "SF → HS Q1 Migration"
    },
    {
      "id": "uuid",
      "title": "Migration Plan: SF → HS — Contractual Document",
      "documentType": "CONTRACTUAL",
      "generatedAt": "2026-03-19T10:05:00Z",
      "fieldMappingCount": 45,
      "planName": "SF → HS Q1 Migration"
    }
  ]
}
```
