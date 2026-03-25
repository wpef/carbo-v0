# Implementation Plan: Client Documents

**Branch**: `004-client-documents` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-client-documents/spec.md`

## Summary

Build the document generation feature: produce a natural language text document and a structured
contractual document from a mapping plan. Uses Claude API for translating complex rules (JS
functions, regex) into plain language. HTML preview in-app + PDF export via Puppeteer. This is
the final feature of Phase 1 — it completes the consultant's workflow from connection to client
validation.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14+ App Router) — established in 001
**Primary Dependencies**: Next.js, Prisma, @anthropic-ai/sdk (Claude API), Puppeteer (HTML→PDF)
**Storage**: SQLite via Prisma (established in 001)
**Testing**: Vitest, Playwright — established in 001
**Target Platform**: Web browser (localhost)
**Project Type**: Web application (single Next.js project)
**Performance Goals**: 50-field document generation <30s; PDF export <10s
**Constraints**: No document editing in v0; Claude API required for complex rule descriptions
**Scale/Scope**: Documents for plans up to 5 object mappings, 200+ field mappings

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Spec-First | PASS | spec.md completed with clarifications |
| II | Readability over cleverness | PASS | Standard template approach + Claude API for natural language |
| III | Data fidelity | PASS | FR-004 requires 100% of unmapped fields in documents; FR-010 flags broken mappings |
| IV | Functional tests on real data | PASS | Fixtures with realistic mapping plans to validate document completeness |
| V | Idempotence | PASS | Same mapping plan → same document (deterministic templates + seeded LLM calls) |
| VI | Traceability by default | PASS | FR-009 logs all generation events; documents linked to audit trail |
| VII | Developer observability | PASS | Console logging on generation steps, LLM calls, PDF export |

## Project Structure

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   └── documents/
│   │       ├── generate/route.ts                # POST — generate document
│   │       └── [documentId]/
│   │           ├── route.ts                     # GET — retrieve document HTML
│   │           └── pdf/route.ts                 # GET — download PDF
│   ├── documents/
│   │   ├── page.tsx                             # Document list page
│   │   └── [documentId]/
│   │       ├── page.tsx                         # Document preview page
│   │       └── components/
│   │           ├── document-preview.tsx          # HTML document viewer
│   │           ├── download-button.tsx           # PDF download trigger
│   │           └── generation-status.tsx         # Progress indicator during generation
├── lib/
│   └── documents/
│       ├── text-generator.ts                    # Text document generation logic
│       ├── contractual-generator.ts             # Contractual document generation logic
│       ├── rule-describer.ts                    # Transform rules → natural language (templates + LLM)
│       ├── pdf-exporter.ts                      # HTML → PDF via Puppeteer
│       ├── templates/
│       │   ├── text-document.html               # HTML template for text document
│       │   └── contractual-document.html        # HTML template for contractual document
│       └── types.ts                             # Document-specific types

tests/
├── unit/
│   └── documents/
│       ├── rule-describer.test.ts
│       └── text-generator.test.ts
└── fixtures/
    └── documents/
        └── sample-mapping-plan.json             # Realistic plan for document generation testing
```

**Structure Decision**: Documents are a new domain — `lib/documents/` for generation logic,
`app/documents/` for UI, `app/api/documents/` for API routes. HTML templates live in
`lib/documents/templates/` as standalone files that can be easily modified.

## Complexity Tracking

| Consideration | Note |
|---------------|------|
| Claude API dependency | Required for natural language descriptions of JS functions and regex. Fallback: show raw code if API unavailable. Not a constitution violation — it's a justified external dependency. |
| Puppeteer for PDF | Server-side headless browser for HTML→PDF. Heavier than a pure library but produces consistent, professional PDFs. Alternative (jsPDF) rejected — poor HTML rendering. |
