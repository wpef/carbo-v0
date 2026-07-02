# Data Model: PDF Export

## Overview

This feature does not introduce new Prisma models. PDFs are generated on-demand and streamed to the client without persistent storage (FR-005). The source of truth is the HTML content stored in `TextDocument` (feature 019) or `ContractualDocument` (feature 020).

## Type Definitions

All types are defined in `src/features/pdf-export/types.ts`.

### PdfGenerationInput

```typescript
interface PdfGenerationInput {
  htmlContent: string               // Self-contained HTML document
  title: string                     // For header template (e.g. "Acme Migration - Document texte")
  generatedAt: string               // ISO 8601, for header template
  filename: string                  // Sanitized filename for Content-Disposition
}
```

### PdfGenerationResult

```typescript
interface PdfGenerationResult {
  buffer: Buffer                    // PDF binary data
  filename: string                  // Sanitized filename
  fileSizeBytes: number             // For audit trail and Content-Length header
  generationTimeMs: number          // For audit trail and observability
}
```

### PdfPageOptions

```typescript
interface PdfPageOptions {
  format: 'A4'
  margin: {
    top: string     // '25mm' (FR-002)
    bottom: string  // '25mm'
    left: string    // '20mm'
    right: string   // '20mm'
  }
  headerTemplate: string            // HTML template with title + date
  footerTemplate: string            // HTML template with page number
  displayHeaderFooter: true
  printBackground: true             // Preserve background colors and styles
}
```

### PdfDownloadContext

Used by the API route to build the `PdfGenerationInput` from the document record.

```typescript
interface PdfDownloadContext {
  planName: string
  documentType: 'text-document' | 'contractual-document'
  documentId: string
  htmlContent: string
  generatedAt: string
  referenceNumber?: string          // Only for contractual documents
}
```

## Constants

```typescript
// src/features/pdf-export/lib/pdf-options.ts

const PDF_DEFAULTS: PdfPageOptions = {
  format: 'A4',
  margin: {
    top: '25mm',
    bottom: '25mm',
    left: '20mm',
    right: '20mm',
  },
  headerTemplate: `
    <div style="width: 100%; font-size: 9px; font-family: Arial, sans-serif; color: #666;
                padding: 0 20mm; display: flex; justify-content: space-between;">
      <span class="title"></span>
      <span class="date"></span>
    </div>
  `,
  footerTemplate: `
    <div style="width: 100%; font-size: 9px; font-family: Arial, sans-serif; color: #666;
                text-align: center; padding: 0 20mm;">
      Page <span class="pageNumber"></span> sur <span class="totalPages"></span>
    </div>
  `,
  displayHeaderFooter: true,
  printBackground: true,
}
```

## Relationships

```
TextDocument.htmlContent ──► PdfGenerationInput.htmlContent        (read-only)
ContractualDocument.htmlContent ──► PdfGenerationInput.htmlContent  (read-only)
PdfGenerationInput ──► PdfGenerationResult                         (in-memory transformation)
```

No persistent relationships. The PDF export feature is a stateless transformer: HTML in, PDF out.
