# Tasks: Source Schema Retrieval

**Input**: `specs/003-source-schema-retrieval/`
**Prerequisites**: 002-source-connection (SourceConnection model + API)

---

## Phase 1: Data Layer

- [ ] T001 [US1] Add `SchemaSnapshot` and `SchemaObject` models to `prisma/schema.prisma`. SchemaSnapshot: id, connectionId, status (CURRENT/PREVIOUS), objectCount, retrievedAt. SchemaObject: id, snapshotId, apiName, label, description, isCustom. Add @@unique([snapshotId, apiName]). Run `prisma migrate dev`.

---

## Phase 2: Service Layer

- [ ] T002 [US1] Create `src/lib/services/schema-retrieval.ts`: implement `retrieveSchema(connectionId)` -- calls adapter.getSchema(), rotates snapshots (delete PREVIOUS, demote CURRENT, insert new as CURRENT), persists SchemaObjects. Sets connection status to RETRIEVING during operation. Logs to audit trail.
- [ ] T003 [US1] In same service, implement `getSnapshot(connectionId, status?)` -- returns CURRENT snapshot with its objects. If status param given, returns that specific snapshot.
- [ ] T004 [US1] In same service, implement `computeDiff(connectionId)` -- loads CURRENT and PREVIOUS snapshots, computes added/removed/modified by comparing apiName sets. Returns SchemaDiff or null if no PREVIOUS.
- [ ] T005 [US1] Create `src/lib/types/schema.ts`: export TypeScript types for SchemaDiff (added, removed, modified, unchanged).

---

## Phase 3: API Routes

- [ ] T006 [P] [US1] Create `src/app/api/plans/[planId]/source/schema/route.ts`: implement POST handler -- validates connection exists and is CONNECTED (not RETRIEVING), calls `retrieveSchema`, computes diff, returns 201 with snapshot + objects + diff per contract.
- [ ] T007 [P] [US1] In same route file, implement GET handler -- calls `getSnapshot`, returns current snapshot with objects per contract.
- [ ] T008 [US1] Create `src/app/api/plans/[planId]/source/schema/diff/route.ts`: implement GET handler -- calls `computeDiff`, returns diff per contract.

---

## Phase 4: UI Components

- [ ] T009 [P] [US1] Create `src/components/schema/ObjectList.tsx`: renders a list of SchemaObjects showing label, apiName, isCustom badge, and description. Accepts objects array as prop.
- [ ] T010 [P] [US1] Create `src/components/schema/SchemaDiff.tsx`: renders diff results -- added (green), removed (red with warning), modified (yellow with change details), unchanged count. Handles null diff (first retrieval).
- [ ] T011 [P] [US1] Create `src/components/schema/SchemaRetrievalButton.tsx`: button that triggers POST, shows loading spinner during retrieval, disabled when already retrieving.

---

## Phase 5: Page Integration

- [ ] T012 [US1] Create `src/app/plans/[planId]/source/schema/page.tsx`: schema retrieval step page. Shows SchemaRetrievalButton, ObjectList (from CURRENT snapshot), and SchemaDiff (after refresh). Shows empty state if no snapshot yet.
- [ ] T013 [US1] Create `src/hooks/use-schema.ts`: React hook wrapping schema API calls (retrieve, get snapshot, get diff) with loading/error states.

---

## Dependencies & Execution Order

- **Phase 1** (T001): Requires 002 SourceConnection model in schema.
- **Phase 2** (T002-T005): Depends on T001. T005 is [P] with T002-T004 (types file, no dependency).
- **Phase 3** (T006-T008): Depends on T002-T005. T006/T007 are [P] (same file, independent handlers).
- **Phase 4** (T009-T011): No backend dependency. All [P].
- **Phase 5** (T012-T013): Depends on Phase 3 and Phase 4.
