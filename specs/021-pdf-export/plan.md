# Implementation Plan: PDF Export

**Branch**: `021-pdf-export` | **Date**: 2026-05-18 | **Spec**: `specs/021-pdf-export/spec.md`

## Summary

Export any generated document (text from feature 019, contractual from feature 020) as a professional A4 PDF. Uses Puppeteer with `@sparticuz/chromium` for serverless-compatible HTML-to-PDF conversion on Vercel. PDFs are generated on-demand (not stored permanently), include headers (title + date) and footers (page numbers) on every page, handle page breaks gracefully, and are downloaded with meaningful filenames.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: puppeteer-core, @sparticuz/chromium (serverless Chromium binary), Prisma ORM (to read document HTML)
**Storage**: No new database tables -- PDFs are generated on-demand and streamed to the client
**Testing**: Vitest (unit for filename sanitization + PDF options), integration (full PDF generation against real Puppeteer)
**Target Platform**: Vercel (serverless Route Handlers -- `@sparticuz/chromium` provides a Lambda-compatible Chromium binary)
**Project Type**: Backend service (Route Handler generating binary PDF response) + UI download button
**Performance Goals**: PDF from 20-page HTML in <15s (SC)
**Constraints**: Vercel serverless function size limit (~50MB with `@sparticuz/chromium`); no permanent PDF storage; HTML must be self-contained

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 11 FRs + 9 acceptance scenarios |
| II | Readability | PASS | Single PDF generation utility; standard Puppeteer API usage |
| III | Data fidelity | PASS | PDF content matches HTML preview -- no transformation, no truncation |
| IV | Tests on real data | PASS | Integration tests generate PDFs from realistic 20-page HTML documents |
| V | Idempotence | PASS | Same HTML input always produces equivalent PDF output; on-demand generation is inherently idempotent |
| VI | Traceability | PASS | PDF generation events logged to audit trail with file size and latency (FR-010) |
| VII | Observability | PASS | Console logs for Chromium launch, page load, PDF render, and total generation time |
| VIII | Modularity | PASS | Isolated at `src/features/pdf-export/`; consumes document HTML from 019/020 via Prisma query |
| IX | Human-in-the-loop | N/A | No automated decisions -- consultant explicitly triggers download |

## Architecture

### Source Code Layout

```
src/
├── app/
│   └── api/
│       └── plans/[planId]/
│           └── documents/
│               ├── text/[documentId]/
│               │   └── pdf/route.ts                  # GET → download text document PDF
│               └── contractual/[documentId]/
│                   └── pdf/route.ts                  # GET → download contractual document PDF
├── features/
│   └── pdf-export/
│       ├── services/
│       │   └── pdf-generator.ts                      # Core: HTML → PDF via Puppeteer
│       ├── lib/
│       │   ├── chromium.ts                           # Chromium binary resolver (local vs serverless)
│       │   ├── pdf-options.ts                        # A4 format, margins, header/footer templates
│       │   └── filename.ts                           # Filename sanitization and formatting
│       ├── components/
│       │   └── download-pdf-button.tsx               # Download button with loading indicator
│       └── types.ts                                  # PdfGenerationInput, PdfGenerationResult
tests/
├── unit/
│   └── pdf-export/
│       ├── filename.test.ts
│       └── pdf-options.test.ts
└── integration/
    └── pdf-export/
        └── pdf-generation.test.ts
```

### Key Dependencies Between Files

- `pdf/route.ts` → fetches document HTML from Prisma → calls `generatePdf()` → streams response
- `pdf-generator.ts` → `chromium.ts` (Chromium binary) + `pdf-options.ts` (page setup)
- `chromium.ts` → `@sparticuz/chromium` (serverless) or local Chromium path (development)
- `download-pdf-button.tsx` → triggers `GET .../pdf` and handles browser file download

## Phases

### Phase 0: Research
See `research.md` -- decisions on Puppeteer setup, serverless Chromium, header/footer rendering.

### Phase 1: Design
See `data-model.md` (no new models -- type definitions only), `contracts/api.md` (PDF download routes).

### Phase 2: Implementation
See `tasks.md` -- ordered by: Chromium setup → PDF generator → filename util → API routes → UI button → tests.

## Complexity Tracking

**@sparticuz/chromium bundle size**: The `@sparticuz/chromium` package adds ~45MB to the serverless function. This is within Vercel's 50MB limit for the Route Handler. The Chromium binary is loaded lazily (only when a PDF is requested). If the bundle size becomes a problem, the PDF route can be moved to a separate Vercel function with higher limits.

No constitution violations identified.
