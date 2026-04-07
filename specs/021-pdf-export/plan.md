# Implementation Plan: PDF Export

**Branch**: `021-pdf-export` | **Date**: 2026-04-02 | **Spec**: `specs/021-pdf-export/spec.md`

## Summary

Convert generated HTML documents (text or contractual) to downloadable A4 PDFs using Puppeteer. PDFs are generated on-demand (not stored), with headers (title + date), footers (page numbers), and clean page breaks. A single API route accepts any document's HTML and returns a PDF stream. The frontend provides a "Download PDF" button on document preview pages.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Puppeteer (HTML to PDF)
**Storage**: None (PDFs are generated on-demand, not persisted)
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js 14+ (App Router), Node.js
**Project Type**: Utility service + API route + UI button within monolithic Next.js project
**Performance Goals**: PDF generation <15s for a 20-page document
**Constraints**: Puppeteer runs server-side only; HTML must be self-contained; graceful fallback if Puppeteer unavailable
**Scale/Scope**: 1 service file, 1 API route, 1 React component (download button), unit tests

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Single service with clear function: HTML in, PDF buffer out |
| III | Data fidelity | PASS | PDF content matches HTML exactly -- no transformation or omission |
| IV | Tests on real data | PASS | Tests use realistic multi-page HTML with tables, headers, footers |
| V | Idempotence | PASS | Same HTML always produces structurally identical PDF |
| VI | Traceability | PASS | PDF generation events logged (start, completion, error, file size) |
| VII | Observability | PASS | Console logs for Puppeteer launch, render duration, PDF size |
| VIII | Modularity | PASS | Stateless service; accepts HTML string, returns PDF buffer; no dependency on 019/020 internals |

## Project Structure

### Documentation (this feature)

```text
specs/021-pdf-export/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (no Prisma entities)
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
├── lib/
│   └── services/
│       └── pdf-export/
│           ├── index.ts              # Public barrel export
│           ├── pdf-export.service.ts  # Puppeteer HTML->PDF conversion
│           └── types.ts              # PdfOptions, PdfResult
│
├── app/
│   └── api/
│       └── plans/
│           └── [planId]/
│               └── documents/
│                   └── [documentId]/
│                       └── pdf/
│                           └── route.ts  # GET: generate + stream PDF
│
└── components/
    └── documents/
        └── pdf-download-button.tsx       # "Download PDF" button with loading state

tests/
└── unit/
    └── services/
        └── pdf-export/
            └── pdf-export.test.ts        # PDF generation, headers, footers, fallback
```

**Structure Decision**: Service in `src/lib/services/pdf-export/` with a single service file. The API route is nested under a specific document ID since PDFs are generated from a specific document version. The download button component is reusable across text and contractual document previews.
