# Tasks: Destination Schema Retrieval

**Input**: `specs/007-destination-schema-retrieval/`
**Prerequisites**: 000 (ConnectorAdapter types), 001 (MigrationPlan + AuditLog), 006 (destination ConnectorConnection)

## Phase 1: Shared Infrastructure (extends 003 foundations)

**Purpose**: Ensure shared Prisma models and service functions support destination side.

- [ ] T001 Verify `SchemaSnapshot` Prisma model includes `side` field (`String`, values: `'source' | 'destination'`). Add unique constraint `@@unique([connectionId, side, status])` and index `@@index([connectionId, side])` if not already present. Run `prisma generate`. File: `prisma/schema.prisma`
- [ ] T002 [P] Verify `SchemaObject` and `ObjectField` Prisma models exist (shared with 003/005). No destination-specific changes needed — confirm `isSelected` defaults to `true`. File: `prisma/schema.prisma`
- [ ] T003 [P] Create or extend shared snapshot rotation service: `rotateSnapshots(connectionId, side)` — delete PREVIOUS, demote CURRENT to PREVIOUS, return void. Must run inside a Prisma transaction. File: `src/lib/services/schema-snapshot.ts`
- [ ] T004 [P] Create or extend shared schema diff service: `computeSchemaDiff(currentSnapshot, previousSnapshot)` — returns `SchemaDiffResult` (added/removed/modified objects with field-level detail). File: `src/lib/services/schema-diff.ts`

**Checkpoint**: Shared models compile, rotation + diff services have unit tests passing.

---

## Phase 2: Destination Schema Retrieval (US1 — FR-001, FR-002, FR-003, FR-004)

**Goal**: Consultant can retrieve the full destination schema (objects + fields) in one chain.

**Independent Test**: After connecting a destination, trigger schema retrieval and verify all objects with fields are stored as a CURRENT snapshot.

- [ ] T005 Create `fetchDestinationSchema(connectionId)` service function. Logic: call `adapter.getSchema(connectionId)` to get all objects, then `adapter.getFields(connectionId, objectApiName)` for EVERY object (no selection step), store as CURRENT snapshot with `side='destination'` and all objects with `isSelected=true`. Log to audit trail. File: `src/features/007-destination-schema/services/fetch-destination-schema.ts`
- [ ] T006 Create `POST /api/plans/[planId]/destination/schema` route handler. Validate: destination connection exists and is CONNECTED, no CURRENT snapshot yet. Call `fetchDestinationSchema`. Return snapshot summary + field counts. File: `src/app/api/plans/[planId]/destination/schema/route.ts`
- [ ] T007 [P] Create `GET /api/plans/[planId]/destination/schema` route handler. Return CURRENT snapshot with objects (including fieldCount per object) and previousSnapshot metadata if exists. File: `src/app/api/plans/[planId]/destination/schema/route.ts` (same file as T006, GET handler)
- [ ] T008 Add concurrency guard: prevent concurrent schema retrievals for the same connection. Use a per-connection in-memory lock or DB flag. File: `src/features/007-destination-schema/services/fetch-destination-schema.ts`

**Checkpoint**: `POST /schema` stores a complete CURRENT snapshot with objects and fields. `GET /schema` returns it. Concurrent calls rejected with 409.

---

## Phase 3: Refresh with Diff + Integrity Check (US2 — FR-002, FR-004, FR-005)

**Goal**: Consultant can refresh the destination schema with snapshot rotation, diff display, and integrity check.

**Independent Test**: With an existing CURRENT snapshot, refresh the schema, verify CURRENT/PREVIOUS rotation, diff computed, and integrity check triggered.

