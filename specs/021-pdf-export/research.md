# Research: PDF Export

## Decision: Puppeteer vs. alternatives

**Chosen**: Puppeteer (headless Chrome).

**Rationale**: Mandated by the constitution's Technology Standards. Puppeteer produces high-fidelity PDFs from HTML with full CSS support, headers/footers via template, and page break control via CSS properties.

**Rejected by constitution**: jsPDF (canvas-based, poor CSS support), wkhtmltopdf (deprecated), react-pdf (requires JSX, not raw HTML).

## Decision: Puppeteer lifecycle management

**Chosen**: Launch a new browser instance per PDF generation, close it after completion.

**Rationale**: For v0 (local-first, low concurrency), launch-per-request is simplest and most reliable. No risk of stale browser state or memory leaks from a persistent instance. Typical launch time is 1-2s, acceptable within the 15s budget.

**Rejected**: Persistent browser pool. Premature optimization for v0. Adds complexity around lifecycle management, health checks, and connection limits. Can be introduced later if generation volume warrants it.

## Decision: Header/footer implementation

**Chosen**: Puppeteer's `headerTemplate` and `footerTemplate` options in `page.pdf()`.

**Rationale**: These are rendered by Chrome outside the main content area, on every page. They support HTML with special CSS classes: `date`, `title`, `pageNumber`, `totalPages`. This is the standard Puppeteer approach and avoids CSS hacks in the main HTML.

**Implementation**:
```typescript
headerTemplate: '<div style="font-size:9px;width:100%;text-align:center;">{title} | {date}</div>'
footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
```

## Decision: Page break handling

**Chosen**: CSS `break-inside: avoid` on table rows and section headings, injected into the HTML before rendering.

**Rationale**: The simplest cross-browser approach. Applied to `<tr>`, `<h2>`, `<h3>` elements. Puppeteer respects these CSS properties when paginating. No JavaScript-based page break logic needed.

## Decision: Filename sanitization

**Chosen**: Replace non-alphanumeric characters (except hyphens) with hyphens, collapse multiple hyphens, lowercase.

**Implementation**: `planName.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase()`

**Pattern**: `{plan-name}_{document-type}_{date}.pdf` (e.g., `acme-migration_text-document_2026-03-25.pdf`)

## Decision: PDF route design -- generic vs. document-type-specific

**Chosen**: Single generic route at `/api/plans/[planId]/documents/[documentId]/pdf` that determines document type from the database.

**Rationale**: Both TextDocument and ContractualDocument produce PDFs identically (HTML -> PDF). A single route avoids duplication. The route loads the document by ID, checks which table it belongs to, and passes the HTML to the PDF service.

**Rejected**: Separate routes per document type (`/text/{id}/pdf`, `/contractual/{id}/pdf`). Duplicates the same Puppeteer logic.

## Constraint: Self-contained HTML

The PDF service assumes the input HTML is fully self-contained (inline CSS, no external resources). This is guaranteed by the template builders in 019 and 020, which embed all styles in a `<style>` block.

## Constraint: No persistent storage

PDFs are generated on each download request. They are NOT stored in the database. The source of truth is the stored HTML in TextDocument or ContractualDocument. If caching or permanent PDF storage becomes necessary, it will be a separate feature.

## Constraint: Fallback when Puppeteer unavailable

If Puppeteer fails to launch (missing Chrome/Chromium binary, resource exhaustion), the API returns a 503 with an error message suggesting the browser's built-in print-to-PDF as a fallback. The HTML document preview remains accessible.
