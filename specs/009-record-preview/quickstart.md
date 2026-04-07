# Quickstart: Record Preview

## Prerequisites

- Feature 005 (Source Field Retrieval) or 008 (Destination Field Retrieval) implemented
- A plan with at least one connected system (source or destination) with schema + fields retrieved
- ConnectorAdapter implementations for `getRecords()` and `getRecordCount()`

## Setup

```bash
npm run dev
```

No additional dependencies or environment variables beyond those from connector features.

## Dev Workflow

```bash
# Run unit tests
npx vitest run tests/unit/services/record-preview.test.ts
npx vitest run tests/unit/components/record-table.test.ts

# Run integration tests
npx vitest run tests/integration/record-preview.test.ts
```

## Manual Testing

1. Open a plan with a connected source (or destination)
2. Navigate to an object's detail view
3. Click "Preview Records"
4. Verify: paginated table with all field values, null shown as "null", empty as empty
5. Navigate pages: Next, Previous
6. Change page size (25, 50, 100)
7. Verify total record count displayed
8. Find a long text field — verify truncation with expand option

## Integration Scenario

```typescript
// Fetch first page of source records
const res = await fetch(
  `/api/plans/${planId}/records/Contact?role=source&page=1&pageSize=50`
);
const data = await res.json();
// {
//   records: [{ Id: "001...", Name: "John Doe", Email: "john@example.com", ... }],
//   totalCount: 15432,
//   pageSize: 50,
//   currentPage: 1,
//   hasNextPage: true
// }

// Fetch page 2
const page2 = await fetch(
  `/api/plans/${planId}/records/Contact?role=source&page=2&pageSize=50`
);

// Fetch destination records
const destRecords = await fetch(
  `/api/plans/${planId}/records/contacts?role=destination&page=1&pageSize=25`
);
```
