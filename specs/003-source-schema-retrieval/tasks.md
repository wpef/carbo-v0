# Tasks: Source Schema Retrieval

**Input**: `specs/003-source-schema-retrieval/`
**Prerequisites**: 000-connector-interface (types + demo adapter), 001-migration-plan (MigrationPlan model + audit trail), 002-source-connection (ConnectorConnection model)

---

## Phase 1: Data Layer (Prisma Models)

**Purpose**: Create the database schema for snapshots and objects.

- [ ] T001 Add `SchemaSnapshot` and `SchemaObject` models to `prisma/schema.prisma` per data-model.md. Include the `@@unique([connectionId, status])` constraint on SchemaSnapshot and `@@unique([snapshotId, apiName])` on SchemaObject. Add cascade-delete relations to ConnectorConnection. Run `prisma generate`. *(FR-003, FR-004)*
- [ ] T002 Create and apply the Prisma migration for SchemaSnapshot + SchemaObject tables. Verify the migration runs cleanly on a fresh database. *(FR-003)*

**Checkpoint**: `npx prisma db push` succeeds. SchemaSnapshot and SchemaObject tables exist with correct constraints.

---

## Phase 2: Core Services

**Purpose**: Server-side logic for retrieval, rotation, diff, concurrency, and audit logging.

- [ ] T003 Create `src/features/003-source-schema-retrieval/services/concurrencyGuard.ts`: implement `withRetrievalLock(connectionId, fn)` using `pg_advisory_xact_lock` inside a Prisma `$transaction`. If the lock is already held, throw a typed `RetrievalInProgressError`. *(FR-007)*
- [ ] T004 [P] Create `src/features/003-source-schema-retrieval/services/computeSchemaDiff.ts`: pure function `computeSchemaDiff(current: SchemaObject[], previous: SchemaObject[])` that returns `SchemaDiffResult` (from 000 types). Compare by `apiName` using a Map. Identify added, removed, and modified objects. Modified objects include field-level detail when `ObjectField` data is present on both sides. *(FR-005)*
- [ ] T005 Create `src/features/003-source-schema-retrieval/services/retrieveSchema.ts`: implement `retrieveSchema(planId, role)` that: (1) resolves the connection from the plan, (2) acquires the concurrency lock (T003), (3) calls `adapter.getSchema(connectionId)` to fetch all objects, (4) rotates snapshots atomically (delete PREVIOUS, demote CURRENT to PREVIOUS, insert new CURRENT), (5) computes diff via T004, (6) calls `adapter.getFields()` for each selected object (full chain per FR-010), (7) triggers `checkMappingIntegrity(planId)` (017) per FR-011, (8) logs to audit trail (FR-008). On adapter error, log the failure and re-throw with a clear message (FR-009). *(FR-001, FR-002, FR-003, FR-004, FR-008, FR-009, FR-010, FR-011)*
- [ ] T006 [P] Create `src/features/003-source-schema-retrieval/index.ts`: barrel export for `retrieveSchema`, `computeSchemaDiff`, `detectLiveDrift` (T010), and all drift types. This is the public API of the module. *(Principle VIII — modularity)*

**Checkpoint**: `retrieveSchema` can be called from a test with the demo adapter, creates a CURRENT snapshot, rotates correctly on second call, computes diff, and logs audit event.

---

## Phase 3: Drift Detection (FR-012 to FR-016)

**Purpose**: Read-only live drift detection service and canonical taxonomy types.

