# Tasks: Source Connection

**Input**: `specs/002-source-connection/`
**Prerequisites**: 000-connector-interface (types), 001-migration-plan (MigrationPlan model + pages)

---

## Phase 1: Data Layer

- [ ] T001 [US1] Add `SourceConnection` model to `prisma/schema.prisma` with fields: id, planId (unique), adapterType, status, config, connectedAt, createdAt, updatedAt. Add relation to MigrationPlan. Run `prisma migrate dev`.
- [ ] T002 [US1] Create adapter registry in `src/lib/connectors/registry.ts`: export `getAvailableAdapters(role: "source" | "destination")` returning adapter metadata (type, label, role, configFields). Register Salesforce and Demo entries.

---

## Phase 2: Service Layer

- [ ] T003 [US1] Create `src/lib/services/source-connection.ts`: implement `connectSource(planId, adapterType, config)` -- validates adapter type, calls adapter.connect(), persists SourceConnection, logs to audit trail. Returns connection or throws typed error.
- [ ] T004 [US1] In same service, implement `disconnectSource(planId)` -- cascade-deletes schema snapshots, object selections, field metadata via Prisma, sets plan.sourceConnectionId to null, logs to audit trail. Returns deletion summary.
- [ ] T005 [US1] In same service, implement `getSourceConnection(planId)` -- returns current connection or null.

---

## Phase 3: API Routes

- [ ] T006 [P] [US1] Create `src/app/api/plans/[planId]/source/route.ts`: implement GET handler -- calls `getSourceConnection`, returns JSON per contract.
- [ ] T007 [P] [US1] In same route file, implement POST handler -- validates body, calls `connectSource`, returns 201/400/401 per contract.
- [ ] T008 [P] [US1] In same route file, implement DELETE handler -- calls `disconnectSource`, returns 200/404 per contract.
- [ ] T009 [US1] Create `src/app/api/connectors/registry/route.ts`: implement GET handler -- calls `getAvailableAdapters`, returns adapter list per contract.

---

## Phase 4: UI Components

- [ ] T010 [P] [US1] Create `src/components/source/AdapterPicker.tsx`: displays adapter list from registry API, calls onSelect callback with chosen adapter type. Shows adapter label and icon placeholder.
- [ ] T011 [P] [US1] Create `src/components/source/ConnectionStatus.tsx`: displays connection status badge (CONNECTED green, PENDING gray, ERROR red). Shows adapter name and connectedAt timestamp when connected.
- [ ] T012 [P] [US1] Create `src/components/source/DemoModeToggle.tsx`: a switch/button that selects the "demo" adapter type as a shortcut. Clearly labeled "Use Demo Data".

---

## Phase 5: Page Integration

- [ ] T013 [US1] Create `src/app/plans/[planId]/source/page.tsx`: source connection step page. Integrates AdapterPicker, config form (dynamic fields from adapter.configFields), ConnectionStatus, DemoModeToggle. Calls POST/DELETE API routes. Shows disconnect button when connected.
- [ ] T014 [US1] Create `src/hooks/use-source-connection.ts`: React hook wrapping GET/POST/DELETE API calls with loading/error state management.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): No dependencies within feature. Requires 000 types and 001 MigrationPlan model.
- **Phase 2** (T003-T005): Depends on T001 (Prisma model) and T002 (registry).
- **Phase 3** (T006-T009): Depends on T003-T005 (service). T006/T007/T008 are [P] (same file, but independent handlers). T009 is independent.
- **Phase 4** (T010-T012): No backend dependency. [P] -- all independent components.
- **Phase 5** (T013-T014): Depends on Phase 3 (routes) and Phase 4 (components).
