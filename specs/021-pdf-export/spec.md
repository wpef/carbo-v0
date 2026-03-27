# Feature Specification: PDF Export

**Feature**: 021-pdf-export
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 019-text-document or 020-contractual-document

## User Story (atomic)

As a consultant, I can download any generated document as a professional PDF, so that I can share a polished, print-ready file with my client for review, archival, or signature.

**Independent Test**: A consultant has a generated text document (from feature 017) and a generated contractual document (from feature 018). The consultant clicks "Download PDF" on the text document and receives an A4 PDF file with margins, a header showing the document title and generation date, a footer showing page numbers, and content matching the HTML preview. The consultant then downloads the contractual document as PDF and verifies the same formatting standards apply.

**Acceptance Scenarios**:

1. **Given** a generated text document (feature 017), **When** the consultant clicks "Download PDF", **Then** an A4 PDF is generated from the document's HTML content and downloaded to the consultant's device.
2. **Given** a generated contractual document (feature 018), **When** the consultant clicks "Download PDF", **Then** an A4 PDF is generated from the document's HTML content and downloaded to the consultant's device.
3. **Given** a PDF being generated, **When** the PDF is rendered, **Then** it uses A4 page size with standard margins (top: 25mm, bottom: 25mm, left: 20mm, right: 20mm).
4. **Given** a PDF being generated, **When** the header is rendered, **Then** it contains the document title (plan name + document type) and the generation date, displayed on every page.
5. **Given** a PDF being generated, **When** the footer is rendered, **Then** it contains the page number in the format "Page X of Y", displayed on every page.
6. **Given** a multi-page document, **When** the PDF is generated, **Then** tables and sections break cleanly across pages without cutting rows or headings mid-page.
7. **Given** a generated PDF, **When** the file is downloaded, **Then** the filename follows a meaningful pattern: `{plan-name}_{document-type}_{date}.pdf` (e.g., `Acme-Migration_text-document_2026-03-25.pdf`), with special characters sanitized.
8. **Given** a document that has not been generated yet, **When** the consultant attempts to download a PDF, **Then** the system displays a message indicating that the document must be generated first.
9. **Given** the PDF generation in progress, **When** the consultant waits, **Then** a loading indicator is displayed. The PDF is generated on-demand (not pre-computed) when the download is requested.

## Edge Cases

- A generated document has very large content (200+ field mappings, 50+ pages): the PDF is generated completely without truncation, though generation may take longer. A progress indicator is shown.
- The document HTML contains special characters or Unicode: the PDF renders all characters correctly using a font that supports Unicode.
- The Puppeteer dependency is not installed or fails to launch: the system displays a clear error message to the consultant and logs the failure. The HTML document remains available for manual browser printing.
- The generated PDF exceeds a reasonable file size (>50MB): this is an unexpected case — the system logs a warning but does not block the download.
- The consultant requests PDF download while another PDF is being generated for the same document: the system queues the request or returns the in-progress result, not a corrupted file.
- A document references broken mappings with warning flags: the warning styling is preserved in the PDF.

## Functional Requirements

- **FR-001**: The system MUST accept HTML content from any generated document (text document from feature 017 or contractual document from feature 018) and produce a PDF.
- **FR-002**: The PDF MUST use A4 page format (210mm x 297mm) with margins: top 25mm, bottom 25mm, left 20mm, right 20mm.
- **FR-003**: The PDF MUST include a header on every page containing the document title and generation date.
- **FR-004**: The PDF MUST include a footer on every page containing the page number in "Page X of Y" format.
- **FR-005**: The PDF MUST be generated on-demand when the consultant requests a download — not pre-computed or stored permanently.
- **FR-006**: The PDF MUST be downloaded as a file with a meaningful filename following the pattern `{plan-name}_{document-type}_{date}.pdf`, with special characters replaced by hyphens.
- **FR-007**: The system MUST use Puppeteer for HTML-to-PDF conversion, as specified in the constitution's technology standards.
- **FR-008**: The system MUST handle page breaks gracefully: table rows and section headings MUST NOT be split across pages.
- **FR-009**: The system MUST display a loading indicator during PDF generation.
- **FR-010**: The system MUST log PDF generation events (start, completion, error, file size) to the audit trail (Constitution Principle VI).
- **FR-011**: If Puppeteer is unavailable or fails, the system MUST display a clear error and suggest the consultant use the browser's built-in print-to-PDF as a fallback. The HTML preview MUST remain accessible.

## Key Entities

This feature does not introduce new persistent entities. PDFs are generated on-demand and not stored in the database. The source of truth is the HTML content stored in the TextDocument or ContractualDocument entity.

## Success Criteria

- A PDF is generated from a 20-page HTML document in under 15 seconds.
- The PDF content matches the HTML preview with no missing content, no truncation, and no layout corruption.
- Headers (title + date) and footers (page numbers) appear on every page.
- The downloaded filename is meaningful and correctly formatted.
- All PDF generation events are traceable in the audit trail.

## Assumptions

- Puppeteer is the PDF generation tool, as specified in the constitution.
- Puppeteer runs server-side in the Next.js backend (Route Handler).
- PDFs are not stored permanently — they are generated on each download request. If storage becomes necessary (e.g., for audit purposes), it will be added as a separate feature.
- The HTML content is self-contained (inline CSS or embedded styles) so that Puppeteer can render it without external dependencies.
- The consultant's browser handles the file download natively (no custom download manager needed).
