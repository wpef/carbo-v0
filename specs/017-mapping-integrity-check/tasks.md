# Tasks: Mapping Integrity Check

**Input**: `specs/017-mapping-integrity-check/`
**Prerequisites**: 001 (MigrationPlan), 011 (ObjectMapping), 012 (FieldMapping + type compatibility matrix), 013 (MigrationLogic)

## Phase 1: Types & Data Model

- [ ] T001 Create `src/lib/types/integrity.ts`: define TypeScript types for IntegrityEntityType, IntegrityIssueType, IntegrityIssueDTO, IntegrityCheckResult. All per data-model.md. Include JSDoc on each type with FR reference.
- [ ] T002 Add `IntegrityIssue` model to Prisma schema: IntegrityEntityType enum, IntegrityIssueType enum, IntegrityIssue model with all fields per data-model.md. Add relation `IntegrityIssue[] -> MigrationPlan`. Run `prisma generate` (do NOT run migrate yet -- migration is batched).
- [ ] T003 [P] Create Prisma migration for the IntegrityIssue table. Run `prisma migrate dev --name add-integrity-issues`. Verify the migration applies cleanly.

**Checkpoint**: Types compile, Prisma schema valid, migration applied. `npx prisma studio` shows the `integrity_issues` table.

---

## Phase 2: Check Engine & Service Layer

- [ ] T004 Create `src/lib/services/integrity/check-engine.ts`: implement `runIntegrityCheck(planId)`. The function MUST:
  1. Load the plan with all ObjectMappings (include FieldMappings, MigrationFilters, MigrationLogic rules).
  2. Load the CURRENT schema snapshot objects and fields for the plan's source and destination connections.
  3. For each ObjectMapping: resolve `sourceObjectApiName` against current source snapshot objects. If not found, create issue (SOURCE_OBJECT_DELETED). Same for `destObjectApiName` against destination snapshot.
  4. For each FieldMapping (under a non-broken ObjectMapping): resolve `sourceFieldApiName` against current source fields. If not found, create issue (SOURCE_FIELD_DELETED). Same for `destFieldApiName`. If both exist, check type compatibility using 012's matrix -- if the refreshed type combination is INCOMPATIBLE (and was not before), create issue (TYPE_CHANGE_INCOMPATIBLE).
  5. For each MigrationFilter: resolve `sourceFieldApiName` against current source fields. If not found, create issue with entityType=MIGRATION_FILTER.
  6. For each FIELD_REFERENCE MigrationLogic rule: resolve the referenced field apiName. If not found, create issue with entityType=TRANSFORMATION_RULE.
  7. Upsert issues (use the unique constraint to avoid duplicates).
  8. Auto-resolve issues that were previously detected but are no longer present (set `resolvedAt`).
  9. Count unresolved issues. If > 0, set plan status = BROKEN. If = 0, set plan status = DRAFT (or READY based on step completion).
  10. Log the check result to AuditLog (action: 'INTEGRITY_CHECK', details: { issuesFound, issuesResolved, planStatus }).
  11. Return IntegrityCheckResult.
  Console-log at each phase: "Integrity check started for plan X", "Checking N object mappings, M field mappings", "Found K new issues, resolved J", "Plan status: BROKEN/DRAFT/READY".

- [ ] T005 Create `src/lib/services/integrity/issue-resolver.ts`: implement `resolveIssue(issueId)` and `resolveAllForPlan(planId)`. Each MUST:
  1. Set `resolvedAt = NOW()`.
  2. Count remaining unresolved issues for the plan.
  3. If zero remain, transition plan status from BROKEN to DRAFT (or READY).
  4. Log the resolution to AuditLog.
  5. Return updated issue + plan status.

- [ ] T006 [P] Create `src/lib/services/integrity/index.ts`: barrel export for `runIntegrityCheck`, `resolveIssue`, `resolveAllForPlan`, `getUnresolvedIssues`, `getIssuesForEntity`.

- [ ] T007 Implement `getUnresolvedIssues(planId)` and `getIssuesForEntity(entityId)` in the check engine. These are read-only queries -- no check re-run. `getUnresolvedIssues` returns all issues where `resolvedAt IS NULL` for the plan. `getIssuesForEntity` returns all unresolved issues for a specific entity ID.

**Checkpoint**: Service functions can be called from a test script. `runIntegrityCheck` returns correct results for a plan with known broken mappings.

---

## Phase 3: API Routes

- [ ] T008 Create `src/app/api/plans/[planId]/integrity/route.ts`: GET handler that calls `runIntegrityCheck(planId)` and returns `IntegrityCheckResult`. Validate `planId` exists (404 if not). Log errors to console (Principle VII). Return 200 with result or 500 on error.

