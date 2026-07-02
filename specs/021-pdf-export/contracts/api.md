# API Contracts: PDF Export

## Base URLs

PDF download routes are nested under the existing document routes:
- Text document PDF: `/api/plans/[planId]/documents/text/[documentId]/pdf`
- Contractual document PDF: `/api/plans/[planId]/documents/contractual/[documentId]/pdf`

---

## GET /api/plans/[planId]/documents/text/[documentId]/pdf

**Purpose**: Download a text document as a PDF file (FR-001).

**Request**: No body. Query parameters: none.

**Response** `200 OK`:
- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="{plan-name}_text-document_{date}.pdf"`
- **Content-Length**: `{file size in bytes}`
- **Body**: Binary PDF data

**Notes**: The PDF is generated on-demand from the document's HTML content (FR-005). Generation may take up to 15 seconds for large documents. The filename is sanitized: special characters replaced by hyphens, plan name truncated to 50 characters.

**Errors**:
- `404 Not Found`: Document or plan does not exist. Body: `{ "error": "Document not found" }`.
- `503 Service Unavailable`: Puppeteer/Chromium unavailable. Body: `{ "error": "PDF generation service unavailable. You can use your browser's print function (Ctrl+P) on the HTML preview as a fallback." }`.
- `500 Internal Server Error`: PDF generation failed. Body: `{ "error": "PDF generation failed" }`.

**Audit**: Logs `PDF_GENERATED` with `entityType: "TextDocument"`, `entityId: <doc id>`, `details: { planId, documentType: "text", fileSizeBytes, generationTimeMs }`.

---

## GET /api/plans/[planId]/documents/contractual/[documentId]/pdf

**Purpose**: Download a contractual document as a PDF file (FR-001).

**Request**: No body. Query parameters: none.

**Response** `200 OK`:
- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="{plan-name}_contractual-document_{date}.pdf"`
- **Content-Length**: `{file size in bytes}`
- **Body**: Binary PDF data

**Notes**: Same generation behavior as text document PDF. The contractual document's formal styling is preserved in the PDF.

**Errors**: Same as text document PDF route.

**Audit**: Logs `PDF_GENERATED` with `entityType: "ContractualDocument"`, `entityId: <doc id>`, `details: { planId, documentType: "contractual", referenceNumber, fileSizeBytes, generationTimeMs }`.

---

## Service Function (internal)

The PDF generation logic is encapsulated in a reusable service function.

```typescript
// src/features/pdf-export/services/pdf-generator.ts

/**
 * Generate a PDF from HTML content using Puppeteer.
 *
 * - Launches Chromium (serverless-compatible via @sparticuz/chromium)
 * - Loads HTML content into a page
 * - Injects page-break CSS rules for clean table/heading breaks
 * - Generates A4 PDF with headers (title + date) and footers (page numbers)
 * - Returns the PDF buffer with metadata
 *
 * @param input - HTML content, title, date, and filename
 * @returns PDF buffer with file size and generation time
 * @throws Error if Chromium fails to launch or PDF generation fails
 */
async function generatePdf(input: PdfGenerationInput): Promise<PdfGenerationResult>
```

```typescript
// src/features/pdf-export/lib/chromium.ts

/**
 * Resolve the Chromium executable path based on the runtime environment.
 *
 * - Production (Vercel): uses @sparticuz/chromium compressed binary
 * - Development: uses local Chromium from puppeteer or CHROMIUM_PATH env var
 *
 * @returns { executablePath: string, args: string[] } for puppeteer.launch()
 */
async function getChromiumConfig(): Promise<{ executablePath: string; args: string[] }>
```

```typescript
// src/features/pdf-export/lib/filename.ts

/**
 * Generate a sanitized PDF filename.
 *
 * Pattern: {planName}_{documentType}_{date}.pdf
 * - Special characters → hyphens
 * - Consecutive hyphens → single hyphen
 * - Plan name truncated to 50 characters
 * - Date in YYYY-MM-DD format
 *
 * @param planName - The migration plan name
 * @param documentType - "text-document" or "contractual-document"
 * @param generatedAt - ISO 8601 date string
 * @returns Sanitized filename
 */
function generatePdfFilename(planName: string, documentType: string, generatedAt: string): string
```

---

## Error Response Format

Non-PDF error responses follow the standard shape:

```json
{
  "error": "string (human-readable message)"
}
```

HTTP status codes used: `404` (not found), `500` (generation failure), `503` (Chromium unavailable).

---

## TypeScript Types (shared)

```typescript
// src/features/pdf-export/types.ts

interface PdfGenerationInput {
  htmlContent: string
  title: string
  generatedAt: string
  filename: string
}

interface PdfGenerationResult {
  buffer: Buffer
  filename: string
  fileSizeBytes: number
  generationTimeMs: number
}

interface PdfPageOptions {
  format: 'A4'
  margin: {
    top: string
    bottom: string
    left: string
    right: string
  }
  headerTemplate: string
  footerTemplate: string
  displayHeaderFooter: true
  printBackground: true
}

interface PdfDownloadContext {
  planName: string
  documentType: 'text-document' | 'contractual-document'
  documentId: string
  htmlContent: string
  generatedAt: string
  referenceNumber?: string
}
```
