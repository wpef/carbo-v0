# Implementation Plan: Field Mapping

**Branch**: `012-field-mapping` | **Date**: 2026-05-18 | **Spec**: `specs/012-field-mapping/spec.md`

## Summary

Build the field-level mapping UI and backend for individual object pairs. Consultants see a table-based view of mapped fields (source -> destination, type badges, compatibility status, actions) plus unmapped field pools. Auto-match creates native field correspondences on first visit. Manual linking via dropdown. Type compatibility matrix (5x5) determines `CompatibilityStatus`. Visual link status (GREEN/ORANGE/RED_SOLID/RED_DASHED/BROKEN) tracks migration logic progress. Live migration preview sidebar shows before/after for a selected source record. Drift highlighting for field-level schema changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14+ (App Router), Prisma ORM (Neon Postgres), Tailwind CSS, shadcn/ui
**Storage**: Prisma — `FieldMapping` model (new), `ObjectMapping` model (from 011, owns `fieldAutoMatchedAt`)
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Next.js Route Handlers + React Server Components / Client Components
**Project Type**: Full-stack feature (API routes + UI page + service layer)
**Constraints**: Auto-match runs exactly once per object mapping (gated by `fieldAutoMatchedAt`); 1:1 mapping enforced per object pair; type compatibility via 5x5 matrix; audit trail mandatory (Principle VI)

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with user stories, FRs, acceptance scenarios |
| II | Readability | PASS | Table-based UI (replaces SVG — session learning #1); explicit service functions |
| III | Data fidelity | PASS | Field types preserved as-is; compatibility status computed, not assumed; no silent type coercion |
| IV | Tests on real data | PASS | Integration tests use realistic SF/HS field sets; E2E covers auto-match + manual link + preview |
| V | Idempotence | PASS | Auto-match is idempotent (gated by timestamp); 1:1 constraint prevents accidental duplicates |
| VI | Traceability | PASS | All field link creation/removal logged to AuditLog (FR-013) |
| VII | Observability | PASS | Service layer emits console logs for auto-match execution, link creation, compatibility checks |
| VIII | Modularity | PASS | Self-contained module: `src/features/012-field-mapping/` with explicit exports |
| IX | Human-in-the-loop | PASS | Auto-match one-shot only (FR-006); no auto-removal of links; BROKEN status requires manual action |

## Architecture

```
src/features/012-field-mapping/
  service/
    field-mapping.service.ts       # CRUD + auto-match logic
    auto-match-registry.ts         # Native field correspondences per adapter combo
    type-compatibility.ts          # 5x5 compatibility matrix + type normalizer
    link-status.ts                 # LinkStatus computation (GREEN/ORANGE/RED_SOLID/RED_DASHED/BROKEN)
  types/
    field-mapping.types.ts         # FieldMapping TS types, LinkStatus enum, CompatibilityStatus
  components/
    FieldMappingView.tsx           # Main view: tabs per object pair + table + preview
    FieldMappingTable.tsx          # Table of mapped fields (B1)
    FieldCard.tsx                  # B2 — field card (inline in table row)
    FieldDetailModal.tsx           # B3 — field detail modal
    UnmappedFieldsSection.tsx      # Unmapped source fields with "Map to..." dropdown
    MigrationPreviewSidebar.tsx    # Live before/after preview (US7)
    LinkStatusBadge.tsx            # Color-coded status indicator
  hooks/
    useFieldMappings.ts            # React Query hooks for field mapping CRUD
    useMigrationPreview.ts         # Hook for preview sidebar data
  __tests__/
    field-mapping.service.test.ts  # Unit + integration tests
    type-compatibility.test.ts     # Matrix tests
    auto-match-registry.test.ts    # Registry tests

app/plans/[planId]/field-mapping/
  page.tsx                         # Route: field mapping page
  loading.tsx                      # Suspense fallback

app/api/plans/[planId]/field-mappings/
  route.ts                         # GET (list by object mapping), POST (create)
  [fieldMappingId]/
    route.ts                       # DELETE
  auto-match/
    route.ts                       # POST (trigger auto-match for an object mapping)
  unmapped/
    route.ts                       # GET (unmapped fields for an object mapping)
  preview/
    route.ts                       # GET (migration preview for a source record)
```

### Key Design Decisions

1. **Table-based UI replaces SVG** — Session learning #1: SVG two-column approach was fundamentally broken for field mapping (wrong coordinates, infinite loops, invisible colors). Table layout is more reliable, accessible, and maintainable. Columns: Source Field (name + type) -> Dest Field (name + type) | Status | Actions.
2. **Auto-match = registry + name fallback** — Session learnings #2-3: registry-only was too narrow, name-only missed semantic equivalences. Union approach: registry pairs PLUS case-insensitive apiName match for fields not covered by registry.
3. **Type normalization** — 30+ raw type names from connectors mapped to 5 canonical categories (text, number, date, picklist, boolean). Unknown types default to "text" (most permissive).
4. **LinkStatus is computed, not stored** — Derived from: (1) type compatibility, (2) whether migration logic exists, (3) whether logic is validated, (4) whether referenced object/field exists in current schema. Precedence: BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN.
5. **Migration preview** — Client-side computation. Loads 25 source records, applies value equivalences only (no JS transforms or LLM classification in preview). Transformed values highlighted in amber.

## Phases

### Phase 0: Research
See `research.md` — type compatibility matrix, auto-match strategy, table UI rationale, preview architecture.

### Phase 1: Data Layer
Prisma model + type compatibility engine + service layer + API routes. See `data-model.md`, `contracts/api.md`.

### Phase 2: UI Components
Table view, field cards, detail modal, unmapped fields section, link status badges.

### Phase 3: Auto-Match
Auto-match registry + name-based fallback + one-shot execution.

### Phase 4: Migration Preview Sidebar
Source record loading, before/after rendering, value equivalence application.

### Phase 5: Drift Highlighting
Consume PlanDriftContext, render field-level drift flags (orthogonal to linkStatus).

### Phase 6: Tests
Integration tests for service layer, type compatibility matrix, E2E tests for full flow.

## Complexity Tracking

| Item | Complexity | Mitigation |
|------|-----------|------------|
| Type compatibility matrix | Medium | Exhaustive 5x5 matrix with explicit test coverage; unknown types fall back to "text" |
| Auto-match union strategy | Medium | Session learnings #2-3: registry pairs + case-insensitive name match; tested with realistic SF/HS field sets |
| LinkStatus computation | Medium | Pure function with clear precedence order; unit tested per status combination |
| Migration preview sidebar | High | Client-side only; value equivalences applied via simple lookup; 25 record limit; placeholder when no mappings |
| Drift flags orthogonal to linkStatus | Medium | Separate `driftFlag` property on row; both rendered simultaneously; drift flags are informational only |
| 200+ fields performance | Medium | Table with client-side search/filter; pagination if needed; no virtualization initially |
| Tab badge reactivity | Low | Session learning #5: version counter incremented on mutations triggers re-fetch |
