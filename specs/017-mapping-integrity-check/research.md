# Research: Mapping Integrity Check

## Decision 1: Integrity Issue Persistence

**Options**:
- **Transient (compute on demand)**: Recalculate issues every time the plan is viewed. No storage needed but slow for large plans.
- **Persisted**: Store IntegrityIssue records in DB. Fast reads, survives page reload, queryable.
- **Hybrid**: Compute and cache, invalidate on mapping changes.

**Decision**: Persisted. The spec explicitly states "integrity issues are persisted so the consultant can view them across sessions without requiring a re-check." IntegrityIssue records are created during the integrity check and deleted when resolved (mapping removed or remapped).

## Decision 2: Trigger Mechanism

**Options**:
- **Automatic on schema refresh**: IntegrityCheckService is called at the end of schema refresh (features 003, 007). No manual trigger needed.
- **Manual only**: Consultant clicks "Check Integrity" button. Risk of stale data.
- **Both**: Automatic + manual re-check button.

**Decision**: Both. The primary trigger is automatic (schema refresh calls `integrityCheck.run(planId)` at the end). A manual POST endpoint is also available for the consultant to re-check on demand. The schema refresh features (003, 007) import and call IntegrityCheckService -- this is the integration point.

## Decision 3: Issue Resolution Detection

When the consultant fixes a broken mapping (remaps the field or removes the mapping), how is the IntegrityIssue resolved?

**Options**:
- **Explicit resolution**: Consultant clicks "resolve" on each issue. Tedious.
- **Automatic on mapping change**: When a FieldMapping or ObjectMapping is created/updated/deleted, re-run integrity check for affected entities.
- **Re-check on demand**: Resolution happens when the integrity check is re-run.

**Decision**: Automatic on mapping change + re-check. When the FieldMappingService or ObjectMappingService performs a delete or create, it calls `integrityCheck.resolveForEntity(entityId)` to clear matching IntegrityIssues. When all issues for a plan are resolved, the plan status transitions back from BROKEN. A full re-check (POST endpoint) can also be triggered manually to catch all resolutions at once.

## Decision 4: Check Scope

The integrity check compares the **current schema snapshot** against the **mapping plan's references**. It does NOT diff two schema versions. This means:

1. For each ObjectMapping: check if sourceObjectName exists in source schema and destinationObjectName exists in dest schema.
2. For each FieldMapping: check if sourceFieldName exists in source object's fields and destinationFieldName exists in dest object's fields.
3. For each FieldMapping: if field types have changed, re-evaluate compatibility via the type compatibility matrix (012).
4. For each MigrationFilter: check if sourceFieldName exists in source object's fields.

This is a pure comparison against the latest schema snapshot. The check does NOT need the previous schema.

## Decision 5: Multiple Plans per Connection

The spec states: "Multiple plans reference the same connection: all plans are checked." The schema refresh feature stores the connection at the plan level (MigrationPlan.sourceConnectionId / destinationConnectionId). When a schema refresh occurs on connection X, the integrity check queries all plans with that connectionId and runs checks for each.

## Decision 6: Plan Status State Machine

```
DRAFT     →  BROKEN   (integrity check finds issues)
READY     →  BROKEN   (integrity check finds issues)
BROKEN    →  DRAFT    (all issues resolved, plan not yet complete)
BROKEN    →  READY    (all issues resolved, plan was complete)
```

The plan status field already exists in MigrationPlan (feature 001). The IntegrityCheckService modifies it via Prisma update.
