# Implementation Plan: Migration Plan

**Branch**: `001-migration-plan` | **Date**: 2026-05-18 | **Spec**: `specs/001-migration-plan/spec.md`

## Summary

The Migration Plan is the top-level container for an entire migration project. It provides CRUD operations (create, list, delete), a step-by-step workflow (Source → Destination → Object Mapping → Field Mapping → Documents), a persistent layout with sidebar and header, and plan-level drift detection that fires once per "plan visit" to alert the consultant of schema changes. This is the first feature with a database, UI, and API routes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, Tailwind CSS, shadcn/ui, React 18+
**Storage**: Neon Postgres (via Prisma) — MigrationPlan + AuditLog tables
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: Plan list loads in <1s (SC-002), CRUD in <30s user time (SC-001)
**Constraints**: DB-per-tenant (Neon), cascade-delete must remove 100% associated data (SC-003)
**Scale/Scope**: Tens of plans per consultant, 5 workflow steps per plan

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 16 FRs + 9 acceptance scenarios |
| II | Readability | PASS | Standard Next.js App Router patterns; no custom abstractions |
| III | Data fidelity | PASS | Cascade-delete guarantees no orphaned data (FR-003); drift detection preserves mapping decisions |
| IV | Tests on real data | PASS | Integration tests target real Postgres (Neon branch or Docker); Playwright E2E for CRUD |
| V | Idempotence | PASS | Plan creation is not idempotent (UUID per creation); delete is idempotent (cascade) |
| VI | Traceability | PASS | All plan operations logged to AuditLog (FR-006) |
| VII | Observability | PASS | Console logs for CRUD operations, step advancement, drift detection |
| VIII | Modularity | PASS | Plan module isolated at `src/features/plans/`; public interface via types + service exports |
| IX | Human-in-the-loop | PASS | Drift banner is non-blocking (FR-011); no auto-remediation of broken mappings; `objectAutoLinkedAt` gates auto-link to first-time only |

## Architecture

### Source Code Layout

```
src/
├── app/
│   ├── page.tsx                              # Home page (plan list)
│   ├── plans/
│   │   ├── new/page.tsx                      # Plan creation form
│   │   └── [planId]/
│   │       ├── layout.tsx                    # Persistent layout (header + sidebar + main)
│   │       └── page.tsx                      # Plan detail (metadata + current step CTA)
├── features/
│   └── plans/
│       ├── components/
│       │   ├── plan-list.tsx                 # Home page plan list
│       │   ├── plan-card.tsx                 # Single plan card in list
│       │   ├── plan-form.tsx                 # Create plan form
│       │   ├── plan-header.tsx               # Persistent header (FR-007, FR-009)
│       │   ├── step-sidebar.tsx              # Workflow sidebar (FR-004, FR-008)
│       │   ├── drift-banner.tsx              # Drift detection banner (FR-010 to FR-016)
│       │   └── drift-badge.tsx               # Sidebar severity badge (FR-014)
│       ├── hooks/
│       │   ├── use-plans.ts                  # Plan list fetching
│       │   ├── use-plan.ts                   # Single plan fetching
│       │   └── use-drift-detection.ts        # Drift check on plan visit (FR-010)
│       ├── services/
│       │   └── plan-service.ts               # Server-side plan CRUD + step advancement
│       ├── contexts/
│       │   └── plan-drift-context.tsx         # PlanDriftContext provider (FR-015)
│       └── lib/
│           ├── steps.ts                      # Workflow step definitions + ordering
│           └── drift-utils.ts                # Drift report merging, per-step counting
├── lib/
│   ├── prisma.ts                             # Prisma client singleton
│   ├── audit.ts                              # Audit trail logging utility
│   └── types/
│       └── connector.ts                      # From 000-connector-interface
├── api/
│   └── plans/
│       ├── route.ts                          # GET (list) + POST (create)
│       └── [planId]/
│           ├── route.ts                      # GET (detail) + DELETE
│           └── step/route.ts                 # PATCH (advance step)
prisma/
└── schema.prisma                             # MigrationPlan + AuditLog models
tests/
├── integration/
│   └── plans/
│       ├── plan-crud.test.ts
│       └── plan-step.test.ts
└── e2e/
    └── plans/
        └── plan-workflow.spec.ts
```

### Key Dependencies Between Files

- `plan-service.ts` → `prisma.ts` + `audit.ts`
- `layout.tsx` → `plan-header.tsx` + `step-sidebar.tsx` + `drift-banner.tsx` + `plan-drift-context.tsx`
- `use-drift-detection.ts` → `drift-utils.ts` + calls `detectLiveDrift` (from features 003/007)
- `step-sidebar.tsx` → `steps.ts` (step definitions) + `drift-badge.tsx`

## Phases

### Phase 0: Research
See `research.md` — decisions on layout strategy, step state machine, drift architecture.

### Phase 1: Design
See `data-model.md` (Prisma schema), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` — ordered by: infrastructure → CRUD → layout → step workflow → drift detection.

## Complexity Tracking

No constitution violations identified. All principles are satisfied by the design.
