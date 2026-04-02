# Implementation Plan: Text Document Generation

**Branch**: `019-text-document` | **Date**: 2026-04-02 | **Spec**: `specs/019-text-document/spec.md`

## Summary

Generate an immutable HTML document that describes an entire mapping plan in plain language for client review. The document is assembled server-side from a plan's object mappings, field mappings, migration logic descriptions (via 018), unmapped fields (via 016), and migration filters. Each generation creates a new immutable version stored in the database. The HTML is previewed in-app via an iframe.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Feature 018 (rule-description service), Feature 016 (unmapped fields)
**Storage**: SQLite via Prisma -- new `TextDocument` entity
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js 14+ (App Router), Node.js
**Project Type**: Domain service + API route + preview component within monolithic Next.js project
**Performance Goals**: Generation <30s for 50-field plan (including LLM calls)
**Constraints**: HTML template is server-side (not React); document is immutable once created
**Scale/Scope**: 1 service, 1 template builder, 1 API route, 1 React preview component, 1 Prisma model

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Template builder uses explicit section functions; no complex abstractions |
| III | Data fidelity | PASS | All fields, rules, unmapped fields included -- no omissions; unmapped fields section with explicit warning |
| IV | Tests on real data | PASS | Tests use realistic plan with multiple objects, 15+ fields, mixed rules |
| V | Idempotence | PASS | Each generation creates a new immutable document; no update/overwrite |
| VI | Traceability | PASS | Generation events (start, completion, error) logged to audit trail |
| VII | Observability | PASS | Console logs for generation progress: loading data, calling rule engine, building HTML |
| VIII | Modularity | PASS | Service consumes 018 via public interface; owns its template; preview component is self-contained |

## Project Structure

### Documentation (this feature)

```text
specs/019-text-document/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md
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
│       └── text-document/
│           ├── index.ts                    # Public barrel export
│           ├── text-document.service.ts    # Orchestrates: load data -> describe rules -> build HTML -> persist
│           ├── template-builder.ts         # Builds HTML string from structured data (summary, objects, fields, rules, unmapped, filters)
│           └── types.ts                    # TextDocumentData, GenerationStats
│
├── app/
│   ├── api/
│   │   └── plans/
│   │       └── [planId]/
│   │           └── documents/
│   │               └── text/
│   │                   └── route.ts        # POST: generate, GET: list versions
│   │
│   └── plans/
│       └── [planId]/
│           └── documents/
│               └── text/
│                   └── [documentId]/
│                       └── page.tsx        # Preview page with iframe
│
└── components/
    └── documents/
        └── text-document-preview.tsx       # iframe-based HTML preview component

prisma/
└── schema.prisma                           # TextDocument model (added to existing schema)

tests/
├── unit/
│   └── services/
│       └── text-document/
│           ├── template-builder.test.ts    # HTML output for each section type
│           └── service.test.ts             # Full generation flow with mocked deps
└── integration/
    └── text-document.test.ts               # Seeded plan -> generate -> verify stored HTML
```

**Structure Decision**: Service in `src/lib/services/text-document/` with template builder separated from orchestration. The HTML template is built via string concatenation (no template engine needed). Preview uses a Next.js page with an iframe.
