# Tasks: Destination Connection

**Input**: `specs/006-destination-connection/`
**Prerequisites**: 000-connector-interface (types + registry), 001-migration-plan (MigrationPlan entity with destinationConnectionId FK)

## Phase 1: Service Layer — Connect / Disconnect

- [ ] T001 Create `src/lib/services/destination-connection.ts` with `connectDestination(planId, adapterType, config)`: resolve adapter from registry, call `adapter.connect()`, create `ConnectorConnection` row, set `MigrationPlan.destinationConnectionId`, log `DESTINATION_CONNECTED` to audit trail. Return the connection. Validate plan exists and has no existing destination connection (else throw 409).
- [ ] T002 Add `disconnectDestination(planId)` to the same service: delete `ConnectorConnection` row, set `destinationConnectionId` to null, cascade-delete schema snapshot, log `DESTINATION_DISCONNECTED` to audit trail. No-op if no destination connected.
- [ ] T003 [P] Create `src/lib/services/destination-schema.ts` with `fetchAndStoreDestinationSchema(planId)`: fetch schema via `adapter.getSchema()`, fetch fields for all objects via `adapter.getFields()`, store as `schemaSnapshot` JSON on the `ConnectorConnection` row. Return object count and field count. This is the destination chain (schema->fields, no object selection — per FR-016).

**Checkpoint**: Unit tests pass for connect, disconnect, and schema fetch. ConnectorConnection rows created/deleted correctly.

---

## Phase 2: API Routes — Connect / Disconnect / Refresh

- [ ] T004 Create `src/app/api/plans/[planId]/destination/route.ts`: POST handler calling `connectDestination()`, DELETE handler calling `disconnectDestination()`, GET handler returning connection status + non-secret config (FR-006). Validate `planId` param. Return appropriate HTTP status codes per contracts/api.md.
- [ ] T005 [P] Create `src/app/api/plans/[planId]/destination/refresh/route.ts`: POST handler calling `fetchAndStoreDestinationSchema()`. After refresh, query field mappings referencing fields no longer in the snapshot and mark them `linkStatus=BROKEN` (FR-018). Return refresh summary. Log `DESTINATION_SCHEMA_REFRESHED` to audit trail.

**Checkpoint**: API routes respond correctly. POST creates connection, DELETE removes it, GET returns status, POST /refresh overwrites schema and flags broken mappings.

---

## Phase 3: Destination Page UI — Initial Connection

- [ ] T006 Create `src/components/destination/DestinationConnectionForm.tsx`: adapter picker dropdown (populated from `GET /api/adapters?side=destination`), config form fields per adapter type, submit button. Include "Use Demo Data" option (FR-004). On submit, POST to `/api/plans/[planId]/destination`.
- [ ] T007 Create `src/components/destination/DestinationConnectedStatus.tsx`: displays adapter type, connection status badge, schema object count, "Reconfigurer" button (FR-005), "Rafraichir le schema" button (FR-017). Shows non-secret config values.
- [ ] T008 Create `src/app/plans/[planId]/destination/page.tsx`: destination step page. If no connection, render `DestinationConnectionForm`. If connected, render `DestinationConnectedStatus`. Handle `?connected=<adapterType>` URL param to auto-trigger refresh on mount (FR-016). Show loading indicator during auto-retrieval. Display error message if retrieval fails (edge case: auto-retrieval failure).

**Checkpoint**: Full connection flow works end-to-end via UI. Demo mode connects instantly. OAuth callback triggers auto-retrieval. Connected state shows Reconfigure + Refresh buttons.

---

## Phase 4: Reconfiguration — Schema Diff & Impact Report

- [ ] T009 Create `src/lib/services/schema-diff.ts` (shared with 002): `computeSchemaDiff(oldSchema, newSchema)` returning `SchemaDiff` per FR-008. Uses `normalizeType()` from feature 012 for type compatibility. Pure function, no DB access.
- [ ] T010 [P] Create `src/lib/services/impact-report.ts` (shared with 002): `computeImpactReport(planId, schemaDiff, side: 'source' | 'destination')` returning `ImpactReport` per FR-009. Queries object mappings, field mappings, rules, filters, and documents. Determines which are affected by the diff. For destination side, `filtersToDelete` is always empty (filters are source-only).
- [ ] T011 [P] Create `src/lib/services/reconfiguration.ts` (shared with 002): `applyReconfiguration(planId, side, newAdapterType, newConfig, newSchema)`. Executes in a single Prisma transaction (FR-012): update connection, replace schema snapshot, delete/flag mappings per impact report, mark documents outdated, compute and apply step rollback per FR-015 rules. Log `DESTINATION_RECONFIGURED` with full impact report to audit trail (FR-013).

