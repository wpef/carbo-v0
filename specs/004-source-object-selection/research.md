# Research: Source Object Selection

## Decision 1: Selection storage model

**Options**:
- (A) One row per object in ObjectSelection table (isSelected boolean)
- (B) Store selected object apiNames as a JSON array on the snapshot

**Decision**: (A) One row per object. Reasons:
- Enables efficient queries: "get all selected objects", "count selected vs total"
- Enables per-object audit trail (who selected/deselected, when)
- Works with Prisma relations (ObjectSelection -> SchemaObject -> ObjectField)
- Supports the "migrate selection to new snapshot" use case naturally

## Decision 2: Default selection strategy

Per FR-002, custom objects and "common business objects" are pre-selected. The common objects list varies by connector type.

**Approach**: Each adapter declares a `commonBusinessObjects` array in its registry metadata. For CRM-type adapters (Salesforce):
```
["Account", "Contact", "Lead", "Opportunity", "Case", "Campaign", "Task", "Event"]
```

The `initDefaultSelection(snapshotId, adapterType)` function:
1. Creates ObjectSelection rows for all objects in the snapshot
2. Sets `isSelected = true` for objects where `isCustom = true` OR `apiName` is in the adapter's commonBusinessObjects list
3. Sets `isSelected = false` for all others

## Decision 3: System objects classification

The "Hide system objects" toggle (FR-003) needs a way to classify objects. The adapter provides an `isSystemObject(apiName)` method or a static list. For Salesforce, system objects include those starting with prefixes like `AppMenu`, `SetupEntity`, etc.

**Approach**: The adapter's registry metadata includes a `systemObjectPrefixes` array. Objects matching any prefix are classified as system. The toggle filters these client-side from the displayed list.

For demo adapter: no system objects (all objects are business-relevant).

## Decision 4: On-demand expand (FR-005)

Expanding an object fetches three things from the adapter:
1. Record count (`adapter.getRecordCount(objectApiName)`)
2. Fields list (`adapter.getFields(objectApiName)`) -- preview only, not persisted (005 handles persistence)
3. Sample records (`adapter.getRecords(objectApiName, { pageSize: 5, page: 1 })`)

These are fetched in parallel via a single expand endpoint that returns all three.

**Important**: The fields shown in expand are a preview. Feature 005 handles the actual field retrieval and persistence for selected objects. The expand preview exists so the consultant can make informed selection decisions.

## Decision 5: Selection migration on schema refresh

When the schema is refreshed (003) and a new CURRENT snapshot is created, the selection must be migrated:
1. For each object in the new CURRENT snapshot, check if an ObjectSelection exists for the same apiName in the old snapshot
2. If yes: copy the isSelected value
3. If no (new object): apply default selection logic
4. Objects in the old snapshot that no longer exist: their selections are orphaned and should be flagged, then deleted

This migration is triggered by the schema retrieval service (003) after snapshot rotation, calling `migrateSelection(oldSnapshotId, newSnapshotId)`.

## Decision 6: Search implementation

Client-side filtering. With up to 2000 objects loaded in the GET response, filtering by label/apiName substring is instant in the browser. No server-side search endpoint needed.

## API Design

- `GET /api/plans/[planId]/source/objects` -- list all objects with selection status
- `PUT /api/plans/[planId]/source/objects` -- bulk update selections (body: array of {objectId, isSelected})
- `PATCH /api/plans/[planId]/source/objects/[objectId]` -- toggle single object selection
- `GET /api/plans/[planId]/source/objects/[objectId]/expand` -- on-demand expand (count + fields + records)
