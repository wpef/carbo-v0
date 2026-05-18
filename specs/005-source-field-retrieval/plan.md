# Implementation Plan: Source Field Retrieval

**Branch**: `005-source-field-retrieval` | **Date**: 2026-05-18 | **Spec**: `specs/005-source-field-retrieval/spec.md`

## Summary

Retrieve and persist field metadata for selected source objects. When the consultant confirms object selection (004), the system fetches fields per object via the connector adapter, stores them as `ObjectField` rows linked to the `SchemaSnapshot` and `SchemaObject`, and displays them with full metadata (type, constraints, relationships, accessibility). Partial failures are handled per-object, and the audit trail records every retrieval event.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, Tailwind CSS, shadcn/ui, React 18+
**Storage**: Neon Postgres (via Prisma) — `ObjectField` table linked to `SchemaObject`
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: Field retrieval for 50 objects in <60s (SC-001); no silent field omissions (SC-002)
**Constraints**: DB-per-tenant (Neon); fields retrieved per-object, not bulk; connector adapter `getFields()` returns `ConnectorField[]`
**Scale/Scope**: Up to 2000 objects per schema, 100+ fields per object

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 8 FRs + 5 acceptance scenarios + 6 edge cases |
| II | Readability | PASS | Standard Next.js patterns; service function `retrieveFieldsForSelectedObjects()` with clear name |
| III | Data fidelity | PASS | All fields persisted including inaccessible ones (FR-004); no silent omissions (SC-002); system-specific `dataType` preserved as-is |
| IV | Tests on real data | PASS | Integration tests use demo adapter with realistic field counts (50+ fields per object) |
| V | Idempotence | PASS | Re-selecting an object triggers fresh retrieval (SC-004); deselected objects have their fields removed (FR-008) |
| VI | Traceability | PASS | Every retrieval event logged with field count per object (FR-007) |
| VII | Observability | PASS | Console logs for each object's field retrieval: start, field count, errors |
| VIII | Modularity | PASS | Feature isolated at `src/features/005-source-field-retrieval/`; depends on 000 types + 003 `SchemaObject` + 004 selection state |
| IX | Human-in-the-loop | N/A | No destructive or ambiguous operations in this feature |

## Architecture

### Source Code Layout

```
src/
├── app/plans/[planId]/source/
│   └── schema/
│       └── page.tsx                          # Field list page (server component shell)
├── features/005-source-field-retrieval/
│   ├── components/
│   │   ├── field-list.tsx                    # Field table for a single object (FR-002)
│   │   ├── field-row.tsx                     # Single field row with badges (FR-002, FR-003, FR-004)
│   │   ├── object-field-panel.tsx            # Expandable object → fields panel
│   │   ├── retrieval-status.tsx              # Per-object retrieval status indicator (FR-006)
│   │   └── workflow-nav.tsx                  # "Source schema ready. Next: ..." (spec §Workflow Navigation)
│   ├── hooks/
│   │   └── use-field-retrieval.ts            # Client-side trigger + polling for retrieval status
│   ├── services/
│   │   └── field-retrieval-service.ts        # Server-side: retrieve fields for selected objects, persist, audit
│   └── lib/
│       └── field-utils.ts                    # Display helpers (badge logic, relationship formatting)
├── lib/
│   ├── prisma.ts                             # Prisma client singleton (existing)
│   ├── audit.ts                              # Audit trail utility (existing)
│   └── types/
│       └── connector.ts                      # ConnectorField type (existing, from 000)
prisma/
└── schema.prisma                             # ObjectField model (added)
tests/
├── integration/
│   └── fields/
│       └── field-retrieval.test.ts           # Integration test: retrieve + persist + partial failure
└── e2e/
    └── fields/
        └── field-display.spec.ts             # E2E: field list renders correctly with badges
```

### API Routes

```
src/app/api/plans/[planId]/source/fields/
├── route.ts                # POST (trigger retrieval), GET (list fields for all selected objects)
└── [objectApiName]/
    └── route.ts            # GET (fields for a specific object)
```

### Key Dependencies Between Files

- `field-retrieval-service.ts` → `prisma.ts` + `audit.ts` + `ConnectorAdapter.getFields()` (from 000)
- `field-list.tsx` → `field-row.tsx` + `field-utils.ts`
- `use-field-retrieval.ts` → calls `POST /api/plans/[planId]/source/fields` then polls status
- `page.tsx` → `object-field-panel.tsx` + `retrieval-status.tsx` + `workflow-nav.tsx`

## Phases

### Phase 0: Research
See `research.md` — decisions on retrieval strategy, persistence granularity, concurrency.

### Phase 1: Design
See `data-model.md` (Prisma schema additions), `contracts/api.md` (route specifications).

### Phase 2: Implementation
See `tasks.md` — ordered by: schema migration → service → API routes → UI components.

## Complexity Tracking

No constitution violations identified. All decisions align with established patterns.