**Checkpoint**: Schema diff correctly identifies added/removed/type-changed. Impact report correctly lists affected downstream artifacts. Apply function executes atomically.

---

## Phase 5: Reconfiguration — API & UI

- [ ] T012 Create `src/app/api/plans/[planId]/destination/reconfigure/route.ts`: POST handler with `mode` query param. `mode=preview`: authenticate with new config, fetch new schema, compute diff + impact, return preview. `mode=confirm`: re-authenticate, re-compute, apply atomically, return result. Return 401 if auth fails (FR-007 — validate before destructive ops).
- [ ] T013 Create `src/components/destination/ReconfigurationDialog.tsx`: confirmation dialog (FR-010). Displays impact summary in plain French: "N correspondances d'objets supprimees, M correspondances de champs marquees BROKEN, etc." Full list if <= 20 items, else "Voir les details" expander. Cancel and Confirm buttons clearly distinct. Cancel closes dialog without side effects (FR-009 scenario 9).
- [ ] T014 Update `src/app/plans/[planId]/destination/page.tsx`: wire "Reconfigurer" button to enter edit mode (FR-005), pre-fill form with current adapter type and non-secret config (FR-006), on submit call preview endpoint, show `ReconfigurationDialog` if impact non-empty, else apply silently (FR-011). On cancel, restore original view state.

**Checkpoint**: Full reconfiguration flow works: edit mode -> preview -> dialog -> confirm/cancel. Silent apply when no impact. Step rollback visible in sidebar after destructive reconfiguration.

---

## Phase 6: Edge Cases & Integration Tests

- [ ] T015 Handle edge case: adapter type switch (e.g. `demo-destination` -> `hubspot`). Ensure partial-reset logic preserves mappings matching by name + compatible type (FR-014). Write integration test with mixed-match fixture.
- [ ] T016 [P] Handle edge case: empty schema on refresh. Treat as full cascade, dialog warns effectively a full reset. Integration test.
- [ ] T017 [P] Handle edge case: auth failure during reconfiguration. Existing connection and downstream data remain untouched. Error message displayed. Integration test.
- [ ] T018 [P] Handle edge case: no change detected on reconfiguration. No-op, no dialog. Audit logs "refreshed" action. Integration test.
- [ ] T019 Handle edge case: navigation during auto-retrieval (FR-016 edge case). Server-side retrieval continues to completion. Test that snapshot is available on next page load.
- [ ] T020 Write Playwright E2E test: connect demo destination -> verify CONNECTED state -> refresh schema -> verify schema count -> reconfigure with modified demo data -> verify confirmation dialog -> confirm -> verify step rollback.

**Checkpoint**: All edge cases handled. E2E test passes. Feature complete.

---

## Dependencies & Execution Order

- **T001, T002**: No deps beyond prerequisites — start immediately.
- **T003**: Parallel with T001/T002 (needs adapter registry from 000).
- **T004**: Depends on T001, T002.
- **T005**: Depends on T003. Parallel with T004.
- **T006, T007**: Depend on T004 (need API routes).
- **T008**: Depends on T006, T007, T005.
- **T009**: No deps (pure function). Can start in parallel with Phase 2/3.
- **T010, T011**: Depend on T009. Parallel with each other.
- **T012**: Depends on T009, T010, T011.
- **T013**: Depends on T010 (needs ImpactReport type). Parallel with T012.
- **T014**: Depends on T012, T013, T008.
- **T015..T019**: Depend on T014 (full flow must work). Parallel with each other.
- **T020**: Depends on T015..T019 (all edge cases handled).

### Parallel Opportunities

```
Phase 1: [T001 | T002 | T003] all parallel
Phase 2: [T004 | T005] parallel
Phase 3: [T006 | T007] parallel, then T008
Phase 4: T009 first, then [T010 | T011] parallel
Phase 5: [T012 | T013] parallel, then T014
Phase 6: [T015 | T016 | T017 | T018 | T019] parallel, then T020
```