- [ ] T007 Create `src/features/003-source-schema-retrieval/types/drift.ts`: define `DRIFT_MODIFICATION_TYPES` constant (12 canonical types with default severities per spec table), `DriftModificationType` type, `DriftSeverity` type, `DriftChange` interface, and `DriftReport` interface. All per data-model.md. *(FR-013)*
- [ ] T008 [P] Create helper `src/features/003-source-schema-retrieval/services/compareFields.ts`: pure function `compareFields(storedFields: ObjectField[], liveFields: ConnectorField[], mappedFieldApiNames: Set<string>)` that returns `DriftChange[]`. Detects: FIELD_ADDED, FIELD_REMOVED, FIELD_TYPE_CHANGED, FIELD_BECAME_REQUIRED, FIELD_BECAME_OPTIONAL, FIELD_LABEL_CHANGED, FIELD_READONLY_CHANGED, FIELD_UNIQUE_CHANGED. Sets `affectsMapping = true` when `fieldApiName` is in `mappedFieldApiNames`. Picklist changes (PICKLIST_VALUE_ADDED/REMOVED) are detected only when the adapter provides picklist metadata. *(FR-013)*
- [ ] T009 [P] Create helper `src/features/003-source-schema-retrieval/services/compareObjects.ts`: pure function `compareObjects(storedObjects: SchemaObject[], liveObjects: ConnectorObject[], mappedObjectApiNames: Set<string>)` that returns `DriftChange[]` for OBJECT_ADDED and OBJECT_REMOVED. Sets `affectsMapping = true` when the object is in `mappedObjectApiNames`. *(FR-013)*
- [ ] T010 Create `src/features/003-source-schema-retrieval/services/detectLiveDrift.ts`: implement `detectLiveDrift(connectionId, role, planId?)` that: (1) loads the CURRENT snapshot + its objects, (2) resolves the adapter from the connection, (3) calls `adapter.getSchema()` to get live objects, (4) calls `compareObjects` (T009) for object-level drift, (5) for each mapped object (from ObjectMapping via planId, per FR-016 scope optimization), calls `adapter.getFields()` and `compareFields` (T008), (6) aggregates all DriftChange[] into a DriftReport with severitySummary. Wraps the entire operation in try/catch: on any failure returns `{ status: 'unavailable', reason }` (FR-015). Must complete within 15s for 20 mapped objects (FR-014). *(FR-012, FR-014, FR-015, FR-016)*

**Checkpoint**: `detectLiveDrift` returns a valid DriftReport with the demo adapter. With a modified demo adapter (simulating added/removed fields), the report correctly categorizes changes. On adapter failure, returns `status: 'unavailable'`.

---

## Phase 4: API Routes

**Purpose**: HTTP endpoints for UI consumption.

- [ ] T011 Create `src/app/api/plans/[planId]/source/schema/route.ts`: GET handler returns CURRENT snapshot with objects; POST handler calls `retrieveSchema(planId, 'source')` and returns snapshot + diff + integrityResult. POST returns 409 on `RetrievalInProgressError`, 502 on adapter errors. Both return 404 if plan has no source connection. *(FR-001..011)*
- [ ] T012 [P] Create `src/app/api/plans/[planId]/source/schema/diff/route.ts`: GET handler loads CURRENT + PREVIOUS snapshots, calls `computeSchemaDiff`, returns diff + `hasPrevious` flag. Returns 404 if no CURRENT snapshot. *(FR-005, FR-006)*
- [ ] T013 [P] Create `src/app/api/plans/[planId]/source/drift/route.ts`: GET handler resolves the source connectionId from the plan, calls `detectLiveDrift(connectionId, 'source', planId)`, returns the DriftReport directly. Returns 404 if no source connection or no CURRENT snapshot. *(FR-012..016)*

**Checkpoint**: All three route groups respond correctly. POST /schema creates a snapshot; GET /schema returns it; GET /diff returns a diff; GET /drift returns a DriftReport.

---

## Phase 5: Tests

**Purpose**: Verify all FRs with realistic fixtures.

- [ ] T014 Create `tests/integration/003-schema-retrieval.test.ts`: integration tests against a real Postgres (Neon branch or Docker). Test cases:
  - First retrieval creates a CURRENT snapshot with correct objectCount (FR-001, FR-003)
  - Second retrieval rotates: old CURRENT becomes PREVIOUS, new is CURRENT (FR-004)
  - Third retrieval deletes old PREVIOUS, only 2 snapshots exist (FR-004)
  - Diff correctly identifies added/removed/modified objects (FR-005)
  - Concurrent retrieval attempt returns 409 (FR-007)
  - Adapter failure preserves existing CURRENT snapshot (FR-009)
  - Audit trail entry created on success and failure (FR-008)
  Use a fixture with 50+ objects including custom objects with descriptions. *(Principle IV)*
- [ ] T015 [P] Create `tests/unit/003-computeSchemaDiff.test.ts`: unit tests for the pure diff function. Test cases:
  - Identical lists: no changes
  - Added objects detected
  - Removed objects detected
  - Modified objects with field changes detected
  - Empty previous list: all objects shown as added
  - Empty current list: all objects shown as removed
