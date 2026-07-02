# Quickstart: PDF Export

## What this feature provides

On-demand PDF generation from any generated document (text or contractual). Produces professional A4 PDFs with headers, footers, page numbers, and clean page breaks using Puppeteer with serverless-compatible Chromium.

## Prerequisites

- Feature 019 (Text Document) and/or 020 (Contractual Document) implemented
- `puppeteer-core` and `@sparticuz/chromium` installed:
  ```bash
  npm install puppeteer-core @sparticuz/chromium
  npm install -D puppeteer  # For local development Chromium binary
  ```
- At least one generated document (text or contractual) exists for a plan

## How to use

### 1. Download a text document as PDF

```bash
curl -O -J http://localhost:3000/api/plans/{planId}/documents/text/{documentId}/pdf
```

Downloads: `Acme-Migration_text-document_2026-05-18.pdf`

### 2. Download a contractual document as PDF

```bash
curl -O -J http://localhost:3000/api/plans/{planId}/documents/contractual/{documentId}/pdf
```

Downloads: `Acme-Migration_contractual-document_2026-05-18.pdf`

### 3. UI download

On the documents page (`/plans/{planId}/documents`), each document row has a "Telecharger PDF" button. Clicking it triggers the download with a loading indicator during generation.

### 4. Fallback if Puppeteer is unavailable

If the PDF service returns a 503 error, the consultant can use the browser's built-in print function (`Ctrl+P` / `Cmd+P`) on the HTML preview to generate a PDF manually.

## PDF Specifications

| Property | Value |
|----------|-------|
| Page size | A4 (210mm x 297mm) |
| Margins | Top: 25mm, Bottom: 25mm, Left: 20mm, Right: 20mm |
| Header | Document title + generation date (every page) |
| Footer | "Page X sur Y" (every page) |
| Page breaks | Tables and headings never split across pages |
| Filename | `{plan-name}_{document-type}_{date}.pdf` |

## Using the service function directly

```typescript
import { generatePdf } from '@/features/pdf-export/services/pdf-generator'
import type { PdfGenerationInput } from '@/features/pdf-export/types'

const input: PdfGenerationInput = {
  htmlContent: '<html>...</html>',
  title: 'Acme Migration - Document texte',
  generatedAt: '2026-05-18T14:30:00.000Z',
  filename: 'Acme-Migration_text-document_2026-05-18.pdf',
}

const result = await generatePdf(input)
// result.buffer → PDF binary data (Buffer)
// result.fileSizeBytes → 245760
// result.generationTimeMs → 3200
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CHROMIUM_PATH` | No | Override Chromium binary path for local development. If not set, uses `puppeteer`'s bundled Chromium. |
| `NODE_ENV` | Auto | `production` on Vercel uses `@sparticuz/chromium`; otherwise uses local Chromium. |

## Dependencies

- **Depends on**: 019 (Text Document), 020 (Contractual Document)
- **Used by**: Nothing (terminal feature in the document workflow)
