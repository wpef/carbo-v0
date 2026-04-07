# Implementation Plan: Migration Plan

**Branch**: `001-migration-plan` | **Date**: 2026-04-02 | **Spec**: `specs/001-migration-plan/spec.md`

## Summary

Implement CRUD for Migration Plans — the top-level container for the entire migration workflow. This includes the Prisma data model, API route handlers, a plan list home page, a plan detail page with vertical step workflow, and cascade deletion. Every plan operation is logged to an audit trail.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14+ (App Router), Prisma ORM, Tailwind CSS, shadcn/ui
**Storage**: SQLite via Prisma ORM (local-first)
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js web application (localhost for v0)
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: Plan list loads < 1s; CRUD operations < 500ms
**Constraints**: All features are scoped to a plan. No content exists outside a plan context.
**Scale/Scope**: ~50 plans max in v0 (local-first, single consultant)

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Standard Next.js patterns: route handlers, server components, Prisma queries |
| III | Data fidelity | PASS | Cascade delete ensures no orphaned data; status transitions are explicit |
| IV | Tests on real data | PASS | Integration tests with realistic plan data (names, descriptions, multiple plans) |
| V | Idempotence | PASS | Creating a plan with the same name produces a new UUID — no conflicts. Deletion is idempotent (404 if already deleted). |
| VI | Traceability | PASS | All plan operations (create, delete, status change) logged to AuditLog table |
| VII | Observability | PASS | Console logs for plan operations; Prisma query logging in dev |
| VIII | Modularity | PASS | Plan module exposes types + service; downstream features import only the plan ID |

## Project Structure

### Documentation (this feature)

```text
specs/001-migration-plan/
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
prisma/
├── schema.prisma                          # MigrationPlan + AuditLog models

src/
├── app/
│   ├── page.tsx                           # Home page — plan list
│   ├── layout.tsx                         # Root layout (modify existing)
│   ├── plans/
│   │   └── [planId]/
│   │       └── page.tsx                   # Plan detail — step workflow
│   └── api/
│       └── plans/
│           ├── route.ts                   # GET (list), POST (create)
│           └── [planId]/
│               └── route.ts              # GET (detail), DELETE
├── components/
│   └── plans/
│       ├── plan-list.tsx                  # Plan list component
│       ├── plan-card.tsx                  # Single plan card
│       ├── create-plan-dialog.tsx         # Creation form dialog
│       ├── step-workflow.tsx              # Vertical step indicator
│       └── delete-plan-dialog.tsx         # Delete confirmation dialog
├── lib/
│   ├── db/
│   │   └── prisma.ts                     # Prisma client singleton
│   ├── services/
│   │   ├── plan-service.ts               # Plan CRUD business logic
│   │   └── audit-service.ts              # Audit trail logging
│   └── types/
│       └── plan.ts                       # Plan-specific TypeScript types
└── hooks/
    └── use-plans.ts                       # Client-side plan data fetching

tests/
├── unit/
│   └── services/
│       └── plan-service.test.ts
└── integration/
    └── api/
        └── plans.test.ts
```

**Structure Decision**: Standard Next.js App Router layout. Plan pages under `app/plans/[planId]`. API routes mirror the page structure. Business logic in `lib/services/`. Prisma client singleton in `lib/db/`.
