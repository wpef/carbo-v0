# Quickstart: PDF Export

## Prerequisites

- Node.js 18+
- Features 019 (text-document) or 020 (contractual-document) implemented
- Puppeteer installed

## Install

```bash
npm install puppeteer
```

Puppeteer downloads a compatible Chromium binary automatically. On CI or minimal environments, use `puppeteer-core` with a pre-installed Chrome.

## Generate a PDF

```bash
# Download PDF for a text document
GET /api/plans/{planId}/documents/{documentId}/pdf?type=text

# Download PDF for a contractual document
GET /api/plans/{planId}/documents/{documentId}/pdf?type=contractual

# Response: PDF binary with Content-Disposition header
```

The browser will prompt a file download with filename pattern: `{plan-name}_{document-type}_{date}.pdf`.

## In-App Usage

On any document preview page, click the "Download PDF" button. A loading indicator appears during generation. The PDF is downloaded automatically when ready.

## Run Tests

```bash
npx vitest run tests/unit/services/pdf-export/
```

## Troubleshooting

- **Puppeteer fails to launch**: Ensure Chromium is installed (`npx puppeteer browsers install chrome`). On headless servers, install system dependencies (`apt-get install -y chromium-browser`).
- **PDF is blank or cut off**: Verify the HTML document is self-contained (inline CSS, no external resources).
- **Slow generation**: Expected 5-15s for large documents. Puppeteer launches a full browser instance per request.
