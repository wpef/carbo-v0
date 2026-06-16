# Contracts: Mapping Integrity Check

## API Routes

All routes are Next.js Route Handlers under `src/app/api/`.

---

### GET /api/plans/[planId]/integrity

Run the integrity check for a plan and return all issues. Idempotent -- re-running produces the same result for the same snapshot state.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `planId` | `string` | Migration plan ID |

**Response 200**:
```typescript
{
  planId: string
  planStatus: 'DRAFT' | 'READY' | 'BROKEN'
  checkedAt: string                        // ISO 8601
  totalIssues: number                      // All issues ever recorded (resolved + unresolved)
  unresolvedIssues: number                 // Only unresolved after this check
  issues: IntegrityIssueDTO[]              // All currently unresolved issues
}
```

**Response 404**: Plan not found.

**Response 500**: Internal error (logged to console per Principle VII).

**Behavior**:
1. Loads the plan with all ObjectMappings (including their FieldMappings and MigrationFilters) from the DB.
2. Loads the CURRENT SchemaSnapshot for the plan's source and destination connections (side=SOURCE/DESTINATION, status=CURRENT).
3. For each ObjectMapping: checks that `sourceObjectName` and `destinationObjectName` exist in the respective CURRENT snapshot. Emits `BROKEN_REFERENCE` if missing.
4. For each FieldMapping under an intact ObjectMapping: checks that `sourceFieldName` and `destinationFieldName` exist in their snapshot object. Emits `BROKEN_REFERENCE` if missing. Also checks type compatibility using the 012 matrix; emits `INCOMPATIBLE_TYPE` if INCOMPATIBLE.
5. For each ObjectMapping: checks that all required (non-read-only) destination fields have at least one FieldMapping. Emits `UNMAPPED_REQUIRED_FIELD` on the ObjectMapping entity if any are missing.
6. For each MigrationFilter: checks that `fieldApiName` exists in the source snapshot object. Emits `INVALID_FILTER` if missing.
7. Upserts all detected issues (idempotent via `@@unique([planId, entityType, entityId, issueType])`).
8. Auto-resolves stale issues (previously active but no longer detected in this run): sets `resolved = true, resolvedAt = NOW()`.
9. Updates `MigrationPlan.status` to BROKEN / DRAFT / READY.
10. Logs the check result to AuditLog (`RUN_INTEGRITY_CHECK`).

---

### PATCH /api/plans/[planId]/integrity/[issueId]

Manually resolve or dismiss a single integrity issue.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `planId` | `string` | Migration plan ID |
| `issueId` | `string` | Integrity issue ID |

**Request Body**:
```typescript
{
  action: 'resolve'                        // Only action for now; extensible
}
```

**Response 200**:
```typescript
{
  issue: IntegrityIssueDTO                 // Updated issue with resolvedAt set
  planStatus: 'DRAFT' | 'READY' | 'BROKEN' // Updated plan status (may transition if this was the last issue)
}
```

**Response 404**: Plan or issue not found.

**Response 409**: Issue already resolved.

**Behavior**:
1. Sets `resolved = true, resolvedAt = NOW()` on the issue.
2. Counts remaining unresolved issues for the plan.
3. If zero remain, transitions plan status from BROKEN to DRAFT (or READY if `currentStep === DOCUMENTS` and previous status was READY).
4. Logs the resolution to AuditLog.

---

### POST /api/plans/[planId]/integrity/resolve-all

Bulk-resolve all unresolved integrity issues for a plan.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `planId` | `string` | Migration plan ID |

**Response 200**:
```typescript
{
  resolvedCount: number
  planStatus: 'DRAFT' | 'READY' | 'BROKEN'
}
```

**Response 404**: Plan not found.

**Behavior**:
1. Updates all unresolved issues for the plan: `SET resolved = true, resolvedAt = NOW() WHERE resolved = false`.
2. Transitions plan status from BROKEN to DRAFT (or READY).
3. Logs the bulk resolution to AuditLog.

**Use case**: After the consultant has fixed all broken mappings (deleted or remapped them), they click "Mark all resolved" to clear the remaining issue records and unblock the plan.

---

## Internal Service API

These functions live in `src/features/integrity/services/integrity-service.ts`. They are called by the route handlers and by trigger hooks elsewhere in the codebase.

### checkIntegrity(planId: string): Promise<IntegrityCheckResult>

Core engine function. Performs the full integrity check. Upserts detected issues, auto-resolves stale ones, updates `MigrationPlan.status`. Called by:
- The GET route handler (on-demand check)
- The schema refresh post-hook (automatic check after refresh)

### checkAndUpdatePlanStatus(planId: string): Promise<void>

Lightweight wrapper around `checkIntegrity`. Non-fatal (errors are caught and logged). Called after every CRUD on ObjectMapping or FieldMapping.

### resolveIssue(planId: string, issueId: string): Promise<{ issue: IntegrityIssueDTO; planStatus: PlanStatus }>

Resolves a single issue. Throws `IssueNotFoundError` (404) or `IssueAlreadyResolvedError` (409). Called by the PATCH route.

### resolveAllForPlan(planId: string): Promise<{ resolvedCount: number; planStatus: PlanStatus }>

Bulk-resolves all issues for a plan. Called by the POST route.

### getUnresolvedIssues(planId: string): Promise<IntegrityIssueDTO[]>

Returns unresolved issues without re-running the check. Used by UI components that need to display current issues without triggering a new scan.

### getIssuesForEntity(entityId: string): Promise<IntegrityIssueDTO[]>

Returns unresolved issues for a specific entity (object mapping, field mapping, etc.). Used by per-mapping UI badges.

### repairBrokenMappings(planId: string): Promise<RepairResult>

Deletes all ObjectMappings and FieldMappings flagged with `BROKEN_REFERENCE`. Explicit user action only (Principle IX — never automatic). Re-runs `checkIntegrity` afterward.

---

## Integration Points

### Trigger: Schema Refresh (003/007)

After a successful schema refresh on a connection, the refresh handler MUST call `runIntegrityCheck(planId)` for every plan that references that connection (`WHERE sourceConnectionId = connectionId OR destinationConnectionId = connectionId`).

```typescript
// In schema refresh handler (003/007):
const affectedPlans = await prisma.migrationPlan.findMany({
  where: {
    OR: [
      { sourceConnectionId: connectionId },
      { destinationConnectionId: connectionId },
    ],
  },
})
for (const plan of affectedPlans) {
  await runIntegrityCheck(plan.id)
}
```

### Gate: Document Generation (019/020)

Before generating client documents, the document service MUST check plan status. If `status === 'BROKEN'`, document generation is blocked with a clear error message.

```typescript
// In document generation service (019/020):
if (plan.status === 'BROKEN') {
  throw new Error('Cannot generate documents for a BROKEN plan. Resolve all integrity issues first.')
}
```

### UI: Per-Mapping Badges (012 Field Mapping View)

The field mapping view queries `getIssuesForEntity(fieldMappingId)` to display a "Broken" badge on affected field mapping rows. The badge links to the issue detail or provides inline resolution actions.
