# Tasks: Migration Plan

**Input**: `specs/001-migration-plan/`
**Prerequisites**: 000-connector-interface (types at `src/lib/types/connector.ts`)

## Phase 1: Infrastructure & Data Model

- [ ] T001 Create `prisma/schema.prisma` with initial Prisma config (datasource postgres, generator client) and models: `MigrationPlan` (id cuid, name, description nullable, status `PlanStatus` enum DRAFT/READY/BROKEN default DRAFT, currentStep `PlanStep` enum SOURCE/DESTINATION/MAPPING/FIELD_MAPPING/DOCUMENTS default SOURCE, sourceConnectionId nullable unique, destinationConnectionId nullable unique, objectAutoLinkedAt nullable DateTime, createdAt, updatedAt) and `AuditLog` (id cuid, planId nullable FK with onDelete Cascade, action, entityType, entityId, details Json nullable, createdAt). Include indexes on AuditLog: planId, (entityType+entityId), createdAt. Map tables to `migration_plans` and `audit_logs`.
- [ ] T002 Create `src/lib/prisma.ts`: Prisma client singleton using globalThis cache pattern for dev hot-reload. Export `prisma` instance.
- [ ] T003 Create `src/lib/audit.ts`: export `logAudit(params: { planId?: string, action: string, entityType: string, entityId: string, details?: unknown })` utility. Wraps `prisma.auditLog.create()`. Console log each audit event for observability (Principle VII).
- [ ] T004 Run `npx prisma migrate dev --name init-migration-plan` to generate and apply the initial migration.

**Checkpoint**: Prisma migration succeeds. `MigrationPlan` and `AuditLog` tables exist in the database. `logAudit()` writes a row and logs to console.

---

## Phase 2: Shared Types & Step Definitions

