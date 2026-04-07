# Implementation Plan: Contractual Document Generation

**Branch**: `020-contractual-document` | **Date**: 2026-04-02 | **Spec**: `specs/020-contractual-document/spec.md`

## Summary

Generate an immutable formal contractual HTML document with signature block for client sign-off. Structurally similar to 019 (text document) but with distinct formal styling, dedicated sections for scope/correspondence/transformation rules/validation rules/exclusions/filters/signature, and a unique document reference number. Shares the same Rule Description Engine (018) and unmapped fields data (016) as dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Feature 018 (rule-description service), Feature 016 (unmapped fields)
**Storage**: SQLite via Prisma -- new `ContractualDocument` entity
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js 14+ (App Router), Node.js
**Project Type**: Domain service + API route + preview component within monolithic Next.js project
**Performance Goals**: Generation <30s for 50-field plan (including LLM calls)
**Constraints**: HTML template is server-side; document is immutable; reference number must be globally unique
**Scale/Scope**: 1 service, 1 template builder, 1 API route, 1 React preview component, 1 Prisma model

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Template builder mirrors 019 structure with explicit section functions |
| III | Data fidelity | PASS | All sections always present (even if empty); exclusions section lists every unmapped field |
| IV | Tests on real data | PASS | Tests use realistic plan with 3 objects, 40 fields, mixed rules |
| V | Idempotence | PASS | Each generation creates a new immutable document with unique reference |
| VI | Traceability | PASS | Generation events logged with plan ID, document type, reference number |
| VII | Observability | PASS | Console logs for generation progress |
| VIII | Modularity | PASS | Parallel to 019; shares 018 interface; own template/service/model |

## Project Structure

### Documentation (this feature)

```text
specs/020-contractual-document/
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
│       └── contractual-document/
│           ├── index.ts                          # Public barrel export
│           ├── contractual-document.service.ts   # Orchestrates: load -> describe -> build -> persist
│           ├── template-builder.ts               # Builds formal HTML: header, scope, correspondence, rules, exclusions, filters, signature
│           ├── reference-generator.ts            # Generates unique CARBO-YYYYMMDD-XXXX reference numbers
│           └── types.ts                          # ContractualDocumentData, ScopeData, SignatureBlockData
│
├── app/
│   ├── api/
│   │   └── plans/
│   │       └── [planId]/
│   │           └── documents/
│   │               └── contractual/
│   │                   └── route.ts              # POST: generate, GET: list versions
│   │
│   └── plans/
│       └── [planId]/
│           └── documents/
│               └── contractual/
│                   └── [documentId]/
│                       └── page.tsx              # Preview page with iframe
│
└── components/
    └── documents/
        └── contractual-document-preview.tsx      # iframe-based preview (formal styling)

prisma/
└── schema.prisma                                 # ContractualDocument model

tests/
├── unit/
│   └── services/
│       └── contractual-document/
│           ├── template-builder.test.ts          # HTML sections correctness
│           ├── reference-generator.test.ts       # Uniqueness, format validation
│           └── service.test.ts                   # Full generation flow
└── integration/
    └── contractual-document.test.ts              # Seeded plan -> generate -> verify
```

**Structure Decision**: Mirrors 019 structure. Separate `reference-generator.ts` for the unique document reference logic. Template builder has more sections than 019 (scope, correspondence, transformation rules, validation rules, exclusions, filters, signature).
