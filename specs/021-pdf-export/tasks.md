# Tasks: PDF Export

**Input**: Design documents from `specs/021-pdf-export/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, contracts/

## Phase 1: Setup

- [ ] T001 [P] [US1] Install Puppeteer: `npm install puppeteer`. Verify Chromium download completes.
- [ ] T002 [P] [US1] Create types in `src/lib/services/pdf-export/types.ts`: `PdfOptions` (title, date, margins, pageSize), `PdfResult` (buffer, fileSize, pageCount).
- [ ] T003 [P] [US1] Create barrel export `src/lib/services/pdf-export/index.ts`.

---

## Phase 2: PDF Service (US1 -- core conversion)

**Goal**: Convert self-contained HTML to an A4 PDF buffer with headers, footers, and clean page breaks.

**Independent Test**: Pass a multi-page HTML string (tables, headings), get a PDF buffer with correct page size, headers on every page, footers with page numbers, no cut rows.

- [ ] T004 [US1] Implement PDF service in `src/lib/services/pdf-export/pdf-export.service.ts`: `generatePdf(htmlContent, options: PdfOptions): Promise<PdfResult>`. Launch Puppeteer, create page, set content, inject `break-inside: avoid` CSS for `<tr>` and headings, call `page.pdf()` with A4 format, margins (25/25/20/20mm), `headerTemplate` (title + date), `footerTemplate` (Page X of Y), `displayHeaderFooter: true`. Close browser. Return buffer + metadata. Handle Puppeteer launch failure with clear error. Log generation events.
- [ ] T005 [US1] Implement filename sanitizer in same file: `sanitizeFilename(planName, docType, date): string`. Replace special chars with hyphens, lowercase, pattern: `{plan-name}_{doc-type}_{date}.pdf`.
- [ ] T006 [US1] Write unit tests in `tests/unit/services/pdf-export/pdf-export.test.ts`: test PDF generation with sample HTML (verify buffer is non-empty, starts with %PDF), test filename sanitizer with special chars and Unicode, test Puppeteer failure produces clear error.

**Checkpoint**: PDF service converts HTML to PDF with correct formatting.

---

## Phase 3: API Route (US1 -- HTTP layer)

**Goal**: Serve PDF as a downloadable file from any stored document.

- [ ] T007 [US1] Implement GET route `src/app/api/plans/[planId]/documents/[documentId]/pdf/route.ts`: read `type` query param, load TextDocument or ContractualDocument by ID, extract htmlContent + plan name + generation date, call `generatePdf()`, stream response with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="..."`. Return 404 if document not found. Return 503 if Puppeteer fails. Log to audit trail.

**Checkpoint**: API route returns downloadable PDF.

---

## Phase 4: Download Button UI (US1 -- frontend)

**Goal**: Add "Download PDF" button to document preview pages.

- [ ] T008 [US1] Create download button component `src/components/documents/pdf-download-button.tsx`: accepts `documentId`, `planId`, `documentType` props. On click, calls GET `/api/plans/{planId}/documents/{documentId}/pdf?type={type}`, triggers browser download. Shows loading spinner during generation. Shows error toast if generation fails with fallback message.
- [ ] T009 [P] [US1] Integrate download button into text document preview page `src/app/plans/[planId]/documents/text/[documentId]/page.tsx`: add `PdfDownloadButton` above or beside the iframe.
- [ ] T010 [P] [US1] Integrate download button into contractual document preview page `src/app/plans/[planId]/documents/contractual/[documentId]/page.tsx`: add `PdfDownloadButton` above or beside the iframe.

**Checkpoint**: Consultant can download PDFs from both document types.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T003): No dependencies, start immediately
- **Phase 2** (T004-T006): Depends on T002 (types), T001 (Puppeteer installed)
- **Phase 3** (T007): Depends on T004 (PDF service); requires 019 or 020 implemented (documents in DB)
- **Phase 4** (T008-T010): Depends on T007 (API route); T009 and T010 can run in parallel

### Parallel Opportunities

- T001, T002, T003 can all run in parallel
- T009 and T010 can run in parallel (different files)
