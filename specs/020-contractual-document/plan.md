# Implementation Plan: Contractual Document Generation

**Branch**: `020-contractual-document` | **Date**: 2026-05-18 | **Spec**: `specs/020-contractual-document/spec.md`

## Summary

Generate a formal contractual HTML document with signature block for client sign-off before migration execution. The document includes a unique reference number, scope section, correspondence tables per object mapping, a dedicated migration logic rules section, exclusions listing unmapped fields, filter tables, and a signature block. The layout is visually distinct from the text document (feature 019) with formal contractual styling.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, React 18+ (for preview component), Tailwind CSS, shadcn/ui
**Storage**: Neon Postgres (via Prisma) -- ContractualDocument table for immutable document storage
**Testing**: Vitest (unit for template rendering + reference number generation, integration for full pipeline), Playwright (E2E for preview)
**Target Platform**: Vercel (serverless Route Handlers)
**Project Type**: Full-stack (backend service + HTML template + UI preview component)
**Performance Goals**: Full generation in <30s for 50-field plan (SC), including LLM calls via feature 018
**Constraints**: Reference numbers globally unique; document immutable once persisted; formal layout distinct from text document

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 15 FRs + 12 acceptance scenarios |
| II | Readability | PASS | Standard HTML template with CSS; formal styling in dedicated stylesheet |
| III | Data fidelity | PASS | 100% of mappings, rules, filters included; unmapped fields listed under "Will NOT be migrated" (FR-007); broken mappings shown with warning flag; all sections always present (FR-014) |
| IV | Tests on real data | PASS | Integration tests use realistic 40-field plans with mixed rule types |
| V | Idempotence | PASS | Each generation creates a new immutable document with unique reference number |
| VI | Traceability | PASS | Document generation logged with reference number and stats (FR-012) |
| VII | Observability | PASS | Console logs for generation start, per-section progress, completion |
| VIII | Modularity | PASS | Isolated at `src/features/contractual-document/`; shares data loader pattern with 019 but independent template and service |
| IX | Human-in-the-loop | PASS | Document NOT auto-updated; consultant must explicitly regenerate; signature block is manual print-and-sign |

## Architecture

### Source Code Layout

```
src/
├── app/
│   └── api/
│       └── plans/[planId]/
│           └── documents/
│               └── contractual/
│                   ├── route.ts                      # POST (generate) + GET (list versions)
│                   └── [documentId]/
│                       └── route.ts                  # GET (single document HTML)
├── features/
│   └── contractual-document/
│       ├── components/
│       │   ├── contractual-document-preview.tsx       # HTML preview in iframe (formal styling)
│       │   ├── contractual-document-list.tsx          # List of generated versions
│       │   └── generate-contractual-button.tsx        # Generate button with loading
│       ├── services/
│       │   ├── contractual-document-service.ts        # Orchestrate generation pipeline
│       │   ├── contractual-document-loader.ts         # Load complete plan data (shared pattern with 019)
│       │   └── reference-number-generator.ts          # Generate CARBO-YYYYMMDD-XXXX reference numbers
│       ├── templates/
│       │   ├── contractual-document-template.ts       # HTML template function (plan data → HTML string)
│       │   └── contractual-document-styles.ts         # Formal contractual CSS
│       ├── hooks/
│       │   ├── use-contractual-documents.ts           # Fetch document list for a plan
│       │   └── use-contractual-document.ts            # Fetch single document
│       └── types.ts                                   # ContractualDocument types
prisma/
└── schema.prisma                                      # ContractualDocument model addition
tests/
├── unit/
│   └── contractual-document/
│       ├── contractual-document-template.test.ts
│       ├── reference-number-generator.test.ts
│       └── contractual-document-loader.test.ts
├── integration/
│   └── contractual-document/
│       └── contractual-document-generation.test.ts
└── fixtures/
    └── contractual-document/
        └── plan-fixtures.ts
```

### Key Dependencies Between Files

- `contractual-document-service.ts` → `contractual-document-loader.ts` + `generateDescriptions()` (from 018) + `contractual-document-template.ts` + `reference-number-generator.ts` + `audit.ts`
- `contractual-document-template.ts` → pure function (receives fully resolved data)
- `contractual-document-loader.ts` → Prisma (same pattern as 019 loader, loads plan + all relations)
- `reference-number-generator.ts` → Prisma (checks uniqueness of generated reference)

## Phases

### Phase 0: Research
See `research.md` -- decisions on reference numbers, formal layout, signature block, relationship with 019.

### Phase 1: Design
See `data-model.md` (Prisma schema addition), `contracts/api.md` (API routes).

### Phase 2: Implementation
See `tasks.md` -- ordered by: schema → loader → reference generator → template → service → API → UI → tests.

## Complexity Tracking

No constitution violations identified. Structure closely parallels feature 019 with distinct template and additional sections (scope, signature block, reference number).
