# Quickstart: Destination Field Retrieval

## Prerequisites

- Feature 007 (Destination Schema Retrieval) implemented — destination has a CURRENT snapshot with objects
- Feature 005 (Source Field Retrieval) implemented — field retrieval service and field-table component available
- `ObjectField` Prisma model from 005

## Setup

```bash
npx prisma db push
npm run dev
```

## Dev Workflow

```bash
npx vitest run tests/unit/services/destination-field-retrieval.test.ts
npx vitest run tests/integration/destination-field-retrieval.test.ts
```

## Manual Testing

1. Ensure a plan has a connected destination with schema retrieved
2. Navigate to the destination fields page
3. Click "Retrieve Fields" — see loading progress per object
4. Expand an object — see all fields with type badges, required/read-only indicators

## Integration Scenario

```typescript
// Trigger field retrieval for all destination objects
const res = await fetch(`/api/plans/${planId}/destination-fields`, {
  method: "POST",
});
const { objectsWithFields } = await res.json();
// objectsWithFields: [{ objectApiName: "contacts", fields: [...], fieldCount: 45 }, ...]

// Get fields for a specific object
const fields = await fetch(
  `/api/plans/${planId}/destination-fields?object=contacts`
);
// { fields: [{ apiName: "email", label: "Email", dataType: "string", isRequired: true, ... }] }
```
