# Implementation Plan: Object Mapping

**Branch**: `011-object-mapping` | **Date**: 2026-04-02 | **Spec**: `specs/011-object-mapping/spec.md`

## Summary

Map source objects to destination objects within a migration plan. Provides a two-column visual layout with draggable link creation, auto-linking of predictable pairs (e.g., Account-Company for SF-HS), object detail modal with progress metrics, and cascade deletion of child data on link removal. This is the entry point for all downstream mapping work (field mapping, migration logic, filters).

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: Neon Postgres via Prisma (ObjectMapping table linked to MigrationPlan, isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker), Playwright (E2E for link interactions)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Constraints**: Two-column view must render 100+ objects per side within 2 seconds

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Standard Next.js patterns; visual linking uses simple state machine |
| III | Data fidelity | PASS | Cascade deletion is explicit and confirmed; fan-in warns about conflicts |
| IV | Tests on real data | PASS | Integration tests with realistic object counts (50+ per side) |
| V | Idempotence | PASS | Auto-linking checks existing mappings before creating; no duplicates |
| VI | Traceability | PASS | All link create/remove operations logged to audit trail |
| VII | Observability | PASS | Console logs for auto-link execution, link creation, cascade deletion |
| VIII | Modularity | PASS | Isolated behind ObjectMappingService; communicates via Connector Interface types; public API is service + API routes |
| IX | Human-in-the-loop | PASS | Auto-link tourne uniquement à la 1ère configuration de la paire source/destination, ou sur trigger explicite (bouton "Auto-match") ; jamais re-déclenché après un refresh schema ; cascade delete sur unlink confirmée via UI |

## Project Structure

### Documentation

```text
specs/011-object-mapping/
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
│   ├── plans/[planId]/mapping/
│   │   └── page.tsx                          # Object mapping two-column view
│   └── api/plans/[planId]/object-mappings/
│       ├── route.ts                          # GET list, POST create
│       ├── [mappingId]/route.ts              # DELETE remove
│       └── auto-link/route.ts                # POST trigger auto-linking
├── components/mapping/
│   ├── ObjectMappingView.tsx                 # Two-column layout with visual links
│   ├── ObjectCard.tsx                        # Object card with connection circle
│   ├── ObjectDetailModal.tsx                 # Detail modal (record count, progress, filters)
│   ├── ObjectLink.tsx                        # SVG visual link between cards
│   ├── ObjectSearchFilter.tsx                # Search/filter for object lists
│   └── LinkConfirmDialog.tsx                 # Confirmation dialog for link removal
├── lib/
│   ├── services/object-mapping.ts            # Domain logic: create, delete, auto-link, cascade
│   ├── services/auto-link-registry.ts        # Predictable pair definitions per connector pair
│   └── types/mapping.ts                      # ObjectMapping types, LinkState
└── hooks/
    └── use-object-mapping.ts                 # React hook for mapping state + link interactions

tests/
├── unit/services/object-mapping.test.ts
├── unit/services/auto-link-registry.test.ts
└── integration/api/object-mapping.test.ts
```

**Structure Decision**: Object mapping view lives at `plans/[planId]/mapping/` as the main mapping step page. API routes follow RESTful convention. Auto-linking is a separate POST endpoint because it is an explicit action (first visit to mapping view triggers it via the client).
