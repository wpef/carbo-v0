# Research: Record Preview

## Decision 1: Table Library — TanStack Table vs Custom vs ag-Grid

**Decision**: TanStack Table (headless, `@tanstack/react-table`).

**Rationale**: The record preview needs dynamic columns (every object has different fields), pagination, column resizing, and cell-level rendering control. TanStack Table is headless (renders via our own shadcn/ui markup), zero-opinion on styling (compatible with Tailwind), and handles dynamic columns natively. It adds no visual dependencies and keeps us in full control of the UI.

**Alternatives**: Custom table (`<table>` + manual state) would require reimplementing pagination, column visibility, and resize logic. ag-Grid is heavyweight (200KB+), opinionated styling, and overkill for a read-only preview. shadcn/ui DataTable is built on TanStack Table already, so adopting TanStack directly aligns with the shadcn ecosystem.

## Decision 2: Records Not Persisted

**Decision**: Records are fetched on-demand and never stored in the local database.

**Rationale**: Spec assumption explicitly states records are not persisted. Records can be large (100K+ rows, 200 fields). Persisting them would bloat the tenant database, create synchronization issues (records change in the source), and add no value since the preview is read-only. The connector adapter handles pagination server-side.

**Alternatives**: Cache records in Redis or in-memory (adds infrastructure complexity for ephemeral data), persist in a separate table (storage bloat, staleness risk).

## Decision 3: Pagination — Server-Side via Adapter

**Decision**: Server-side pagination. The API route passes `page` and `pageSize` to `ConnectorAdapter.getRecords()`. The client never fetches all records.

**Rationale**: Objects can have 100K+ records. Client-side pagination (fetch all, paginate locally) would require loading gigabytes of data. The connector adapter already provides paginated access (see 000 `PaginatedRecords` type). 1-indexed pagination per FR-012 of 000.

**Alternatives**: Client-side pagination (impossible at scale), cursor-based pagination (connector interface uses page-based, not cursor-based).

## Decision 4: Null and Empty Display Strategy

**Decision**: Explicit visual markers: null values render as a styled `null` label (italic, muted color), empty strings render as an empty cell with a visible `""` indicator, binary/blob fields render as `[binary data]`.

**Rationale**: FR-005 requires nulls to be "explicitly shown as null" and empty strings "shown as empty, not hidden." A blank cell is ambiguous (is it null? empty? not loaded?). Distinct visual treatments for null vs empty vs binary eliminate ambiguity. This directly supports Principle III (data fidelity).

**Implementation**: `cell-formatters.ts` inspects each value: `null` -> `<span class="text-muted italic">null</span>`, `""` -> `<span class="text-muted">""</span>`, `instanceof Uint8Array` or detected binary -> `[binary data]`, string > 200 chars -> truncated with expand button.

## Decision 5: Long Text Truncation Threshold

**Decision**: Truncate text values at 200 characters in the table cell. Show an "expand" button that opens a popover with the full value.

**Rationale**: FR-007 requires truncation for large text (10K+ chars). 200 characters provides enough context to identify the content while keeping the table row height manageable. A popover (not a modal or separate page) keeps the consultant in context.

**Implementation**: `expandable-text.tsx` renders truncated text + "..." + a `shadcn/ui Popover` with the full value on click. Values under 200 chars render directly without truncation controls.

## Decision 6: Relationship Field Display

**Decision**: Display the resolved reference value returned by the connector adapter. If the adapter returns a raw foreign key, display it with a relationship icon.

**Rationale**: FR-006 requires "meaningful reference (name or ID of the related record)." The `ConnectorAdapter.getRecords()` returns `ConnectorRecord` which is a `Record<string, unknown>`. For Salesforce, SOQL queries can include relationship fields (e.g., `Account.Name`). The adapter implementation is responsible for including resolved references in the record data. The preview layer displays whatever the adapter provides.

**Implementation**: The `cell-formatters.ts` checks if the field's `referenceTo` is set (from field metadata). If so, the cell gets a relationship icon prefix. The actual display value comes from the record data as-is.

## Decision 7: Side Parameter — Source vs Destination

**Decision**: The record preview is accessible for both source and destination objects via a `[side]` route parameter (`"source"` or `"destination"`).

**Rationale**: The spec says "any selected object" — this includes both source and destination. The consultant needs to preview destination data too (e.g., to check existing records before migration). The service resolves the correct connection based on the side parameter. Sharing the same UI components for both sides avoids duplication.

**Implementation**: Route pattern: `/api/plans/[planId]/[side]/records/[objectApiName]`. The service validates `side` is `"source"` or `"destination"` and resolves the corresponding connection.

## Decision 8: Audit Trail Granularity

**Decision**: One audit entry per page view: log when the consultant opens the preview (first page) and when they navigate to a new page.

**Rationale**: FR-008 requires logging "record preview events (object, page, record count)." Per-page-view granularity is meaningful for traceability (which objects did the consultant inspect? how deep did they paginate?) without being excessive (not per-cell or per-record).

**Implementation**: The API route logs `RECORD_PREVIEW_VIEWED` with `{ planId, side, objectApiName, page, pageSize, recordCount }` on every successful GET request for records.