- [ ] T016 [P] Create `tests/unit/003-drift-detection.test.ts`: unit tests for `detectLiveDrift` (mocked adapter + mocked DB). Test cases:
  - No drift: returns `{ status: 'ok', changes: [] }` (FR-012)
  - Object added: returns OBJECT_ADDED with severity 'info' (FR-013)
  - Object removed (mapped): returns OBJECT_REMOVED with severity 'critical', affectsMapping=true (FR-013)
  - Field removed on mapped object: returns FIELD_REMOVED with severity 'critical' (FR-013)
  - Field type changed: returns FIELD_TYPE_CHANGED with correct severity (FR-013)
  - Field became required: returns FIELD_BECAME_REQUIRED with severity 'warning' (FR-013)
  - Unmapped object: field-level inspection skipped (FR-016)
  - Adapter failure: returns `{ status: 'unavailable', reason: '...' }` (FR-015)
  - Idempotence: calling twice produces identical results, no side effects (FR-014)
  - severitySummary counts are correct (FR-013)
- [ ] T017 [P] Create `tests/unit/003-compareFields.test.ts`: unit tests for the field comparison helper. Test all 10 field-level modification types from the canonical taxonomy. Verify `affectsMapping` flag is set correctly based on `mappedFieldApiNames`.

**Checkpoint**: All tests pass. 100% FR coverage verified.

---

## Phase 6: Polish

**Purpose**: Observability, edge cases, and cross-cutting concerns.

- [ ] T018 Add console logging to `retrieveSchema`: log retrieval start (connectionId, role), object count fetched, rotation result, diff summary (added/removed/modified counts), integrity check result. *(Principle VII)*
- [ ] T019 [P] Add console logging to `detectLiveDrift`: log drift check start, object count compared, field-level objects inspected, change count by severity, total duration. *(Principle VII)*
- [ ] T020 [P] Handle edge case: connected system has zero objects (spec edge case). Verify snapshot is saved with objectCount=0, no error raised. Add a test case in T014.
- [ ] T021 Handle edge case: first-ever diff shows all objects as "added" (spec edge case). Verify via T015 test case.
- [ ] T022 Update barrel export `src/features/003-source-schema-retrieval/index.ts` (T006) to include all services and types. Verify imports work from a consuming feature (e.g., 001 plan layout would import DriftReport type).

**Checkpoint**: Feature complete. All FRs covered, all edge cases handled, logging in place.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (T001-T002): No internal deps. Requires 000 + 001 + 002 Prisma models to exist.
- **Phase 2** (T003-T006): Depends on Phase 1 (Prisma models).
- **Phase 3** (T007-T010): Depends on Phase 1 (Prisma models). T007 has no deps (types only). T008, T009 depend on T007. T010 depends on T008, T009.
- **Phase 4** (T011-T013): Depends on Phase 2 + Phase 3 (services must exist).
- **Phase 5** (T014-T017): Depends on Phase 2 + Phase 3 + Phase 4 (full stack for integration tests).
- **Phase 6** (T018-T022): Depends on Phase 2 + Phase 3.

### Parallel Opportunities

```
Phase 1: T001 → T002 (sequential)
Phase 2: T003 first, then [T004 | T006] parallel, then T005 (depends on T003 + T004)
Phase 3: T007 first, then [T008 | T009] parallel, then T010 (depends on T008 + T009)
Phase 4: T011 first, then [T012 | T013] parallel
Phase 5: T014 first (integration), then [T015 | T016 | T017] parallel (unit)
Phase 6: [T018 | T019 | T020 | T021 | T022] mostly parallel
```

### FR-to-Task Traceability

| FR | Tasks |
|---|---|
| FR-001 (retrieve all objects) | T005, T011, T014 |
| FR-002 (object metadata) | T001, T005 |
| FR-003 (persist as snapshot) | T001, T002, T005, T014 |
| FR-004 (max 2 snapshots) | T001, T005, T014 |
| FR-005 (compute diff) | T004, T012, T015 |
| FR-006 (display diff) | T012 |
| FR-007 (concurrency guard) | T003, T011, T014 |
| FR-008 (audit trail) | T005, T014 |
| FR-009 (no silent failure) | T005, T011, T014 |
| FR-010 (full chain) | T005, T011 |
| FR-011 (integrity check trigger) | T005, T011 |
| FR-012 (detectLiveDrift service) | T010, T013, T016 |
| FR-013 (canonical taxonomy) | T007, T008, T009, T016, T017 |
| FR-014 (idempotence + budget) | T010, T016 |
| FR-015 (graceful failure) | T010, T013, T016 |
| FR-016 (scope optimization) | T010, T016 |
