# Tasks: Destination Connection

**Input**: `specs/006-destination-connection/`
**Prerequisites**: 000-connector-interface (types), 001-migration-plan (MigrationPlan entity, plan pages), 002-source-connection (ConnectorConnection entity, adapter registry pattern)

## Phase 1: Setup

- [ ] T001 [P] Register HubSpot as a destination adapter in `src/lib/connectors/registry.ts` — add entry with `roles: ["destination"]`, capabilities `{ canRead: true, canWrite: true, canWriteSchema: true }`
- [ ] T002 [P] Create demo destination adapter in `src/lib/connectors/adapters/demo-destination/index.ts` — implements `ConnectorAdapter` with pre-seeded HubSpot-like schema data

## Phase 2: US1 — Connect Destination (P1)

**Goal**: Consultant selects an adapter, authenticates, connection is stored on the plan.

**Independent Test**: POST to `/api/plans/:id/destination-connection` with demo adapter returns CONNECTED.

- [ ] T003 Create destination connection service in `src/lib/services/destination-connection.service.ts` — `connect(planId, adapterType, config)`, `disconnect(planId)`, `getStatus(planId)`. Validates plan exists, no existing destination, instantiates adapter, tests connection, persists ConnectorConnection with `role: "destination"`, logs to audit trail
- [ ] T004 Create route handler `src/app/api/plans/[planId]/destination-connection/route.ts` — POST (connect), GET (status), DELETE (disconnect). Delegates to service. Error handling per contracts/api.md
- [ ] T005 Create adapter selector component `src/components/destination/adapter-selector.tsx` — displays destination adapters from registry, emits selected adapter type
- [ ] T006 Create connection status component `src/components/destination/connection-status.tsx` — shows CONNECTED/DISCONNECTED badge, adapter name, disconnect button
- [ ] T007 Create destination connection page `src/app/plans/[planId]/destination/page.tsx` — composes adapter-selector + connection-status. Calls POST on connect, DELETE on disconnect. Shows loading/error states. Updates plan workflow step on success

## Phase 3: US2 — Disconnect with Cascade (P1)

**Goal**: Disconnecting cleans up all dependent destination data.

**Independent Test**: After disconnect, schema snapshots and objects for the destination are deleted.

- [ ] T008 Add cascade cleanup to `src/lib/services/destination-connection.service.ts` `disconnect()` — delete SchemaSnapshot, SchemaObject, ObjectField records for the destination connection. Log deleted counts to audit trail
- [ ] T009 Add disconnect confirmation UI in `src/components/destination/connection-status.tsx` — confirmation dialog warning about data loss before executing disconnect

## Phase 4: Polish

- [ ] T010 Add workflow step integration in `src/app/plans/[planId]/destination/page.tsx` — update plan's currentStep and show "Destination connected. Next: [Retrieve Schema]" navigation hint after successful connection

---

## Dependencies & Execution Order

- **Phase 1** (T001, T002): Parallel. No deps beyond 000/001/002 being done.
- **Phase 2** (T003-T007): T003 first (service), then T004 (route) depends on T003. T005-T007 (UI) depend on T004.
- **Phase 3** (T008-T009): Depends on T003 (service exists). T009 depends on T006 (status component).
- **Phase 4** (T010): Depends on T007 (page exists).
