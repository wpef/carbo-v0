# API Contracts: Migration Plan

## Base URL

All routes are Next.js Route Handlers under `/api/plans`.

---

## GET /api/plans

**Purpose**: List all migration plans (FR-002).

**Response** `200 OK`:
```json
[
  {
    "id": "string (cuid)",
    "name": "string",
    "description": "string | null",
    "status": "DRAFT | READY | BROKEN",
    "currentStep": "SOURCE | DESTINATION | MAPPING | FIELD_MAPPING | DOCUMENTS",
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
]
```

**Notes**: Returns an empty array if no plans exist. Ordered by `updatedAt` descending (most recently modified first). Does not include connection data (lightweight for list view).

**Audit**: No audit log for list operations.

---

## POST /api/plans

**Purpose**: Create a new migration plan (FR-001).

**Request Body**:
```json
{
  "name": "string (required, non-empty)",
  "description": "string (optional)"
}
```

**Response** `201 Created`:
```json
{
  "id": "string (cuid)",
  "name": "string",
  "description": "string | null",
  "status": "DRAFT",
  "currentStep": "SOURCE",
  "sourceConnectionId": null,
  "destinationConnectionId": null,
  "objectAutoLinkedAt": null,
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Errors**:
- `400 Bad Request`: `name` is missing or empty. Body: `{ "error": "Name is required" }`.

**Audit**: Logs `PLAN_CREATED` with `entityType: "MigrationPlan"`, `entityId: <new plan id>`, `details: { name, description }`.

---

## GET /api/plans/[planId]

**Purpose**: Get plan detail with connection data (FR-004, FR-009).

**Response** `200 OK`:
```json
{
  "id": "string (cuid)",
  "name": "string",
  "description": "string | null",
  "status": "DRAFT | READY | BROKEN",
  "currentStep": "SOURCE | DESTINATION | MAPPING | FIELD_MAPPING | DOCUMENTS",
  "sourceConnectionId": "string | null",
  "destinationConnectionId": "string | null",
  "objectAutoLinkedAt": "ISO 8601 | null",
  "sourceConnection": {
    "id": "string",
    "adapterType": "string (e.g. salesforce, hubspot)",
    "status": "CONNECTED | EXPIRED | ERROR"
  } | null,
  "destinationConnection": {
    "id": "string",
    "adapterType": "string",
    "status": "CONNECTED | EXPIRED | ERROR"
  } | null,
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Notes**: `sourceConnection` and `destinationConnection` are included via Prisma relation include. Returns `null` for each if no connection exists yet. The `adapterType` and `status` fields are used by the plan header (FR-009) to display connector labels and connection dots.

**Errors**:
- `404 Not Found`: Plan does not exist. Body: `{ "error": "Plan not found" }`.

**Audit**: No audit log for read operations.

---

## DELETE /api/plans/[planId]

**Purpose**: Delete a plan and all associated data (FR-003).

**Response** `204 No Content`: Empty body.

**Errors**:
- `404 Not Found`: Plan does not exist. Body: `{ "error": "Plan not found" }`.

**Cascade**: Deleting a plan removes all associated connections, schemas, snapshots, object selections, object mappings, field mappings, rules, filters, documents, and audit logs. This is enforced at the database level via `onDelete: Cascade` on all FK relations pointing to `MigrationPlan.id`.

**Audit**: Logs `PLAN_DELETED` with `entityType: "MigrationPlan"`, `entityId: <plan id>`, `details: { name }` **before** the delete operation (since audit logs are cascade-deleted with the plan, this log is written then immediately deleted — acceptable for v0; if persistent audit is needed, log to an external system).

---

## PATCH /api/plans/[planId]/step

**Purpose**: Advance the plan to the next workflow step (FR-008).

**Request Body**:
```json
{
  "targetStep": "DESTINATION | MAPPING | FIELD_MAPPING | DOCUMENTS"
}
```

**Response** `200 OK`:
```json
{
  "id": "string (cuid)",
  "currentStep": "string (the new step)",
  "status": "DRAFT | READY | BROKEN",
  "updatedAt": "ISO 8601"
}
```

**Validation**:
- `targetStep` must be a valid step name.
- `targetStep` index must be strictly greater than the current `currentStep` index (forward-only, Clarification 4).
- If `targetStep` is `DOCUMENTS` and all prior steps are complete, status transitions to `READY`.

**Errors**:
- `400 Bad Request`: Invalid step name or not strictly forward. Body: `{ "error": "Target step must be after current step" }`.
- `404 Not Found`: Plan does not exist.

**Audit**: Logs `STEP_ADVANCED` with `entityType: "MigrationPlan"`, `entityId: <plan id>`, `details: { from: <old step>, to: <new step> }`.

---

## Error Response Format

All error responses follow a consistent shape:

```json
{
  "error": "string (human-readable message)"
}
```

HTTP status codes used: `400` (validation), `404` (not found), `500` (internal server error — logged with stack trace in dev).

---

## TypeScript Types (shared)

```typescript
// src/features/plans/types.ts

interface PlanListItem {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'READY' | 'BROKEN'
  currentStep: 'SOURCE' | 'DESTINATION' | 'MAPPING' | 'FIELD_MAPPING' | 'DOCUMENTS'
  createdAt: string
  updatedAt: string
}

interface PlanDetail extends PlanListItem {
  sourceConnectionId: string | null
  destinationConnectionId: string | null
  objectAutoLinkedAt: string | null
  sourceConnection: {
    id: string
    adapterType: string
    status: 'CONNECTED' | 'EXPIRED' | 'ERROR'
  } | null
  destinationConnection: {
    id: string
    adapterType: string
    status: 'CONNECTED' | 'EXPIRED' | 'ERROR'
  } | null
}

interface CreatePlanInput {
  name: string
  description?: string
}

interface AdvanceStepInput {
  targetStep: 'DESTINATION' | 'MAPPING' | 'FIELD_MAPPING' | 'DOCUMENTS'
}

interface AdvanceStepResponse {
  id: string
  currentStep: string
  status: 'DRAFT' | 'READY' | 'BROKEN'
  updatedAt: string
}
```
