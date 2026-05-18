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
  totalIssues: number                      // All issues (resolved + unresolved)
  unresolvedIssues: number                 // Only unresolved
  issues: IntegrityIssueDTO[]              // All unresolved issues
}
```

**Response 404**: Plan not found.

**Response 500**: Internal error (logged to console per Principle VII).

**Behavior**:
1. Loads the plan with all ObjectMappings, FieldMappings, MigrationFilters, MigrationLogic rules.
2. Loads the CURRENT schema snapshot for the plan's source and destination connections.
3. For each ObjectMapping: resolves `sourceObjectApiName` and `destObjectApiName` against the current snapshot.
4. For each FieldMapping: resolves `sourceFieldApiName` and `destFieldApiName` against the current snapshot. Also checks type compatibility using the 012 matrix.
5. For each MigrationFilter: resolves the referenced source field apiName.
6. For each FIELD_REFERENCE MigrationLogic rule: resolves the referenced source field apiName.
7. Creates new `IntegrityIssue` records for newly detected problems (upsert to avoid duplicates).
8. Auto-resolves any previously detected issues that are no longer present (sets `resolvedAt`).
9. Transitions plan status to BROKEN if unresolved issues > 0, or back to DRAFT/READY if all resolved.
10. Logs the check result to AuditLog.

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
1. Sets `resolvedAt = NOW()` on the issue.
2. Counts remaining unresolved issues for the plan.
3. If zero remain, transitions plan status from BROKEN to DRAFT (or READY if all steps complete).
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
1. Updates all unresolved issues for the plan: `SET resolvedAt = NOW() WHERE resolvedAt IS NULL`.
2. Transitions plan status from BROKEN to DRAFT (or READY).
3. Logs the bulk resolution to AuditLog.

**Use case**: After the consultant has fixed all broken mappings (deleted or remapped them), they click "Mark all resolved" to clear the remaining issue records and unblock the plan.

---

## Internal Service API

These functions are called by the schema refresh handlers (003/007) and by the API routes above.

### checkEngine.runIntegrityCheck(planId: string): Promise<IntegrityCheckResult>

Core engine function. Performs the full integrity check as described in the GET route behavior. Called by:
- The GET route handler (on-demand check)
- The schema refresh post-hook (automatic check after refresh)

### issueResolver.resolveIssue(issueId: string): Promise<{ issue: IntegrityIssue; planStatus: PlanStatus }>

Resolves a single issue. Called by the PATCH route.

### issueResolver.resolveAllForPlan(planId: string): Promise<{ resolvedCount: number; planStatus: PlanStatus }>

Bulk-resolves all issues for a plan. Called by the POST route.

### checkEngine.getUnresolvedIssues(planId: string): Promise<IntegrityIssueDTO[]>

Returns unresolved issues without re-running the check. Used by UI components that need to display current issues without triggering a new scan.

### checkEngine.getIssuesForEntity(entityId: string): Promise<IntegrityIssueDTO[]>

Returns unresolved issues for a specific entity (object mapping, field mapping, etc.). Used by per-mapping UI badges.

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
