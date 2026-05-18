# Quickstart: Migration Plan

## What this feature provides

CRUD operations for migration plans (the top-level container), a persistent plan layout with workflow sidebar, step advancement, and plan-level drift detection on reopen.

## Prerequisites

- Feature 000 (Connector Interface) types available at `src/lib/types/connector.ts`
- Prisma configured with Neon Postgres (or local Docker Postgres)
- `npx prisma migrate dev` run after schema changes

## How to use

### 1. Create a plan

```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp Migration", "description": "Salesforce to HubSpot"}'
```

Response:
```json
{
  "id": "clx...",
  "name": "Acme Corp Migration",
  "description": "Salesforce to HubSpot",
  "status": "DRAFT",
  "currentStep": "SOURCE",
  "sourceConnectionId": null,
  "destinationConnectionId": null,
  "objectAutoLinkedAt": null,
  "createdAt": "2026-05-18T...",
  "updatedAt": "2026-05-18T..."
}
```

### 2. List all plans

```bash
curl http://localhost:3000/api/plans
```

Response:
```json
[
  {
    "id": "clx...",
    "name": "Acme Corp Migration",
    "description": "Salesforce to HubSpot",
    "status": "DRAFT",
    "currentStep": "SOURCE",
    "createdAt": "2026-05-18T...",
    "updatedAt": "2026-05-18T..."
  }
]
```

### 3. Get plan detail

```bash
curl http://localhost:3000/api/plans/clx...
```

Response includes `sourceConnection` and `destinationConnection` data for the header (FR-009).

### 4. Advance step

```bash
curl -X PATCH http://localhost:3000/api/plans/clx.../step \
  -H "Content-Type: application/json" \
  -d '{"targetStep": "DESTINATION"}'
```

Returns 200 with the updated plan. Returns 400 if targetStep is not strictly forward.

### 5. Delete a plan

```bash
curl -X DELETE http://localhost:3000/api/plans/clx...
```

Returns 204. All associated data (connections, schemas, mappings, documents, audit logs) is cascade-deleted.

## UI Pages

| Route | Description |
|-------|-------------|
| `/` | Home page — plan list with name, status, current step, dates |
| `/plans/new` | Plan creation form (name + optional description) |
| `/plans/[planId]` | Plan detail — metadata + current step CTA (inside persistent layout) |
| `/plans/[planId]/source` | Source connection page (feature 002) |
| `/plans/[planId]/destination` | Destination connection page (feature 006) |
| `/plans/[planId]/mapping` | Object mapping page (feature 011) |
| `/plans/[planId]/field-mapping` | Field mapping page (feature 012) |
| `/plans/[planId]/documents` | Documents page (feature 019/020) |

## Persistent Layout (FR-007)

The `layout.tsx` at `/plans/[planId]/` renders:
- **Header** (fixed top): plan name, status badge, source/destination connector labels with connection dots
- **Sidebar** (fixed left): vertical step workflow with progress indicators + next-step button pinned at bottom
- **Main area** (scrollable center): child page content
- **Drift banner** (below header, above content): shown when drift detected on plan visit

## Drift Detection Flow (FR-010 to FR-016)

1. Consultant navigates to `/plans/[id]/*` from outside the plan
2. Layout checks `sessionStorage.lastVisitedPlanId`
3. If different → fires `detectLiveDrift` for source and destination in parallel
4. Merged DriftReport stored in `PlanDriftContext`
5. Banner shown if any `critical` or `warning` changes
6. Sidebar badges updated per step
7. Consultant can refresh schema or ignore for this visit

## Dependencies

- **Depends on**: 000-connector-interface (types only)
- **Used by**: 002 (Source Connection), 006 (Destination Connection), 011 (Object Mapping), 012 (Field Mapping), 019/020 (Documents) — all features are scoped to a plan
