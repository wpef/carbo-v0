# Implementation Plan: Object Mapping

**Branch**: `011-object-mapping` | **Date**: 2026-05-18 | **Spec**: `specs/011-object-mapping/spec.md`

## Summary

Build the object-level mapping UI and backend for migration plans. Consultants see a two-column view (source objects left, destination objects right) with visual SVG links between paired objects. Auto-linking creates predictable pairs on first visit. Manual linking via click-to-connect. Object detail modal shows record count, field progress, and filter count. Cascade delete on link removal. Drift highlighting for schema changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14+ (App Router), Prisma ORM (Neon Postgres), Tailwind CSS, shadcn/ui
**Storage**: Prisma — `ObjectMapping` model (new), `MigrationPlan` model (existing, owns `objectAutoLinkedAt`)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Next.js Route Handlers + React Server Components / Client Components
**Project Type**: Full-stack feature (API routes + UI page + service layer)
**Constraints**: Auto-link runs exactly once per plan (gated by `objectAutoLinkedAt`); fan-out and fan-in allowed; cascade delete on link removal; audit trail mandatory (Principle VI)

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with user stories, FRs, acceptance scenarios |
| II | Readability | PASS | Standard Next.js patterns; service layer with explicit function names |
| III | Data fidelity | PASS | Object names stored as-is from connector schema; no silent transformation |
| IV | Tests on real data | PASS | Integration tests use realistic SF/HS object sets from demo adapter; E2E tests cover auto-link + manual link flows |
| V | Idempotence | PASS | Auto-link is idempotent (gated by timestamp); manual operations are explicit |
| VI | Traceability | PASS | All link creation/removal logged to AuditLog (FR-012) |
| VII | Observability | PASS | Service layer emits console logs for auto-link execution, link creation, cascade delete |
| VIII | Modularity | PASS | Self-contained module: `src/features/011-object-mapping/` with explicit exports |
| IX | Human-in-the-loop | PASS | Auto-link one-shot only (FR-004); no auto-removal of links; fan-in warning shown to consultant |

## Architecture

```
src/features/011-object-mapping/
  service/
    object-mapping.service.ts     # CRUD + auto-link logic
    auto-link-registry.ts         # Predictable pair definitions per adapter combo
  types/
    object-mapping.types.ts       # ObjectMapping TS types + API payloads
  components/
    ObjectMappingView.tsx          # Two-column layout (client component)
    ObjectCard.tsx                 # A2 — object card with connection circle
    ObjectDetailModal.tsx          # A3 — detail modal
    ObjectLink.tsx                 # SVG link rendering between paired cards
    ObjectSearch.tsx               # Search + category filter (All/Mapped/Unmapped/Standard/Custom)
  hooks/
    useObjectMappings.ts           # React Query hook for fetching/mutating mappings
    useSvgLinks.ts                 # SVG coordinate calculation + layout
  __tests__/
    object-mapping.service.test.ts # Unit + integration tests
    auto-link-registry.test.ts     # Registry tests

app/plans/[planId]/mapping/
  page.tsx                         # Route: object mapping page
  loading.tsx                      # Suspense fallback

app/api/plans/[planId]/object-mappings/
  route.ts                         # GET (list), POST (create)
  [mappingId]/
    route.ts                       # DELETE (cascade)
  auto-link/
    route.ts                       # POST (trigger auto-link)
```

### Key Design Decisions

1. **SVG links overlay** — SVG element positioned as absolute overlay on the full container. Link coordinates computed from card bounding rects via `useLayoutEffect`. Depends on primitive values (search strings) not arrays to avoid infinite render loops (session learning #2).
2. **Auto-link registry** — A `Map<string, PredictablePair[]>` keyed by `"sourceAdapter:destAdapter"` (e.g., `"salesforce:hubspot"`). Extensible per connector combination. Returns empty array for unknown combos.
3. **Cascade delete** — Removing an ObjectMapping cascade-deletes all FieldMappings, MigrationLogicRules, ValueEquivalences, ClassificationPrompts, and MigrationFilters via Prisma `onDelete: Cascade`.
4. **Drift rendering** — Consumes `PlanDriftContext` from spec 001. Object-level drift types (`OBJECT_ADDED`, `OBJECT_REMOVED`) rendered as badges/outlines on cards. Does not auto-remove mappings (Principle IX).

## Phases

### Phase 0: Research
See `research.md` — SVG coordinate handling, auto-link registry design, cascade delete strategy.

### Phase 1: Data Layer
Prisma model + service layer + API routes. See `data-model.md`, `contracts/api.md`.

### Phase 2: UI Components
Two-column view, object cards, SVG links, search/filter, detail modal. See `tasks.md`.

### Phase 3: Auto-Link
Auto-link registry + one-shot execution + audit logging.

### Phase 4: Drift Highlighting
Consume PlanDriftContext, render object-level drift badges.

### Phase 5: Tests
Integration tests for service layer, E2E tests for full flow.

## Complexity Tracking

| Item | Complexity | Mitigation |
|------|-----------|------------|
| SVG link coordinates | High | Session learnings #1-3: use `var(--primary)` directly, depend on primitives not arrays, overlay full container |
| Auto-link one-shot gate | Medium | Single transaction: create links + set `objectAutoLinkedAt = NOW()` |
| Cascade delete depth | Medium | Prisma `onDelete: Cascade` handles 4 levels (ObjectMapping -> FieldMapping -> MigrationLogic -> ValueEquivalence) |
| 100+ objects performance | Medium | Virtualized scroll lists; search/filter reduces rendered count |
| Fan-in warning | Low | UI-only: count destination links, show warning badge if > 1 |
