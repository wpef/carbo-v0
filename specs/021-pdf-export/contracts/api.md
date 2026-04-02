# API Contracts: PDF Export

## GET /api/plans/[planId]/documents/[documentId]/pdf

Generate a PDF from the document's HTML content and stream it as a file download.

### Query Parameters

- `type` (required): `text` or `contractual` -- identifies which document table to query.

### Response 200

- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="acme-migration_text-document_2026-03-25.pdf"`
- **Body**: PDF binary stream

### Response 404

```json
{ "error": "Document not found" }
```

### Response 503

```json
{
  "error": "PDF generation unavailable",
  "details": "Puppeteer failed to launch. Use your browser's Print to PDF as an alternative.",
  "fallbackUrl": "/plans/{planId}/documents/text/{documentId}"
}
```

### Response 500

```json
{ "error": "PDF generation failed", "details": "..." }
```
