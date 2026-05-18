# Quickstart: Destination Schema Retrieval

## What this feature provides

After connecting a destination system (e.g., HubSpot), the consultant can retrieve the full destination schema (all objects + fields), view it, refresh it (with CURRENT/PREVIOUS diff), and see drift detection alerts when reopening a plan.

## Prerequisites

- Feature 000 (ConnectorAdapter types) implemented
- Feature 001 (MigrationPlan with AuditLog) implemented
- Feature 006 (Destination connection) implemented — a CONNECTED destination exists
- Prisma schema includes `SchemaSnapshot`, `SchemaObject`, `ObjectField` (shared with 003)

## How to use

### 1. Initial schema retrieval

After the destination is connected (feature 006), navigate to the destination schema page or trigger auto-retrieval:

```
POST /api/plans/{planId}/destination/schema
```

This fetches all objects and all fields from the destination adapter in a single chain. A CURRENT snapshot is created.

### 2. View the schema

```
GET /api/plans/{planId}/destination/schema
```

Returns the CURRENT snapshot with all objects (label, apiName, isCustom badge, description).

### 3. Refresh the schema

```
POST /api/plans/{planId}/destination/schema/refresh
```

Fetches the live schema, rotates snapshots (CURRENT -> PREVIOUS), computes a diff, and triggers the mapping integrity check. The response includes the diff and any broken mappings.

### 4. Drift detection (plan reopen)

```
GET /api/plans/{planId}/destination/drift
```

Read-only comparison of CURRENT snapshot vs live schema. Returns a categorized `DriftReport` using the canonical taxonomy from spec 003. Destination-specific severity tuning (e.g., `FIELD_BECAME_REQUIRED` flagged as warning). Used by the plan layout banner (feature 001).

## UI Flow

```
/plans/[planId]/destination          # Connection page (feature 006)
    |
    v (connected + auto-retrieval)
/plans/[planId]/destination/schema   # Schema page (this feature)
    |
    |-- [Object list with badges]
    |-- [Refresh button] --> triggers full chain + integrity check
    |-- [Diff view] (when PREVIOUS exists)
```

## Dependencies

- **Depends on**: 000 (ConnectorAdapter), 001 (MigrationPlan + AuditLog), 006 (destination ConnectorConnection)
- **Used by**: 008 (destination field retrieval page -- fields already stored by this feature), 011 (object mapping), 012 (field mapping), 017 (mapping integrity check)
- **Shared with**: 003 (SchemaSnapshot model, diff algorithm, drift detection core)
