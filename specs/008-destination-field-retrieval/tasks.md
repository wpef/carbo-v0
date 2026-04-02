# Tasks: Destination Field Retrieval

**Input**: `specs/008-destination-field-retrieval/`
**Prerequisites**: 005-source-field-retrieval (ObjectField entity, field retrieval service, field-table component), 007-destination-schema-retrieval (destination snapshot with objects)

## Phase 1: Setup — Ensure Shared Service is Generic

- [ ] T001 Verify `src/lib/services/field-retrieval.service.ts` from 005 accepts an explicit object list parameter (not limited to selected objects). If source-specific, refactor: `retrieveFields(connectionId: string, objectApiNames: string[])` — accepts any list of objects, retrieves fields for each via adapter, persists as ObjectField records, handles partial failures

## Phase 2: US1 — Retrieve Destination Fields (P1)

**Goal**: All destination object fields are retrieved and displayed with metadata.

**Independent Test**: POST to `/api/plans/:id/destination-fields` returns fields for all destination objects.

- [ ] T002 Implement HubSpot `getFields(objectApiName)` in `src/lib/connectors/adapters/hubspot/index.ts` — call `crm.properties.coreApi.getAll(objectApiName)`, normalize HubSpot property metadata to `ConnectorField[]` (name->apiName, label->label, type+fieldType->dataType, modificationMetadata.readOnlyValue->isReadOnly, hasUniqueValue->isUnique)
- [ ] T003 [P] Implement demo destination `getFields(objectApiName)` in `src/lib/connectors/adapters/demo-destination/index.ts` — return realistic field sets per object (e.g., contacts: email, firstname, lastname, phone, company, lifecyclestage; companies: name, domain, industry, numberofemployees)
- [ ] T004 Create route handler `src/app/api/plans/[planId]/destination-fields/route.ts` — POST: get all objects from CURRENT destination snapshot, call field retrieval service with full object list, return objectsWithFields + failedObjects. GET: return persisted fields, filterable by `?object=` query param
- [ ] T005 Extract shared field-table component if needed — ensure `src/components/schema/field-table.tsx` is generic (accepts `ConnectorField[]`, shows type badges, required/read-only/unique indicators). Move from source-specific location if needed
- [ ] T006 Create destination fields page `src/app/plans/[planId]/destination/fields/page.tsx` — "Retrieve Fields" button triggering POST, object accordion listing objects with expand to show field-table for each. Shows loading progress and partial failure warnings

## Phase 3: Polish

- [ ] T007 Add workflow navigation in destination fields page — after retrieval, show "Destination schema ready (N objects, M fields). Next: [Create Mapping]"

---

## Dependencies & Execution Order

- **Phase 1** (T001): Must complete first.
- **Phase 2** (T002, T003): Parallel adapter work. T004 depends on T001 + adapters. T005 depends on 005 components. T006 depends on T004 + T005.
- **Phase 3** (T007): Depends on T006.
