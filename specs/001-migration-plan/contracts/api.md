# API Contracts: Migration Plan

## Base URL

`/api/plans`

---

## GET /api/plans

List all migration plans.

**Response** `200 OK`

```typescript
{
  plans: {
    id: string;
    name: string;
    description: string | null;
    status: "DRAFT" | "READY" | "BROKEN";
    currentStep: string;
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
  }[];
}
```

**Errors**: None expected (empty array if no plans).

---

## POST /api/plans

Create a new migration plan.

**Request Body**

```typescript
{
  name: string;        // required, non-empty
  description?: string;
}
```

**Response** `201 Created`

```typescript
{
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT";
  currentStep: "SOURCE_CONNECTION";
  createdAt: string;
  updatedAt: string;
}
```

**Errors**:
- `400 Bad Request` — missing or empty `name`

---

## GET /api/plans/[planId]

Get a single plan by ID.

**Response** `200 OK`

```typescript
{
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "READY" | "BROKEN";
  currentStep: string;
  sourceConnectionId: string | null;
  destinationConnectionId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Errors**:
- `404 Not Found` — plan does not exist

---

## DELETE /api/plans/[planId]

Delete a plan and all associated data (cascade).

**Response** `204 No Content`

**Errors**:
- `404 Not Found` — plan does not exist
