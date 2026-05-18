# Research: PDF Export

## Decision 1: Puppeteer + @sparticuz/chromium for Serverless

**Decision**: Use `puppeteer-core` (not full `puppeteer`) paired with `@sparticuz/chromium` for the Chromium binary. In development, use the locally installed Chromium. In production (Vercel), use `@sparticuz/chromium` which provides a compressed Chromium binary that fits within serverless function size limits.

**Rationale**: The constitution specifies Puppeteer for HTML-to-PDF conversion and `@sparticuz/chromium` for Vercel compatibility. Full `puppeteer` bundles its own Chromium (~170MB), which exceeds Vercel's function size limit. `puppeteer-core` + `@sparticuz/chromium` (~45MB compressed) fits. The `chromium.ts` module abstracts the binary resolution: `@sparticuz/chromium` in production, `puppeteer.executablePath()` or a local Chromium path in development.

**Alternatives**: Full `puppeteer` (too large for Vercel), wkhtmltopdf (no JS rendering, poor CSS support), Prince XML (commercial license), jsPDF (client-side, no CSS rendering), Vercel's `@vercel/og` (designed for OG images, not multi-page PDFs).

## Decision 2: Local Development Setup

**Decision**: In local development (`process.env.NODE_ENV !== 'production'`), the PDF generator uses the Chromium binary found at the path returned by `puppeteer.executablePath()` (if the full `puppeteer` package is installed as a dev dependency) or a configurable `CHROMIUM_PATH` environment variable.

**Rationale**: Developers need to generate PDFs locally for testing. `@sparticuz/chromium` only works in AWS Lambda-compatible environments -- it does not run on macOS/Windows directly. Having `puppeteer` as a devDependency provides a local Chromium binary. The `CHROMIUM_PATH` env var is a fallback for CI environments or custom Chromium installations.

**Alternatives**: Always use `@sparticuz/chromium` (fails locally), Docker-based Chromium (adds complexity), skip local PDF testing (violates Principle IV).

## Decision 3: Header and Footer Implementation

**Decision**: Use Puppeteer's built-in `headerTemplate` and `footerTemplate` options in `page.pdf()`. The header contains the document title and generation date. The footer contains the page number in "Page X of Y" format using Puppeteer's `<span class="pageNumber">` and `<span class="totalPages">` special classes.

**Rationale**: FR-003 and FR-004 require headers and footers on every page. Puppeteer natively supports header/footer templates with CSS and special classes for page numbers. This is the simplest approach with no post-processing. The templates must be self-contained HTML strings with inline styles (Puppeteer restriction).

**Alternatives**: CSS `@page` rules (limited browser support in Chromium headless), post-processing with pdf-lib (adds dependency and complexity), manual page stamping (error-prone).

## Decision 4: Page Break Handling

**Decision**: Add CSS rules to the document HTML (or inject via Puppeteer's `addStyleTag`) for graceful page breaks: `table { page-break-inside: avoid; }`, `tr { page-break-inside: avoid; }`, `h2, h3 { page-break-after: avoid; }`, `.section { page-break-before: auto; }`. Also set `break-inside: avoid` on table rows and section headings as a modern CSS fallback.

**Rationale**: FR-008 requires tables and headings to not split across pages. Chromium's print rendering respects `page-break-*` and `break-*` CSS properties. Applying these rules prevents mid-row table splits and orphaned headings. The rules are injected by the PDF generator to ensure they apply regardless of the document template's CSS.

**Alternatives**: Manual page break insertion based on content height (extremely complex, fragile), pre-paginating the HTML (reinventing the browser's layout engine), accepting natural breaks (violates FR-008).

## Decision 5: Filename Generation

**Decision**: Filename pattern: `{plan-name}_{document-type}_{date}.pdf`. Special characters are replaced by hyphens. Consecutive hyphens are collapsed. The plan name is truncated to 50 characters. The date is in `YYYY-MM-DD` format. Example: `Acme-Corp-Migration_text-document_2026-05-18.pdf`.

**Rationale**: FR-006 requires a meaningful filename. The pattern includes all three pieces of context a consultant needs: which plan, which document type, and when. Special character sanitization ensures the filename is valid on all operating systems (Windows, macOS, Linux). Truncation prevents excessively long filenames.

**Alternatives**: UUID-based filename (meaningless to the user), date-first format (harder to find in file explorer), include reference number for contractual docs (redundant -- it is in the document content).

## Decision 6: On-Demand Generation (No Storage)

**Decision**: PDFs are generated on every download request and streamed directly to the client. They are not stored in the database or on disk.

**Rationale**: FR-005 explicitly states on-demand generation, not pre-computed or stored permanently. The source of truth is the HTML content in `TextDocument` or `ContractualDocument`. Storing PDFs would create a synchronization problem (HTML changes but PDF is stale). If permanent PDF storage becomes necessary (e.g., for legal archival), it can be added as a separate feature.

**Alternatives**: Pre-generate and store on document creation (doubles storage, sync risk), cache with TTL (adds complexity, unclear invalidation), store on first download and serve cached (still a sync risk).

## Decision 7: Streaming Response

**Decision**: The PDF route handler generates the PDF as a Buffer, then returns it as a `Response` with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="..."`, and `Content-Length` headers. The browser handles the download natively.

**Rationale**: Streaming the PDF as a binary response with the correct headers triggers the browser's native file download dialog. No custom download manager is needed (per spec assumptions). The `Content-Length` header enables the browser's download progress indicator.

**Alternatives**: Base64 encode and send as JSON (wasteful, requires client-side decoding), generate a signed URL to cloud storage (requires storage -- contradicts Decision 6), WebSocket-based streaming (over-engineered).

## Decision 8: Error Handling When Puppeteer Fails

**Decision**: If Puppeteer/Chromium is unavailable (binary missing, launch failure, out of memory), the API returns a 503 Service Unavailable response with a JSON error body including a suggestion to use the browser's built-in print-to-PDF feature. The error is logged to the audit trail and to the console.

**Rationale**: FR-011 requires a clear error message and a fallback suggestion. 503 is the correct HTTP status for a temporarily unavailable service dependency. The browser print-to-PDF fallback works because the HTML document is already previewed in the application.

**Alternatives**: 500 Internal Server Error (less specific), retry with backoff (Chromium failures are usually not transient), client-side PDF generation via jsPDF (requires reimplementing the layout engine).
