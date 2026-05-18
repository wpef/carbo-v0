# Tasks: PDF Export

**Input**: `specs/021-pdf-export/`
**Prerequisites**: 019-text-document, 020-contractual-document

---

## Phase 1: Dependencies & Types

**Purpose**: Install Puppeteer packages and create type definitions.

- [ ] T001 Install dependencies: `npm install puppeteer-core @sparticuz/chromium` and `npm install -D puppeteer` (devDependency for local Chromium binary). Verify `@sparticuz/chromium` resolves correctly in the project.
- [ ] T002 [P] Create `src/features/pdf-export/types.ts`: export `PdfGenerationInput`, `PdfGenerationResult`, `PdfPageOptions`, `PdfDownloadContext` per data-model.md.

**Checkpoint**: Packages installed, types compile.

---

## Phase 2: Chromium Setup

**Purpose**: Chromium binary resolver that works in both local development and Vercel production.

- [ ] T003 Create `src/features/pdf-export/lib/chromium.ts`. Export `getChromiumConfig(): Promise<{ executablePath: string; args: string[] }>`. Logic: if `process.env.NODE_ENV === 'production'`: import `@sparticuz/chromium`, call `chromium.executablePath()`, return with `chromium.args` (includes `--no-sandbox`, `--disable-gpu`, etc.). Else: check `process.env.CHROMIUM_PATH` first; if not set, try `require('puppeteer').executablePath()`; return with minimal args `['--no-sandbox']`. Console.log: "Chromium resolved: {path} ({env})" (Principle VII). Throw descriptive error if no Chromium binary found in any location.

**Checkpoint**: `getChromiumConfig()` returns a valid executable path in development. Module does not fail to import in production environment.

---

## Phase 3: PDF Generation Core

**Purpose**: Core PDF generator that converts HTML to PDF via Puppeteer.

- [ ] T004 Create `src/features/pdf-export/lib/pdf-options.ts`. Export `PDF_DEFAULTS: PdfPageOptions` with A4 format, margins (top: 25mm, bottom: 25mm, left: 20mm, right: 20mm), header template (document title left, generation date right, 9px Arial grey), footer template ("Page X sur Y" centered, 9px Arial grey), displayHeaderFooter: true, printBackground: true. Export `PAGE_BREAK_CSS` constant: CSS rules for graceful page breaks (table/tr page-break-inside: avoid, h2/h3 page-break-after: avoid, break-inside: avoid on table rows).
- [ ] T005 Create `src/features/pdf-export/services/pdf-generator.ts`. Implement `generatePdf(input: PdfGenerationInput): Promise<PdfGenerationResult>`. Steps: (1) call `getChromiumConfig()`, (2) launch `puppeteer-core` browser with headless: true and resolved config, (3) create new page, (4) set content to `input.htmlContent` with `waitUntil: 'networkidle0'`, (5) inject `PAGE_BREAK_CSS` via `page.addStyleTag()`, (6) generate PDF with `page.pdf()` using PDF_DEFAULTS, replacing title and date placeholders in header template with `input.title` and formatted `input.generatedAt`, (7) close browser, (8) measure generation time, (9) return `{ buffer, filename: input.filename, fileSizeBytes: buffer.length, generationTimeMs }`. Wrap in try/finally to ensure browser is always closed. Console.log: "PDF generated: {filename} ({fileSizeBytes} bytes) in {generationTimeMs}ms" (Principle VII). On Chromium launch failure: throw descriptive error with fallback suggestion.

**Checkpoint**: `generatePdf()` produces a valid PDF buffer from an HTML string. PDF has correct A4 dimensions, margins, headers, and footers.

---

## Phase 4: Filename Utility

**Purpose**: Generate sanitized, meaningful PDF filenames.

- [ ] T006 Create `src/features/pdf-export/lib/filename.ts`. Export `generatePdfFilename(planName: string, documentType: 'text-document' | 'contractual-document', generatedAt: string): string`. Logic: sanitize plan name (replace non-alphanumeric chars except hyphens with hyphens, collapse consecutive hyphens, trim leading/trailing hyphens, truncate to 50 chars), format date from ISO 8601 to YYYY-MM-DD, combine as `{sanitized-name}_{documentType}_{date}.pdf`. Handle empty plan name: use "document" as fallback.

**Checkpoint**: Filename generator produces valid, meaningful filenames for all edge cases.

---

## Phase 5: API Routes

**Purpose**: HTTP endpoints for downloading PDFs.

- [ ] T007 Create `src/app/api/plans/[planId]/documents/text/[documentId]/pdf/route.ts`. GET handler: (1) query TextDocument by documentId, verify planId match, return 404 if not found; (2) query plan name from MigrationPlan; (3) build `PdfGenerationInput` with htmlContent, title (plan name + "Document texte"), generatedAt, and sanitized filename; (4) call `generatePdf()`; (5) call `logAudit()` with action "PDF_GENERATED", entityType "TextDocument", details including fileSizeBytes and generationTimeMs; (6) return `Response` with PDF buffer, Content-Type `application/pdf`, Content-Disposition `attachment; filename="..."`, Content-Length. On Chromium failure: return 503 with fallback suggestion. On other errors: return 500.
- [ ] T008 [P] Create `src/app/api/plans/[planId]/documents/contractual/[documentId]/pdf/route.ts`. GET handler: same pattern as T007 but queries ContractualDocument, includes reference number in audit details, title includes "Document contractuel".

