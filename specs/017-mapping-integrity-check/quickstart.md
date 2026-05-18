# Quickstart: Mapping Integrity Check

## What this feature provides

An automated integrity engine that detects broken mappings after schema refresh. It flags deleted objects/fields, incompatible type changes, orphaned filters, and broken rule references. The plan status transitions to BROKEN until the consultant resolves all issues manually.

## How to use

### 1. Check integrity on demand

```typescript
// GET /api/plans/[planId]/integrity
const res = await fetch(`/api/plans/${planId}/integrity`)
const result: IntegrityCheckResult = await res.json()

console.log(result.planStatus)        // 'BROKEN' | 'DRAFT' | 'READY'
console.log(result.unresolvedIssues)  // number of issues to fix
console.log(result.issues)            // IntegrityIssueDTO[]
```

### 2. Display per-entity broken badges

```typescript
import { getIssuesForEntity } from '@/lib/services/integrity'

// In a field mapping row component:
const issues = await getIssuesForEntity(fieldMapping.id)
const isBroken = issues.length > 0
// Render red "Broken" badge if isBroken
```

### 3. Resolve a single issue

```typescript
// PATCH /api/plans/[planId]/integrity/[issueId]
await fetch(`/api/plans/${planId}/integrity/${issueId}`, {
  method: 'PATCH',
  body: JSON.stringify({ action: 'resolve' }),
})
```

### 4. Bulk resolve all issues

```typescript
// POST /api/plans/[planId]/integrity/resolve-all
await fetch(`/api/plans/${planId}/integrity/resolve-all`, {
  method: 'POST',
})
```

### 5. Automatic trigger after schema refresh

The integrity check is automatically triggered by the schema refresh handler. No manual integration needed -- feature 003/007 refresh handlers call `runIntegrityCheck(planId)` for all affected plans.

## Key behavior

- **apiName resolution**: Mappings are resolved against the current schema snapshot by `apiName`, not by stored FK IDs. This is the only reliable method after snapshot rotation.
- **No auto-repair**: The system never re-binds FKs, auto-remaps by name similarity, or auto-deletes broken mappings. All resolution is consultant-driven (Principle IX).
- **Idempotent**: Re-running the check on the same snapshot state produces the same issues. No duplicate issues are created (enforced by unique constraint).
- **Status gating**: A BROKEN plan blocks document generation (019/020). The consultant must resolve all issues before proceeding.

## Dependencies

- **Depends on**: 001 (MigrationPlan + AuditLog), 011 (ObjectMapping), 012 (FieldMapping + type compatibility matrix), 013 (MigrationLogic + MigrationFilter)
- **Triggered by**: 003 (source schema refresh), 007 (destination schema refresh)
- **Gates**: 019 (text documents), 020 (contractual documents) -- BROKEN status blocks generation
- **Consumed by**: 011 (object mapping view drift badges), 012 (field mapping view broken badges)