- [ ] T009 Create `refreshDestinationSchema(connectionId, planId)` service function. Logic: fetch live schema + fields (full chain), call `rotateSnapshots(connectionId, 'destination')`, insert new CURRENT, compute diff via `computeSchemaDiff`, call `checkMappingIntegrity(planId)` (feature 017 — stub if not yet implemented), log to audit trail. Return `{ snapshot, diff, integrityResult }`. File: `src/features/007-destination-schema/services/fetch-destination-schema.ts`
- [ ] T010 Create `POST /api/plans/[planId]/destination/schema/refresh` route handler. Validate: destination CONNECTED, CURRENT snapshot exists. Call `refreshDestinationSchema`. Return snapshot + diff + integrity result. Apply concurrency guard. File: `src/app/api/plans/[planId]/destination/schema/refresh/route.ts`
- [ ] T011 Handle edge case: first-ever refresh (no PREVIOUS after rotation because there was no PREVIOUS before). Diff should show all objects as "added" (empty baseline). File: `src/features/007-destination-schema/services/fetch-destination-schema.ts`

**Checkpoint**: Refresh rotates snapshots correctly, diff is accurate, integrity check fires. BROKEN mappings flag the plan as BROKEN.

---

## Phase 4: Drift Detection — Destination Side (FR-D-006)

**Goal**: `detectLiveDrift(connectionId, 'destination')` works and returns destination-tuned severity.

**Independent Test**: With a stored CURRENT snapshot and a simulated live schema change (e.g., field became required), drift detection returns a DriftReport with `severity: 'warning'` for the destination-specific case.

- [ ] T012 Create or extend `detectLiveDrift(connectionId, role)` shared service. Logic: fetch live schema via adapter (object list + fields for mapped objects only per FR-016 budget rule), compare against CURRENT snapshot using canonical taxonomy from spec 003. Return `DriftReport`. Read-only: no DB writes. Graceful failure: return `{ status: 'unavailable', reason }` on adapter error. File: `src/lib/services/drift-detection.ts`
- [ ] T013 Create destination drift wrapper `detectDestinationDrift(connectionId, planId)`. Logic: call `detectLiveDrift(connectionId, 'destination')`, apply destination-specific severity tuning: `FIELD_BECAME_REQUIRED` -> ensure `warning`, `FIELD_READONLY_CHANGED` (to readOnly=true) -> ensure `warning` with message "write will fail", `FIELD_UNIQUE_CHANGED` (to unique=true) -> ensure `warning` with message "duplicate writes will fail". Scope: inspect all objects at object-level, field-level only for objects referenced by existing mappings. File: `src/features/007-destination-schema/services/destination-drift.ts`
- [ ] T014 Create `GET /api/plans/[planId]/destination/drift` route handler. Call `detectDestinationDrift`. Return DriftReport as JSON. 404 if no destination connection or no CURRENT snapshot. File: `src/app/api/plans/[planId]/destination/drift/route.ts`
- [ ] T015 [P] Create `DriftTypeId` enum and `DriftReport`/`DriftChange` types at `src/lib/types/drift.ts` if not already created by 003. Ensure all 12 canonical types from spec 003 are present. File: `src/lib/types/drift.ts`

**Checkpoint**: `GET /drift` returns accurate DriftReport with destination severity tuning. Unavailable case returns structured error, never throws.

---

## Phase 5: UI — Schema Page (Acceptance Scenarios 1-4)

**Goal**: Consultant sees destination objects with badges, can refresh, sees diff and broken mapping warnings.

