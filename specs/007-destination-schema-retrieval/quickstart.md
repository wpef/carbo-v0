# Quickstart: Destination Schema Retrieval

## Prerequisites

- Feature 006 (Destination Connection) implemented — plan has a connected destination
- Feature 003 (Source Schema Retrieval) implemented — schema service and components available
- `SchemaSnapshot` and `SchemaObject` Prisma models from 003

## Setup

```bash
npx prisma db push   # Ensure schema is up to date
npm run dev
```

## Dev Workflow

```bash
# Run unit tests
npx vitest run tests/unit/services/destination-schema-retrieval.test.ts

# Run integration tests
npx vitest run tests/integration/destination-schema-retrieval.test.ts
```

## Manual Testing

1. Create a plan, connect a destination (demo or HubSpot)
2. Navigate to the destination schema page
3. Click "Retrieve Schema" — see the list of destination objects
4. Click "Refresh Schema" — see the diff (or "No changes detected")

## Integration Scenario

```typescript
// Trigger schema retrieval
const res = await fetch(`/api/plans/${planId}/destination-schema`, {
  method: "POST",
});
const { snapshot, objects, diff } = await res.json();
// snapshot.status === "CURRENT"
// objects: [{ apiName: "contacts", label: "Contacts", isCustom: false }, ...]
// diff: null (first retrieval) or { added: [...], removed: [...], modified: [...] }

// Get current snapshot
const current = await fetch(`/api/plans/${planId}/destination-schema`);
// { snapshot, objects }
```
