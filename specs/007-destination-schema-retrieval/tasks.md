# Tasks: Destination Schema Retrieval

**Input**: `specs/007-destination-schema-retrieval/`
**Prerequisites**: 003-source-schema-retrieval (SchemaSnapshot + SchemaObject entities, schema service, diff logic), 006-destination-connection (destination connection exists on plan)

## Phase 1: Setup — Ensure Shared Service is Generic

- [ ] T001 Verify `src/lib/services/schema-retrieval.service.ts` from 003 is connection-agnostic (accepts `connectionId`, not hardcoded to source role). If source-specific, refactor to remove role assumption. The service should: accept connectionId, resolve adapter from connection, call `getSchema()`, persist snapshot with CURRENT/PREVIOUS rotation, compute diff

## Phase 2: US1 — Retrieve Destination Schema (P1)

**Goal**: Consultant retrieves the full destination object list after connection.

**Independent Test**: POST to `/api/plans/:id/destination-schema` returns snapshot with all destination objects.

- [ ] T002 Implement HubSpot `getSchema()` in `src/lib/connectors/adapters/hubspot/index.ts` — retrieve standard objects (contacts, companies, deals, tickets) via specific APIs + custom objects via schemas API. Normalize to `ConnectorObject[]`
- [ ] T003 [P] Implement demo destination `getSchema()` in `src/lib/connectors/adapters/demo-destination/index.ts` — return pre-seeded list of ~10 HubSpot-like objects (contacts, companies, deals, tickets, products, line_items, quotes, plus 2-3 custom objects)
- [ ] T004 Create route handler `src/app/api/plans/[planId]/destination-schema/route.ts` — POST (retrieve/refresh), GET (current). Validates destination connection exists. Delegates to schema-retrieval service. Returns snapshot + objects + diff. Handles 409 for concurrent retrieval
- [ ] T005 Extract shared schema UI components if needed — move `object-list.tsx` and `schema-diff.tsx` to `src/components/schema/` if they were created under `src/components/source/` in 003. Ensure they accept generic props (objects array, diff result)
- [ ] T006 Create destination schema page `src/app/plans/[planId]/destination/schema/page.tsx` — "Retrieve Schema" button, object list display, diff display on refresh. Uses shared `object-list.tsx` and `schema-diff.tsx`

## Phase 3: Polish

- [ ] T007 Add workflow navigation in destination schema page — after retrieval, show "Schema retrieved (N objects). Next: [View Fields]" linking to field retrieval

---

## Dependencies & Execution Order

- **Phase 1** (T001): Must complete first — ensures shared service is ready.
- **Phase 2** (T002, T003): Parallel — adapter implementations. T004 depends on T001 + adapter being ready. T005 depends on 003 components existing. T006 depends on T004 + T005.
- **Phase 3** (T007): Depends on T006.