- [ ] T005 [P] Create `src/features/plans/types.ts` with TypeScript interfaces per `contracts/api.md`: `PlanListItem` (id, name, description, status, currentStep, createdAt, updatedAt), `PlanDetail` (extends PlanListItem with sourceConnectionId, destinationConnectionId, objectAutoLinkedAt, sourceConnection, destinationConnection), `CreatePlanInput` (name, description?), `AdvanceStepInput` (targetStep), `AdvanceStepResponse` (id, currentStep, status, updatedAt).
- [ ] T006 [P] Create `src/features/plans/lib/steps.ts`: export `PLAN_STEPS` ordered array `['SOURCE', 'DESTINATION', 'MAPPING', 'FIELD_MAPPING', 'DOCUMENTS']`, `STEP_LABELS` map with French labels (Source, Destination, Objets, Champs, Documents), `getStepIndex(step)`, `getNextStep(step)`, `isForwardStep(current, target)` returning boolean, `normalizeStep(legacyValue)` mapping old step names (`SOURCE_CONNECTION`, `OBJECT_SELECTION`, etc.) to current values (Session Learning #3).

**Checkpoint**: Types compile. `isForwardStep('SOURCE', 'DESTINATION')` returns true. `isForwardStep('DESTINATION', 'SOURCE')` returns false. `normalizeStep('SOURCE_CONNECTION')` returns `'SOURCE'`.

---

## Phase 3: Service Layer

- [ ] T007 Create `src/features/plans/services/plan-service.ts` with server-side functions:
  - `createPlan(input: CreatePlanInput)`: validate name non-empty, `prisma.migrationPlan.create()` with defaults, audit log `PLAN_CREATED` with `{ name, description }`, return full plan.
  - `listPlans()`: `prisma.migrationPlan.findMany()` ordered by `updatedAt` desc, select list fields only.
  - `getPlan(planId)`: `findUnique` with includes for `sourceConnection` and `destinationConnection` (id, adapterType, status). Throw 404 if not found.
  - `deletePlan(planId)`: verify plan exists (404 if not), audit log `PLAN_DELETED` with `{ name }` before delete, `prisma.migrationPlan.delete()` with cascade.
  - `advanceStep(planId, targetStep)`: validate via `isForwardStep()`, update `currentStep`, if targetStep is `DOCUMENTS` set status to `READY`, audit log `STEP_ADVANCED` with `{ from, to }`, return `AdvanceStepResponse`.

**Checkpoint**: All 5 service functions work against a test database. Audit logs created for create, delete, and advance operations.

---

## Phase 4: API Routes

- [ ] T008 Create `src/app/api/plans/route.ts`: `GET` handler calls `listPlans()` returns 200 JSON array. `POST` handler parses body, validates `name` presence (400 if missing/empty), calls `createPlan()`, returns 201. Wrap in try/catch returning 500 with error message.
- [ ] T009 [P] Create `src/app/api/plans/[planId]/route.ts`: `GET` handler calls `getPlan(planId)` returns 200. `DELETE` handler calls `deletePlan(planId)` returns 204 empty body. Handle 404 from service layer.
- [ ] T010 [P] Create `src/app/api/plans/[planId]/step/route.ts`: `PATCH` handler parses `targetStep` from body, calls `advanceStep()`, returns 200. Return 400 for invalid/non-forward step. Return 404 for missing plan.

**Checkpoint**: All 6 API operations pass manual curl tests per quickstart.md: create, list, get detail, delete, advance step (valid), advance step backward (400).

---

## Phase 5: UI Components (Plan List & Creation)

- [ ] T011 [P] Create `src/features/plans/hooks/use-plans.ts`: client-side hook fetching `GET /api/plans`. Return `{ plans, isLoading, error, mutate }`. Use `fetch` + React state (or SWR if available).
- [ ] T012 [P] Create `src/features/plans/components/plan-card.tsx`: single plan card displaying name, description (truncated), status badge (Brouillon/Pret/Erreur with DRAFT=grey, READY=green, BROKEN=red), current step label from `STEP_LABELS`, creation date, last update date. Entire card links to `/plans/[id]`. Delete button with confirmation dialog (shadcn/ui `AlertDialog`).
- [ ] T013 [P] Create `src/features/plans/components/plan-form.tsx`: form with name input (required) and description textarea (optional). Submit calls `POST /api/plans`, on success redirects to `/plans/[id]`. Cancel navigates to `/`. Uses shadcn/ui `Input`, `Textarea`, `Button`, `Label`.
- [ ] T014 Create `src/features/plans/components/plan-list.tsx`: renders array of `PlanListItem` as plan cards via `plan-card.tsx`. Empty state: message "Aucun plan de migration" with CTA button to create first plan. Passes `mutate` from hook for optimistic delete.
- [ ] T015 Create `src/app/page.tsx`: home page server component shell. Renders `plan-list.tsx` client component with `use-plans.ts` hook. "Nouveau plan" button links to `/plans/new`.
- [ ] T016 Create `src/app/plans/new/page.tsx`: plan creation page rendering `plan-form.tsx`.

**Checkpoint**: Home page lists plans. "Nouveau plan" opens form, submit creates plan and redirects to plan detail. Delete removes plan from list. Empty state shows when no plans exist.

---

## Phase 6: Persistent Plan Layout (Header, Sidebar, Detail)

- [ ] T017 Create `src/features/plans/hooks/use-plan.ts`: client-side hook fetching `GET /api/plans/[planId]`. Return `{ plan, isLoading, error, mutate }`.
- [ ] T018 [P] Create `src/features/plans/components/plan-header.tsx`: fixed header bar per FR-007/FR-009. Left: plan name (link to `/plans/[planId]`), status badge (Brouillon/Pret/Erreur). Right: source connector label + connection status dot (green=CONNECTED, grey=absent/other) arrow separator destination connector label + dot. Uses `PlanDetail` data. Header must not scroll.
- [ ] T019 [P] Create `src/features/plans/components/step-sidebar.tsx`: vertical step list from `PLAN_STEPS`/`STEP_LABELS`. Each step: label, state indicator (green checkmark if completed, highlighted if active, grey if pending). Accepts optional `driftBadgeCounts` prop for per-step badges (rendered in Phase 7). Next-step button pinned at bottom: active when `activeStepIndex <= currentMaxStepIndex` (FR-008 fix from Session Learning #4). On click at max step: calls `PATCH /api/plans/[planId]/step` with next step then navigates. On click at completed step: navigates directly. Uses `useRouter()`.
- [ ] T020 Create `src/app/plans/[planId]/layout.tsx`: persistent layout per FR-007 and Research Decision 2. Structure: outer `div` with `h-screen overflow-hidden flex flex-col`. `plan-header.tsx` at top. Below: `flex flex-1 overflow-hidden` with `step-sidebar.tsx` (fixed width ~240px, no scroll) and main content `div` (`flex-1 overflow-auto p-6`). Fetches plan via `use-plan.ts`. Passes plan data to header and sidebar. No `position: sticky` anywhere (Session Learning #5).
- [ ] T021 Create `src/app/plans/[planId]/page.tsx`: plan detail page showing plan metadata (name, description, creation date) and current step description with call-to-action. No in-page workflow rendering (Session Learning #6 -- workflow lives solely in layout sidebar).

**Checkpoint**: `/plans/[planId]` shows persistent header + sidebar + scrollable main. Sidebar highlights current step. Next-step button advances the plan. Header shows plan name, status badge, grey connection dots (no connections yet).

---

## Phase 7: Drift Detection (Plan-Level)

- [ ] T022 Create `src/features/plans/lib/drift-utils.ts`: pure utility functions:
  - `mergeDriftReports(sourceReport, destReport)`: merge two `DriftReport` objects into a single plan-level report.
  - `countDriftByStep(mergedReport)`: return `Record<PlanStep, { critical: number, warning: number, info: number }>` using the per-step mapping table from spec (Source=object+field changes on source side, Destination=same on dest side, Object Mapping=OBJECT_REMOVED on mapped objects, Field Mapping=FIELD_REMOVED/TYPE_CHANGED/PICKLIST/FIELD_BECAME_REQUIRED, Documents=outdated flag).
  - `getMaxSeverity(report)`: return `'critical' | 'warning' | 'info' | null`.
- [ ] T023 Create `src/features/plans/hooks/use-drift-detection.ts`: hook implementing FR-010. On mount: read `sessionStorage.lastVisitedPlanId`, compare to current planId. If different (new visit): set `lastVisitedPlanId`, call `detectLiveDrift` for source and destination in parallel, merge via `mergeDriftReports()`. If same (intra-plan nav): return cached result. Expose `{ driftReport, isChecking, error, refresh, dismiss }`. `dismiss` sets sessionStorage flag scoped to planId+checkedAt (FR-013).
- [ ] T024 Create `src/features/plans/contexts/plan-drift-context.tsx`: React context provider wrapping `use-drift-detection.ts` output. Export `PlanDriftContext` and `usePlanDrift()` consumer hook. Exposes: driftReport, isChecking, refresh, dismiss (FR-015).
- [ ] T025 [P] Create `src/features/plans/components/drift-banner.tsx`: banner reading from `usePlanDrift()`. Rendered below header, above sidebar+main. Shown when `getMaxSeverity(report)` is `critical` or `warning`. Summary line in French: "Le schema a evolue depuis votre derniere visite : N changement(s) critique(s), M changement(s) a surveiller." Breakdown by severity then category. Primary button `[Rafraichir le schema]` triggers full-chain refresh for impacted side(s), auto-dismisses on success (FR-012). Secondary `[Ignorer pour cette session]` calls `dismiss()` (FR-013). Non-blocking: no modal, no overlay (FR-011). Graceful degraded message for `status=unavailable` (FR-016).
- [ ] T026 [P] Create `src/features/plans/components/drift-badge.tsx`: small pill badge component. Props: `critical: number`, `warning: number`. Renders red pill "N ERREURS" for critical > 0, amber pill "N modif" for warning > 0. Nothing rendered if both zero.
- [ ] T027 Integrate drift into plan layout (`src/app/plans/[planId]/layout.tsx`): wrap children with `PlanDriftContext` provider. Render `drift-banner.tsx` between header and sidebar+main. Pass `countDriftByStep()` result to `step-sidebar.tsx` as `driftBadgeCounts` prop. Add `sessionStorage.removeItem('lastVisitedPlanId')` cleanup via `useEffect` on unmount or route change to non-plan page.

**Checkpoint**: Navigating to a plan from outside fires drift check once. Banner appears when drift detected. Dismiss hides banner for current visit. Re-entering plan re-shows banner. Sidebar badges show per-step counts. Intra-plan navigation does not re-fire the check.

---

## Phase 8: Integration Tests

- [ ] T028 [P] Create `tests/integration/plans/plan-crud.test.ts` (Vitest): test plan CRUD via service functions against a test database.
  - Create plan with valid name -> returns plan with status DRAFT, currentStep SOURCE.
  - Create plan with empty name -> throws validation error.
  - List plans -> returns array ordered by updatedAt desc.
  - Get plan by id -> returns full PlanDetail with null connections.
  - Get non-existent plan -> throws 404.
  - Delete plan -> plan no longer found, audit logs cascade-deleted.
  - Verify audit logs written for create and delete operations.
- [ ] T029 [P] Create `tests/integration/plans/plan-step.test.ts` (Vitest): test step advancement via service function.
  - Advance SOURCE -> DESTINATION -> succeeds, returns DESTINATION.
  - Advance SOURCE -> MAPPING -> succeeds (forward skip allowed).
  - Advance DESTINATION -> SOURCE -> fails (backward not allowed).
  - Advance to DOCUMENTS -> status becomes READY.
  - Advance with invalid step name -> fails with validation error.
  - Verify audit log STEP_ADVANCED written with from/to details.

**Checkpoint**: All integration tests pass against a test Postgres database.

---

## Phase 9: E2E Tests

- [ ] T030 Create `tests/e2e/plans/plan-workflow.spec.ts` (Playwright): end-to-end test of the full plan lifecycle.
  - Navigate to home page `/`, verify empty state message visible.
  - Click "Nouveau plan", fill name "Acme Corp Migration" + description, submit.
  - Verify redirect to `/plans/[id]` with plan name in header and DRAFT badge.
  - Verify sidebar shows 5 steps with SOURCE highlighted.
  - Verify header shows grey connection dots for source and destination.
  - Navigate back to home `/`, verify plan card appears in list with name and status.
  - Delete plan via card delete button, confirm dialog, verify card disappears.
  - Verify home page shows empty state again.

**Checkpoint**: Full E2E test passes. Feature 001 is complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately
- **T002, T003**: Depend on T001 (Prisma schema must exist)
- **T004**: Depends on T001 (schema file to migrate)
- **T005, T006**: Depend on T001 (reference enum names). Parallel-safe.
- **T007**: Depends on T002, T003, T005, T006 (prisma client, audit utility, types, steps)
- **T008**: Depends on T007 (service functions)
- **T009, T010**: Depend on T007. Parallel-safe.
- **T011, T012, T013**: Depend on T005, T006 (types, step labels). Parallel-safe.
- **T014**: Depends on T012 (plan-card component)
- **T015**: Depends on T011, T014 (use-plans hook, plan-list component)
- **T016**: Depends on T013 (plan-form component)
- **T017, T018, T019**: Depend on T005, T006, T010 (types, steps, step API). Parallel-safe.
- **T020**: Depends on T017, T018, T019 (use-plan hook, header, sidebar)
- **T021**: Depends on T020 (layout must exist)
- **T022**: Depends on T005 (types for DriftReport shape)
- **T023**: Depends on T022 (drift-utils)
- **T024**: Depends on T023 (use-drift-detection hook)
- **T025, T026**: Depend on T024 (PlanDriftContext). Parallel-safe.
- **T027**: Depends on T020, T024, T025, T026 (layout, context, banner, badge)
- **T028, T029**: Depend on T007 (service layer). Parallel-safe.
- **T030**: Depends on T015, T016, T020, T021 (all UI pages built)

### Parallel Opportunities

```
Phase 1: T001 -> [T002 | T003 | T004]
Phase 2: [T005 | T006] parallel
Phase 3: T007 sequential (needs Phase 1+2)
Phase 4: T008 -> [T009 | T010] parallel
Phase 5: [T011 | T012 | T013] parallel -> T014 -> [T015 | T016] parallel
Phase 6: [T017 | T018 | T019] parallel -> T020 -> T021
Phase 7: T022 -> T023 -> T024 -> [T025 | T026] parallel -> T027
Phase 8: [T028 | T029] parallel
Phase 9: T030 sequential (needs all UI)
```