- [ ] T009 Create `src/app/api/plans/[planId]/integrity/[issueId]/route.ts`: PATCH handler that calls `resolveIssue(issueId)`. Validate `planId` and `issueId` exist (404 if not). Return 409 if already resolved. Return 200 with updated issue + plan status.

- [ ] T010 [P] Create `src/app/api/plans/[planId]/integrity/resolve-all/route.ts`: POST handler that calls `resolveAllForPlan(planId)`. Validate `planId` exists. Return 200 with `{ resolvedCount, planStatus }`.

**Checkpoint**: All three routes respond correctly via manual HTTP calls or Vitest integration tests.

---

## Phase 4: Integration with Schema Refresh

- [ ] T011 Modify the schema refresh handler (feature 003/007) to call `runIntegrityCheck(planId)` for all plans referencing the refreshed connection. After the schema refresh completes successfully, query `MigrationPlan WHERE sourceConnectionId = connectionId OR destinationConnectionId = connectionId`, then iterate and call `runIntegrityCheck` for each. This wiring connects the trigger to the engine.

**Checkpoint**: Refreshing a schema on a connection automatically flags broken mappings in all associated plans.

---

## Phase 5: Tests

- [ ] T012 Create `tests/unit/services/integrity/check-engine.test.ts`: unit tests for `runIntegrityCheck`. Test cases MUST include:
  1. Plan with no broken mappings -> 0 issues, status stays DRAFT.
  2. Source object deleted -> ObjectMapping flagged SOURCE_OBJECT_DELETED, all child FieldMappings also flagged.
  3. Destination object deleted -> ObjectMapping flagged DESTINATION_OBJECT_DELETED.
  4. Source field deleted -> FieldMapping flagged SOURCE_FIELD_DELETED.
  5. Destination field deleted -> FieldMapping flagged DESTINATION_PROPERTY_DELETED.
  6. Type change incompatible (string -> boolean) -> FieldMapping flagged TYPE_CHANGE_INCOMPATIBLE with context { oldType, newType }.
  7. Type change compatible (string -> text) -> no issue created.
  8. MigrationFilter referencing deleted source field -> flagged REFERENCED_FIELD_DELETED.
  9. FIELD_REFERENCE rule referencing deleted field -> flagged REFERENCED_FIELD_DELETED.
  10. Re-running check on unchanged snapshot -> no duplicate issues (idempotent).
  11. Issue auto-resolved when the cause disappears (field reappears in next refresh).
  12. Plan status transitions: DRAFT -> BROKEN when issues found, BROKEN -> DRAFT when all resolved.
  Use realistic fixtures: 10 object mappings, 200 field mappings, mix of compatible and incompatible types. Prisma mock or test DB.

- [ ] T013 [P] Create `tests/unit/services/integrity/issue-resolver.test.ts`: unit tests for `resolveIssue` and `resolveAllForPlan`. Test: single resolution, bulk resolution, plan status transition after last issue resolved, 409 on already-resolved issue.

- [ ] T014 Create `tests/integration/integrity/api-routes.test.ts`: integration tests against real Postgres. Test: GET returns correct issues, PATCH resolves an issue, POST resolve-all clears all issues, 404 on invalid planId/issueId. Use a seeded plan with known broken mappings.

**Checkpoint**: All tests pass. Feature complete from backend perspective.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately.
- **T002**: Depends on T001 (types referenced in schema).
- **T003**: Depends on T002 (schema must be valid before migration).
- **T004**: Depends on T001, T003 (needs types + DB table). Core task.
- **T005**: Depends on T001, T003 (needs types + DB table).
- **T006**: Depends on T004, T005 (barrel exports both).
- **T007**: Depends on T004 (read queries extend check engine module).
- **T008**: Depends on T004, T006 (route calls service).
- **T009**: Depends on T005, T006 (route calls resolver).
- **T010**: Depends on T005, T006 (route calls resolver). Parallel with T009.
- **T011**: Depends on T004 (wires trigger). Can overlap with T008-T010.
- **T012**: Depends on T004 (tests the engine).
- **T013**: Depends on T005 (tests the resolver). Parallel with T012.
- **T014**: Depends on T008, T009, T010 (tests the routes).

### Parallel Opportunities

```
Phase 1: T001 -> T002 -> T003
Phase 2: [T004 | T005] -> T006, T007
Phase 3: [T008 | T009 | T010]
Phase 4: T011
Phase 5: [T012 | T013] -> T014
```
