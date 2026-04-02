# Tasks: Migration Plan

**Input**: `specs/001-migration-plan/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

## Phase 1: Setup

- [ ] T001 Create `prisma/schema.prisma` with datasource (SQLite), generator, MigrationPlan model, and AuditLog model per data-model.md. Run `npx prisma generate` and `npx prisma db push`.
- [ ] T002 [P] Create Prisma client singleton at `src/lib/db/prisma.ts` using globalThis pattern for dev hot-reload safety
- [ ] T003 [P] Create plan type definitions at `src/lib/types/plan.ts`: PlanStatus union, PlanStep union, PLAN_STEPS constant array, CreatePlanInput type

**Checkpoint**: Database schema ready, Prisma client available.

---

## Phase 2: Core Services (US1 — Plan CRUD)

**Goal**: Create, list, get, and delete plans via service layer + API routes.

**Independent Test**: API routes respond correctly; audit logs are created.

### Implementation

- [ ] T004 Implement audit service at `src/lib/services/audit-service.ts`: `logAction(planId, action, details)` writes to AuditLog table. Console log each action for observability (Principle VII).
- [ ] T005 Implement plan service at `src/lib/services/plan-service.ts`: `createPlan(input)`, `listPlans()`, `getPlan(id)`, `deletePlan(id)`. Each operation calls audit service. Throws typed errors for not-found.
- [ ] T006 Create API route `src/app/api/plans/route.ts`: GET handler (list plans), POST handler (create plan with validation). Both delegate to plan-service.
- [ ] T007 Create API route `src/app/api/plans/[planId]/route.ts`: GET handler (get plan by ID), DELETE handler (delete plan). Both delegate to plan-service.

**Checkpoint**: All API endpoints functional. Test with curl or HTTP client.

---

## Phase 3: UI (US1 — Plan list and detail pages)

**Goal**: Home page shows plan list; plan detail page shows step workflow.

### Implementation

- [ ] T008 [P] Install required shadcn/ui components: `npx shadcn-ui@latest add card dialog button input badge`
- [ ] T009 Create plan list component at `src/components/plans/plan-list.tsx` and plan card at `src/components/plans/plan-card.tsx`: displays name, description, status badge, current step, dates
- [ ] T010 Create plan creation dialog at `src/components/plans/create-plan-dialog.tsx`: form with name (required) and description (optional), submits POST to `/api/plans`, redirects to plan detail on success
- [ ] T011 Create delete confirmation dialog at `src/components/plans/delete-plan-dialog.tsx`: confirms deletion, calls DELETE `/api/plans/[planId]`, refreshes plan list
- [ ] T012 Create home page at `src/app/page.tsx`: renders plan list with "New Plan" button, fetches plans from `/api/plans`
- [ ] T013 Create step workflow component at `src/components/plans/step-workflow.tsx`: vertical step indicator using PLAN_STEPS constant, shows completed/current/pending states
- [ ] T014 Create plan detail page at `src/app/plans/[planId]/page.tsx`: displays plan name, description, status, and step-workflow component. Fetches plan from `/api/plans/[planId]`.

**Checkpoint**: Full plan lifecycle visible in UI.

---

## Phase 4: Tests

- [ ] T015 [P] Create unit test `tests/unit/services/plan-service.test.ts`: test createPlan, listPlans, getPlan, deletePlan with mocked Prisma client. Verify audit log calls.
- [ ] T016 [P] Create integration test `tests/integration/api/plans.test.ts`: test all 4 API endpoints (GET list, POST create, GET detail, DELETE) against real SQLite test database. Verify cascade deletion.

**Checkpoint**: All tests pass.

---

## Dependencies & Execution Order

- **T001**: No deps — start immediately
- **T002, T003**: Depend on T001 (Prisma schema). Parallel-safe with each other.
- **T004**: Depends on T002 (Prisma client)
- **T005**: Depends on T003 (types), T004 (audit service)
- **T006, T007**: Depend on T005 (plan service). Parallel-safe with each other.
- **T008**: No deps on other tasks (shadcn install). Can run in parallel with Phase 2.
- **T009, T010, T011**: Depend on T008 (shadcn components), T006/T007 (API routes)
- **T012**: Depends on T009, T010, T011
- **T013**: Depends on T003 (PLAN_STEPS constant), T008
- **T014**: Depends on T013, T007 (plan detail API)
- **T015, T016**: Depend on T005-T007 (services and routes). Parallel-safe with each other.