- [ ] T016 Create destination schema page shell: `src/app/plans/[planId]/destination/schema/page.tsx`. Server component that fetches current snapshot and renders client orchestrator.
- [ ] T017 Create `DestinationSchemaPage` client component. States: loading, empty (no snapshot — trigger retrieval), loaded (object list + optional diff). Refresh button triggers `POST /refresh`. File: `src/features/007-destination-schema/components/destination-schema-page.tsx`
- [ ] T018 [P] Create `DestinationObjectList` component. Display objects with: label, apiName, standard/custom badge (based on `isCustom`), description, field count. File: `src/features/007-destination-schema/components/destination-object-list.tsx`
- [ ] T019 [P] Create `DestinationSchemaDiff` component. Display diff: added objects (green badge), removed objects (red badge + warning), modified objects (expandable with field-level changes). Show "No changes detected" when diff is empty. File: `src/features/007-destination-schema/components/destination-schema-diff.tsx`
- [ ] T020 Create `useDestinationSchema` hook. Fetches `GET /schema` on mount, exposes `refresh()` mutation that calls `POST /refresh` and updates state with diff + integrity result. File: `src/features/007-destination-schema/hooks/use-destination-schema.ts`
- [ ] T021 Wire integrity check result into UI: if `integrityResult.planStatus === 'BROKEN'`, display a warning banner on the schema page listing broken mappings with reasons. File: `src/features/007-destination-schema/components/destination-schema-page.tsx`

**Checkpoint**: Full UI flow works: view objects, refresh, see diff, see broken mapping warnings.

---

## Phase 6: Integration with Plan Layout (Acceptance Scenarios 5-6)

**Goal**: Destination drift report is merged with source report in the plan-level banner.

- [ ] T022 Ensure the plan layout drift detection (feature 001) calls `GET /destination/drift` in parallel with `GET /source/drift` on plan visit. Merge both DriftReports into a single plan-level report. File: `src/features/plans/hooks/use-drift-detection.ts` (extends existing hook)
- [ ] T023 [P] Ensure drift-badge on the Destination step in the sidebar shows destination-specific severity counts from the merged drift report. File: `src/features/plans/components/drift-badge.tsx` + `src/features/plans/lib/drift-utils.ts`

**Checkpoint**: Plan-level banner shows merged source + destination drift. Sidebar badge reflects destination drift severity.

---

## Phase 7: Audit & Polish

- [ ] T024 Verify all schema retrieval events (initial, refresh, success, failure) are logged to audit trail with: action type, connectionId, objectCount, fieldCounts, diff summary. File: `src/features/007-destination-schema/services/fetch-destination-schema.ts`
- [ ] T025 [P] Add console logs at each step: adapter call start/end, object count, field fetch per object (with timing), snapshot rotation, diff computation, integrity check result. File: all service files in `src/features/007-destination-schema/services/`
- [ ] T026 [P] Handle error edge cases: adapter timeout, partial field retrieval failure (log and continue with successful objects), empty schema (store empty snapshot, no error). File: `src/features/007-destination-schema/services/fetch-destination-schema.ts`

**Checkpoint**: Audit trail complete, console logs traceable, error handling robust.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Shared Infrastructure): Can start immediately if 003 shared models exist; otherwise creates them.
- **Phase 2** (Schema Retrieval): Depends on Phase 1 completion.
- **Phase 3** (Refresh + Integrity): Depends on Phase 2 (needs existing CURRENT snapshot to rotate).
- **Phase 4** (Drift Detection): Depends on Phase 1 (shared types) + Phase 2 (needs CURRENT snapshot). Can run in parallel with Phase 3.
- **Phase 5** (UI): Depends on Phase 2 + Phase 3 (needs API routes).
- **Phase 6** (Plan Layout Integration): Depends on Phase 4 (needs drift endpoint) + feature 001 layout.
- **Phase 7** (Polish): Depends on all previous phases.

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003 | T004] parallel
Phase 2: T005 -> T006, [T007 | T008] parallel after T006
Phase 3: T009 -> T010, T011 parallel with T010
Phase 4: [T012 | T015] parallel -> T013 -> T014
Phase 5: T016 -> T017, [T018 | T019 | T020] parallel -> T021
Phase 6: [T022 | T023] parallel
Phase 7: [T024 | T025 | T026] parallel
```

### Cross-Feature Dependencies

- `checkMappingIntegrity(planId)` from feature 017 — stub if not yet implemented (return `{ planStatus: 'DRAFT', brokenMappings: [] }`)
- `detectLiveDrift` shared service — created here or by 003, whichever implements first
- Plan layout drift hook (feature 001) — extended in Phase 6