**Checkpoint**: Both PDF routes return downloadable PDFs. Correct Content-Type and Content-Disposition headers. 503 on Chromium failure with fallback suggestion.

---

## Phase 6: UI Components

**Purpose**: Download PDF button integrated into the documents page.

- [ ] T009 Create `src/features/pdf-export/components/download-pdf-button.tsx`. Props: `planId`, `documentId`, `documentType` ('text' | 'contractual'). On click: construct URL `/api/plans/{planId}/documents/{type}/{documentId}/pdf`, trigger browser download via `window.location.href` or `fetch` + `URL.createObjectURL` for progress tracking. Show loading spinner during generation (FR-009). On 503 error: show toast with fallback suggestion "Service PDF indisponible. Utilisez Ctrl+P sur la previsualisation HTML." On other errors: show generic error toast. Disabled when no document is selected.
- [ ] T010 Integrate download button into the documents page (`src/app/plans/[planId]/documents/page.tsx`). Add `<DownloadPdfButton>` next to each document in the text document list and contractual document list. Button label: "Telecharger PDF". Positioned inline with each document row or in the preview pane header.

**Checkpoint**: Consultant can download PDFs from the documents page. Loading indicator shown during generation. Error handling works for 503 and 500 responses.

---

## Phase 7: Tests

**Purpose**: Validate filename generation, PDF options, and full PDF generation pipeline.

- [ ] T011 Create `tests/unit/pdf-export/filename.test.ts`: test `generatePdfFilename` with: normal name, name with special characters, name with accented characters, empty name (fallback), very long name (truncation), name with only special characters. Verify date formatting from ISO 8601.
- [ ] T012 [P] Create `tests/unit/pdf-export/pdf-options.test.ts`: verify `PDF_DEFAULTS` has correct A4 dimensions, margins match FR-002 values, header template contains title and date placeholders, footer template contains pageNumber and totalPages classes, `PAGE_BREAK_CSS` contains page-break-inside: avoid for tables and headings.
- [ ] T013 Create `tests/integration/pdf-export/pdf-generation.test.ts`: generate a PDF from a realistic self-contained HTML document (~20 pages with tables and headings). Verify: result buffer is non-empty, starts with PDF magic bytes (`%PDF-`), fileSizeBytes matches buffer length, generationTimeMs is positive. If Chromium is available in CI: verify PDF has correct page count (approximate). Test with empty HTML: verify PDF is generated (single blank page). Test Chromium unavailable scenario (mock): verify descriptive error thrown.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately
- **T002**: No deps. Parallel with T001.
- **T003**: Depends on T001 (packages installed)
- **T004**: Depends on T002 (types)
- **T005**: Depends on T003 (Chromium config) + T004 (PDF options)
- **T006**: Depends on T002 (types)
- **T007, T008**: Depend on T005 (PDF generator) + T006 (filename). Parallel-safe.
- **T009**: Depends on T007/T008 (routes exist)
- **T010**: Depends on T009 (button component)
- **T011**: Depends on T006 (filename utility)
- **T012**: Depends on T004 (PDF options)
- **T013**: Depends on T005 (PDF generator)

### Parallel Opportunities

```
Phase 1: [T001 | T002] parallel
Phase 2: T003 (after T001)
Phase 3: T004 (after T002), T005 (after T003+T004)
Phase 4: T006 (after T002, parallel with Phase 3)
Phase 5: [T007 | T008] parallel (after T005+T006)
Phase 6: T009 (after T007+T008), then T010
Phase 7: [T011 | T012] parallel (after T004+T006), T013 (after T005)
```

### FR Coverage

| FR | Task(s) | Phase |
|----|---------|-------|
| FR-001 (Accept HTML, produce PDF) | T005, T007, T008 | 3, 5 |
| FR-002 (A4 format + margins) | T004 | 3 |
| FR-003 (Header on every page) | T004, T005 | 3 |
| FR-004 (Footer with page numbers) | T004, T005 | 3 |
| FR-005 (On-demand generation) | T005, T007, T008 | 3, 5 |
| FR-006 (Meaningful filename) | T006, T007, T008 | 4, 5 |
| FR-007 (Puppeteer for PDF) | T001, T003, T005 | 1, 2, 3 |
| FR-008 (Graceful page breaks) | T004, T005 | 3 |
| FR-009 (Loading indicator) | T009 | 6 |
| FR-010 (Audit trail) | T007, T008 | 5 |
| FR-011 (Puppeteer fallback message) | T007, T008, T009 | 5, 6 |
