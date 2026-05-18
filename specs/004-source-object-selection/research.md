# Research: Source Object Selection

## Decision 1: List Rendering Strategy for 2000+ Objects

**Decision**: Client-side filtering with CSS-based virtualization (`content-visibility: auto` or a lightweight virtual list like `@tanstack/react-virtual`). No server-side pagination for the object list.

**Rationale**: SC-001 requires <2s load for 2000 objects. The full object list (apiName, label, isCustom, description, isSelected) is already available from the schema snapshot stored in the database -- no external API call needed. Sending 2000 rows (~200KB JSON) in a single response is acceptable. Client-side search/filter (FR-004) is simpler and faster (<200ms, SC-002) when all data is in memory. Virtualization prevents DOM bloat while keeping the full dataset searchable.

**Alternatives**: Server-side pagination with search (adds latency per keystroke, complicates "Select all visible"), infinite scroll (same complexity, worse for "Select all visible").

## Decision 2: Pre-Selection Default Computation

**Decision**: Defaults computed server-side at selection initialization time, stored immediately. The logic: (a) all objects with `isCustom=true` are selected, (b) objects whose `apiName` is in a per-connector-type "common business objects" list are selected, (c) everything else is deselected.

**Rationale**: FR-002 requires defaults. Computing them server-side ensures consistency if the same snapshot is opened from multiple clients. The common business objects list is a static configuration per adapter type (e.g., Salesforce CRM: Account, Contact, Lead, Opportunity, Case, Task, Event; HubSpot CRM: contacts, companies, deals, tickets). This list lives in `common-business-objects.ts` and is imported by the default-selection logic.

**Alternatives**: Client-side default computation (race condition if two tabs open simultaneously), ML-based suggestion (overengineered for v0).

## Decision 3: System Object Classification

**Decision**: An object is classified as "system" if `isCustom=false` AND its `apiName` is NOT in the common business objects list for that connector type. The "Hide system objects" toggle (FR-003) filters the displayed list client-side.

**Rationale**: The connector adapter already provides `isCustom`. The gap is distinguishing "standard but business-relevant" (Account, Contact) from "standard but system/internal" (ApexClass, EmailTemplate). The common business objects list fills this gap. The toggle is a UI filter only -- it does not affect the persisted selection. System objects hidden by default can still be found via search.

**Alternatives**: Connector-level `isSystem` flag (requires adapter API change, deferred), heuristic based on object name patterns (fragile).

## Decision 4: On-Demand Expand Strategy

**Decision**: Each expand (FR-005) triggers a single API call to `/objects/[objectApiName]/expand` which returns `{ recordCount, fields, sampleRecords }`. The server calls three adapter methods in parallel (`getRecordCount`, `getFields`, `getRecords(_, _, 1, 5)`) and merges the results. A 30-second timeout applies (edge case from spec).

**Rationale**: Fetching all three in one request avoids three sequential round-trips from the client. The adapter calls are independent and can run in parallel server-side. SC-003 allows up to 10 seconds; the 30s timeout is a safety net for slow systems. Expand data is NOT cached in the database -- it is always live from the connector (data freshness matters more than speed for record counts and sample data).

**Alternatives**: Pre-fetch on list load (violates FR-005 "only on click"), cache expand data in DB (stale data risk, storage overhead for temporary preview data).

## Decision 5: Selection Persistence Granularity

**Decision**: One `ObjectSelection` row per object per connection per snapshot. Upsert on every toggle (not batch-save). The `PUT /objects` endpoint accepts the full selection array for bulk operations.

**Rationale**: FR-007 requires persistence. Upsert-on-toggle gives immediate durability (consultant can close the browser mid-selection and return). The PUT endpoint handles bulk actions (Select/Deselect all visible) efficiently in a single transaction. Selection is scoped to `connectionId + snapshotId` (spec requirement: per-connection, per-snapshot).

**Alternatives**: Batch save with explicit "Save" button (risk of lost work if browser closes), localStorage with periodic sync (fragile, violates "restored from database" in FR-007).

## Decision 6: Selection Migration on Schema Refresh

**Decision**: When a new schema snapshot is created (003), the system copies existing selections to the new snapshot for objects that still exist (matched by `apiName`). Objects that no longer exist are flagged with a warning badge in the UI (orphaned selection edge case from spec). Objects newly added in the refresh get the default selection logic applied.

**Rationale**: Spec assumption: "If the schema is refreshed and a new snapshot is created, the selection is migrated to the new snapshot for objects that still exist." This is handled by `object-selection-service.ts` called from the schema refresh chain (003). Orphaned objects are NOT auto-removed (Principle IX) -- the consultant sees a warning and decides.

**Alternatives**: No migration (force re-selection from scratch -- poor UX), full auto-cleanup (violates Principle IX).
