# Implementation Plan: Migration Logic

**Branch**: `013-migration-logic` | **Date**: 2026-04-02 | **Spec**: `specs/013-transformation-rules/spec.md`

## Summary

Define migration logic for each field mapping via a type-dependent modal: D1 (Value Equivalence) for picklist-to-picklist, D2 (LLM Classification Prompt) for text-to-picklist, D3 (Incompatible Error) for impossible combinations, D4 (Informational Copy) for directly compatible types. Each section has a Save/Validate workflow that drives the color-coded link status (012). This feature was formerly "transformation-rules" but now encompasses all migration logic including validation-like concerns. Feature 014 (Validation Rules) was NOT merged here -- it remains separate in the roadmap.

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, @anthropic-ai/sdk (Claude API for D2), type-compatibility service (012)
**Storage**: SQLite via Prisma (MigrationLogic, ValueEquivalence, ClassificationPrompt tables)
**Testing**: Vitest (unit + integration)
**Target Platform**: Local-first web application (localhost)
**Project Type**: Web application (unified Next.js)
**Constraints**: D2 LLM classification examples must render within 5 seconds; LLM unavailability must not block the workflow

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved; paradigm shift documented |
| II | Readability | PASS | Type-specific sections (D1-D4) are separate components, each self-contained |
| III | Data fidelity | PASS | Every type combination has an explicit handler; D3 provides clear fallback for incompatible types |
| IV | Tests on real data | PASS | Tests with realistic picklist values (15+ values), real-shaped text data for D2 |
| V | Idempotence | PASS | Save/Validate overwrites existing logic; re-opening modal loads persisted state |
| VI | Traceability | PASS | All migration logic create/modify/validate operations logged to audit trail |
| VII | Observability | PASS | Console logs for LLM calls, compatibility lookups, save/validate actions |
| VIII | Modularity | PASS | Isolated behind MigrationLogicService; uses type-compatibility from 012; D1-D4 are independent components |

## Project Structure

### Documentation

```text
specs/013-transformation-rules/
├── plan.md
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
├── app/
│   └── api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]/
│       ├── migration-logic/
│       │   └── route.ts                            # GET, PUT (save/validate)
│       └── classify/
│           └── route.ts                            # POST (LLM classification preview)
├── components/mapping/
│   ├── MigrationLogicModal.tsx                     # C2: wrapper modal with source/dest header + action buttons
│   ├── ValueEquivalenceSection.tsx                 # D1: two-column value linking
│   ├── ClassificationPromptSection.tsx             # D2: prompt editor + example rows
│   ├── IncompatibleErrorSection.tsx                # D3: red-bordered error message
│   └── InformationalCopySection.tsx                # D4: grey-bordered info message
├── lib/
│   ├── services/migration-logic.ts                 # Domain logic: get, save, validate, delete
│   ├── services/classification.ts                  # LLM classification via Claude API
│   └── types/mapping.ts                            # Extended with MigrationLogic types
└── hooks/
    └── use-migration-logic.ts                      # React hook for modal state + save/validate

tests/
├── unit/services/migration-logic.test.ts
├── unit/services/classification.test.ts
└── integration/api/migration-logic.test.ts
```

**Structure Decision**: Migration logic API routes are nested under the field mapping (`fields/[fieldMappingId]/migration-logic/`). The LLM classification endpoint is separate (`classify/`) because it's a stateless preview operation. D1-D4 sections are individual components rendered conditionally by MigrationLogicModal.
