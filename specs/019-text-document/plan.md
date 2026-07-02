# Implementation Plan: Text Document Generation

**Branch**: `019-text-document` | **Date**: 2026-05-18 | **Spec**: `specs/019-text-document/spec.md`

## Summary

Generate a human-readable HTML document that describes an entire migration plan for client review. The document includes a summary section, per-object mapping sections with field mapping tables, migration logic rule descriptions (from feature 018), migration filter descriptions, and unmapped fields warnings. The document is immutable once created, previewed as HTML in the application, and carries a `status` field (`CURRENT` / `OUTDATED`) for reconfiguration awareness.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, React 18+ (for preview component), Tailwind CSS, shadcn/ui
**Storage**: Neon Postgres (via Prisma) -- TextDocument table for immutable document storage
**Testing**: Vitest (unit for template rendering, integration for full generation pipeline), Playwright (E2E for preview)
**Target Platform**: Vercel (serverless Route Handlers)
**Project Type**: Full-stack (backend service + HTML template + UI preview component)
**Performance Goals**: Full generation in <30s for 50-field plan (SC), including LLM calls via feature 018
**Constraints**: HTML template is server-side (not a React component); document is immutable once persisted

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 13 FRs + 9 acceptance scenarios |
| II | Readability | PASS | Standard HTML template with CSS; no framework magic |
| III | Data fidelity | PASS | 100% of mappings, rules, unmapped fields, and filters appear in document. Unmapped fields explicitly warned (FR-007). Broken mappings shown with warning flag. |
| IV | Tests on real data | PASS | Integration tests use realistic 20+ field migration plans with mixed rule types |
| V | Idempotence | PASS | Each generation creates a new immutable document version; re-generation is safe |
| VI | Traceability | PASS | Document generation events logged to audit trail with stats (FR-011) |
| VII | Observability | PASS | Console logs for generation start, per-object progress, completion with stats |
| VIII | Modularity | PASS | Isolated at `src/features/text-document/`; consumes 018 via service import |
| IX | Human-in-the-loop | PASS | Document is NOT auto-updated when plan changes; consultant must explicitly regenerate (FR-008) |

## Architecture

### Source Code Layout

```
src/
├── app/
│   ├── plans/[planId]/documents/
│   │   └── page.tsx                              # Documents page (lists text + contractual docs)
│   └── api/
│       └── plans/[planId]/
│           └── documents/
│               └── text/
│                   ├── route.ts                  # POST (generate) + GET (list versions)
│                   └── [documentId]/
│                       └── route.ts              # GET (single document HTML)
├── features/
│   └── text-document/
│       ├── components/
│       │   ├── text-document-preview.tsx          # HTML preview in iframe
│       │   ├── text-document-list.tsx             # List of generated versions
│       │   ├── generate-button.tsx                # Generate / Regenerate button with loading
│       │   └── generation-stats.tsx               # Stats display (fields, rules, unmapped, LLM calls)
│       ├── services/
│       │   ├── text-document-service.ts           # Orchestrate generation: load plan → get descriptions → render template → persist
│       │   └── text-document-loader.ts            # Load complete plan data for template rendering
│       ├── templates/
│       │   └── text-document-template.ts          # HTML template function (plan data → HTML string)
│       ├── hooks/
│       │   ├── use-text-documents.ts              # Fetch document list for a plan
│       │   └── use-text-document.ts               # Fetch single document
│       └── types.ts                               # TextDocument, GenerationStats, etc.
prisma/
└── schema.prisma                                  # TextDocument model addition
tests/
├── unit/
│   └── text-document/
│       ├── text-document-template.test.ts
│       └── text-document-loader.test.ts
├── integration/
│   └── text-document/
│       └── text-document-generation.test.ts
└── fixtures/
    └── text-document/
        └── plan-fixtures.ts                       # Realistic plan data for template testing
```

### Key Dependencies Between Files

- `text-document-service.ts` → `text-document-loader.ts` + `generateDescriptions()` (from 018) + `text-document-template.ts` + `audit.ts`
- `text-document-template.ts` → pure function, no imports (receives fully resolved data)
- `text-document-loader.ts` → Prisma (loads plan + object mappings + field mappings + migration logic + filters + unmapped fields)
- `text-document-preview.tsx` → `use-text-document.ts` (fetches HTML content)

## Phases

### Phase 0: Research
See `research.md` -- decisions on template engine, HTML structure, preview approach.

### Phase 1: Design
See `data-model.md` (Prisma schema addition), `contracts/api.md` (API routes).

### Phase 2: Implementation
See `tasks.md` -- ordered by: schema → loader → template → service → API → UI → tests.

## Complexity Tracking

No constitution violations identified. The template is a pure function; the service orchestrates existing components (Prisma queries + feature 018 + template rendering).
