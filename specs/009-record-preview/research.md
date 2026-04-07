# Research: Record Preview

## Key Decisions

### 1. Unified Route vs. Separate Source/Destination Routes

**Decision**: Single unified route with `role` query parameter.

`GET /api/plans/:planId/records/:objectApiName?role=source&page=1&pageSize=50`

The route resolves the correct connection from the plan based on `role`. This avoids duplicating the route for source and destination while keeping the API clean. The service is fully connection-agnostic.

### 2. Pagination Strategy

**Decision**: Cursor-based internally, page-number exposed to UI.

Most external APIs (Salesforce SOQL, HubSpot search) use cursor/offset pagination internally. The adapter translates between page number + page size and the underlying cursor mechanism. The `PaginatedRecords` type from 000 exposes: `records`, `totalCount`, `pageSize`, `currentPage`, `hasNextPage`.

**Salesforce**: Uses SOQL `LIMIT` + `OFFSET` or `queryMore()` with `nextRecordsUrl`.
**HubSpot**: Uses `after` cursor with `limit`. Total count via separate search API.

### 3. Total Record Count

**Decision**: Fetched alongside first page, cached client-side.

The adapter's `getRecordCount(objectApiName)` is called on the first page load. The count is returned with the first page response and cached in the React hook state. Subsequent page navigations do not re-fetch the count.

For Salesforce: `SELECT COUNT() FROM Object`
For HubSpot: Search API with `limit: 0` returns `total` count.

### 4. Relationship Field Resolution

**Decision**: Best-effort via adapter.

Per spec FR-006: relationship fields should display a meaningful reference. The adapter attempts to resolve lookup IDs to display names where possible:
- Salesforce: `Name` field on related records via SOQL relationship query
- HubSpot: Associated record labels via associations API

If resolution fails or is too expensive, the raw ID is shown with a tooltip indicating it's an unresolved reference.

### 5. Long Text Truncation

**Decision**: Truncate at 200 characters in the table cell. Full value available via click-to-expand (modal or inline expansion).

### 6. Binary/Blob Data

**Decision**: Display `[binary data]` placeholder. No attempt to render or download.

### 7. No Local Persistence

**Decision**: Records are NEVER stored in the local database. Every page navigation triggers a fresh API call to the external system. This avoids stale data and storage bloat.

## Trade-offs

| Choice | Pro | Con |
|--------|-----|-----|
| Unified route with role param | DRY, one component for both | Slightly more complex route logic |
| Page-number UI over cursor | Familiar UX (page 1, 2, 3) | Adapter must translate to cursor |
| No local persistence | Always fresh data | Every page = API call to external |
| Best-effort relationship resolution | Meaningful display when possible | Inconsistent across connectors |

## Performance Considerations

- Page size default of 50 balances load time vs. data visibility
- For Salesforce objects with 100+ fields, the response can be large; consider field selection in future
- HubSpot has a 10-second timeout on search API; adapter must handle gracefully
- Rate limiting: Salesforce (100 req/day for bulk, unlimited for REST), HubSpot (100 req/10sec for private apps)
