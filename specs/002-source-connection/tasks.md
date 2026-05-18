# Tasks: Source Connection

**Input**: `specs/002-source-connection/`
**Prerequisites**: 000-connector-interface (types, adapter registry, demo adapter), 001-migration-plan (MigrationPlan model, Prisma client, audit utility, plan layout with sidebar)

## Phase 1: Data Model & Schema Updates

- [ ] T001 Add `ConnectorConnection` model to `prisma/schema.prisma`: id cuid, adapterType string, status `ConnectionStatus` enum (PENDING/CONNECTED/EXPIRED/ERROR) default PENDING, config Json default `{}`, secretsRef nullable string, createdAt, updatedAt. Add `SchemaSnapshot` model: id cuid, connectionId FK, side `SnapshotSide` enum (SOURCE/DESTINATION), data Json, fetchedAt default now(), unique constraint on (connectionId, side), onDelete Cascade from ConnectorConnection. Add relations from MigrationPlan: `sourceConnection` via sourceConnectionId with `@relation("SourceConnection")` onDelete SetNull, `destinationConnection` via destinationConnectionId with `@relation("DestinationConnection")` onDelete SetNull. Add reverse relations on ConnectorConnection.
- [ ] T002 Run `npx prisma migrate dev --name add-connector-connection` to generate and apply the migration.

**Checkpoint**: Migration succeeds. `ConnectorConnection` and `SchemaSnapshot` tables exist. MigrationPlan relations resolve.

---

## Phase 2: Shared Types & Utilities

- [ ] T003 [P] Create `src/features/002-source-connection/lib/normalize-type.ts`: export `normalizeType(rawType: string): string` mapping system-specific types to canonical buckets: `text`, `number`, `boolean`, `date`, `datetime`, `picklist`, `multipicklist`, `lookup`, `binary`, `unknown`. Cover Salesforce types (string, textarea, double, currency, int, boolean, date, datetime, picklist, multipicklist, reference, base64) and HubSpot types (string, number, bool, date, datetime, enumeration). Default to `unknown`. Export `areTypesCompatible(oldRaw, newRaw)` returning boolean (same normalized bucket).
- [ ] T004 [P] Create `src/features/002-source-connection/types.ts` with TypeScript types per `contracts/api.md` and `data-model.md`: `SourceConnectionResponse` (connection + schemaSnapshot summary), `ConnectSourceInput` (adapterType, config, credentials), `SchemaRefreshResponse`, `SchemaDiffResult` (addedObjects, removedObjects, addedFields, removedFields, typeChangedFields), `TypeChangedField`, `ImpactReport` (objectMappingsToDelete, fieldMappingsToDelete, fieldMappingsToBreak, rulesToDelete, rulesToFlag, filtersToDelete, documentsToOutdate, suggestedStepRollback, isEmpty), `ReconfigurationPayload`, `ReconfigurePreviewResponse`, `ReconfigureApplyResponse`.

**Checkpoint**: Types compile. `normalizeType('string')` returns `'text'`, `normalizeType('double')` returns `'number'`. `areTypesCompatible('string', 'textarea')` returns true.

---

## Phase 3: Service Layer (Connection Lifecycle)

- [ ] T005 Create `src/features/002-source-connection/services/connect-source.ts`:
  - `connectSource(planId, input: ConnectSourceInput)`: verify plan exists and has no source connection (409 if already connected), resolve adapter from registry, call `adapter.connect(credentials)`, create `ConnectorConnection` row with status from adapter response, set `MigrationPlan.sourceConnectionId`, audit log `source.connected`. For demo mode: create connection with status CONNECTED immediately.
  - `disconnectSource(planId)`: verify plan has source connection (404 if not), delete `SchemaSnapshot` where connectionId+side=SOURCE, delete `ConnectorConnection`, set `MigrationPlan.sourceConnectionId = null`, reset `currentStep` to SOURCE, audit log `source.disconnected` with cascade summary.
- [ ] T006 Create `src/features/002-source-connection/services/fetch-schema.ts`:
  - `fetchSchema(connectionId)`: resolve adapter from connection's adapterType, call `adapter.getSchema()`, upsert `SchemaSnapshot` (connectionId + side=SOURCE, replace data entirely), return snapshot summary (objectCount, fieldCount, fetchedAt). Console log fetch duration for observability.

**Checkpoint**: `connectSource` with demo adapter creates connection + sets plan FK. `fetchSchema` stores snapshot. `disconnectSource` removes connection + snapshot + resets step.

---

## Phase 4: Service Layer (Schema Diff & Impact)

- [ ] T007 Create `src/features/002-source-connection/services/schema-diff.ts`: export `computeSchemaDiff(oldSchema: ConnectorSchema, newSchema: ConnectorSchema): SchemaDiffResult`. Pure function, no DB access. Compare objects by `apiName`: removed = in old not in new, added = in new not in old. For each object present in both: compare fields by `apiName`, detect removed/added fields. For fields present in both: compare via `areTypesCompatible()`, populate `typeChangedFields` when incompatible. Return complete `SchemaDiffResult`.
- [ ] T008 Create `src/features/002-source-connection/services/impact-report.ts`: export `computeImpactReport(diff: SchemaDiffResult, planId: string): Promise<ImpactReport>`. Query DB for downstream artifacts:
  - `ObjectMapping` where sourceObjectName in `diff.removedObjects` -> objectMappingsToDelete.
  - `FieldMapping` where sourceFieldName in `diff.removedFields[object]` -> fieldMappingsToDelete.
  - `FieldMapping` where sourceFieldName in `diff.typeChangedFields` -> fieldMappingsToBreak (reason: type incompatible).
  - `MigrationLogic` referencing removed fields -> rulesToDelete; referencing type-changed fields -> rulesToFlag.
  - `MigrationFilter` referencing removed fields -> filtersToDelete.
  - `GeneratedDocument` for this plan -> documentsToOutdate (if any of the above is non-empty).
  - Compute `suggestedStepRollback` per FR-015 rules: any objectMapping deleted -> MAPPING, any fieldMapping affected -> FIELD_MAPPING, only documents -> DOCUMENTS, else null.
  - Set `isEmpty` = all arrays empty.
  - Gracefully return empty arrays if downstream tables do not yet exist (Phase 1 tolerance).
- [ ] T009 Create `src/features/002-source-connection/services/apply-reconfiguration.ts`: export `applyReconfiguration(planId, payload: ReconfigurationPayload): Promise<ReconfigureApplyResponse>`. Single Prisma `$transaction`: update `ConnectorConnection` (adapterType, config, secretsRef), upsert `SchemaSnapshot` with new data, delete object mappings/field mappings/rules/filters per impact, flag field mappings as BROKEN, mark documents as OUTDATED, update `MigrationPlan.currentStep` per suggestedStepRollback. Audit log `source.reconfigured` with full impact report. Handle secret preservation: if adapterType unchanged and credentials blank, keep existing secretsRef.

**Checkpoint**: `computeSchemaDiff` correctly detects added/removed/changed between two mock schemas. `computeImpactReport` returns empty report when no downstream artifacts exist. `applyReconfiguration` runs in a single transaction.

---

## Phase 5: API Routes

- [ ] T010 Create `src/app/api/plans/[planId]/source/route.ts`:
  - `GET`: load plan, include sourceConnection + schemaSnapshot summary. Return `{ connection, schemaSnapshot }` or `{ connection: null, schemaSnapshot: null }`. 404 if plan not found.
  - `POST`: parse `ConnectSourceInput` from body, call `connectSource()`, then `fetchSchema()` on the new connection. Return 201 with connection. 400 for invalid adapter. 401 for auth failure. 409 if already connected.
  - `DELETE`: call `disconnectSource()`. Return 200 with cascade summary. 404 if no connection.
- [ ] T011 [P] Create `src/app/api/plans/[planId]/source/refresh/route.ts`: `POST` handler calls `fetchSchema()` for existing connection. Return 200 with refreshed snapshot summary. 404 if no connection. 502 if external API error. Audit log `source.schema.refreshed`.
- [ ] T012 [P] Create `src/app/api/plans/[planId]/source/reconfigure/preview/route.ts`: `POST` handler parses new adapter config + credentials, authenticates with new adapter (401 on failure), fetches new schema, loads stored schema snapshot, calls `computeSchemaDiff()` then `computeImpactReport()`. Return 200 with `{ schemaDiff, impact, newSchemaSnapshot }`. 404 if no existing connection.
- [ ] T013 [P] Create `src/app/api/plans/[planId]/source/reconfigure/apply/route.ts`: `POST` handler parses `ReconfigurationPayload`, verify `confirmedImpact === true` (400 if not), call `applyReconfiguration()`. Return 200 with apply result. 409 if schema changed since preview (stale).
- [ ] T014 Create `src/app/api/adapters/route.ts`: `GET` handler reads `side` query param, queries adapter registry filtering by `canRead` (for source) or `canWrite` (for destination). Return 200 with `{ adapters: [{ type, label, icon, capabilities }] }`.

**Checkpoint**: All API routes respond correctly. Connect demo source -> 201. GET source -> connection data. Refresh -> updated snapshot. Disconnect -> 200 with cascade. Reconfigure preview -> impact report. Reconfigure apply -> atomic update.

---

## Phase 6: UI Components (Source Page)

- [ ] T015 Create `src/features/002-source-connection/hooks/use-source-connection.ts`: client-side hook for source page state. Fetches `GET /api/plans/[planId]/source`. Exposes: `{ connection, schemaSnapshot, isLoading, error, connect, disconnect, refresh, mutate }`. `connect` calls POST, `disconnect` calls DELETE, `refresh` calls POST /refresh.
- [ ] T016 Create `src/features/002-source-connection/components/adapter-selector.tsx`: fetches `GET /api/adapters?side=source`, displays adapter cards (icon, label, capabilities). On select, sets adapter type in parent state. Highlight selected adapter. Include demo adapter clearly labeled "Demo (donnees fictives)".
- [ ] T017 Create `src/features/002-source-connection/components/connection-form.tsx`: dynamic form based on selected adapter type. For demo: no fields needed, just a "Connecter" button. For Salesforce: instance URL, sandbox toggle, OAuth button (placeholder for Phase 1). Credentials fields never pre-filled with secrets (FR-007). Submit calls `connect` from hook. Loading state during connection. Error display on auth failure.
- [ ] T018 Create `src/features/002-source-connection/components/connection-status.tsx`: displays connected state: adapter label, status badge (CONNECTED green, EXPIRED amber, ERROR red), schema summary (N objects, N fields, fetched at date). "Reconfigurer" button (FR-006) transitions page to edit mode. "Deconnecter" button with confirmation dialog.
- [ ] T019 [P] Create `src/features/002-source-connection/components/schema-refresh-button.tsx`: button "Rafraichir le schema" visible when connection is CONNECTED (FR-018). On click: calls `refresh` from hook, shows spinner during fetch, updates schema summary on success, error message on failure. Phase 1 simplified: no diff/confirmation dialog (FR-019).
- [ ] T020 [P] Create `src/features/002-source-connection/components/impact-dialog.tsx`: confirmation dialog for reconfiguration (FR-011). Props: `impact: ImpactReport`, `onConfirm`, `onCancel`. Displays in French: "N correspondances d'objets seront supprimees", "N correspondances de champs seront supprimees", "N correspondances de champs seront marquees en erreur", "N regles seront supprimees", "Les documents seront marques comme obsoletes". Full list if <= 20 items, else collapsed with "Voir les details" expander. Cancel and "Confirmer la reconfiguration" buttons clearly distinct (shadcn/ui `AlertDialog`).
- [ ] T021 Create `src/features/002-source-connection/components/source-page-client.tsx`: client orchestrator component. State machine: `idle` (no connection) -> `selecting` (adapter choice) -> `configuring` (credentials form) -> `connected` (status display) -> `reconfiguring` (edit mode). Auto-recovery on mount: detect `?connected=<adapterType>` in URL (FR-017), consume param via `replaceState`, trigger `refresh`. Composes: adapter-selector, connection-form, connection-status, schema-refresh-button. Reconfigure flow: click Reconfigurer -> show form pre-filled (non-secret config) -> submit -> call preview API -> if impact empty apply silently (FR-012) -> if impact non-empty show impact-dialog -> on confirm call apply API -> on success refresh page state.
- [ ] T022 Create `src/app/plans/[planId]/source/page.tsx`: Next.js page component (server shell). Renders `source-page-client.tsx` passing planId from route params.

**Checkpoint**: Source page loads within plan layout. Adapter selector shows demo + placeholder adapters. Connect with demo creates connection and fetches schema. Status page shows connection info + schema summary. Refresh button updates snapshot. Disconnect cleans up and reverts page. Reconfigure button opens edit mode.

---

## Phase 7: Integration Tests

- [ ] T023 Create `tests/integration/source/connect-source.test.ts` (Vitest): test connection lifecycle via service functions.
  - Connect demo source to plan -> connection created, status CONNECTED, plan FK set.
  - Connect when plan already has source -> 409 conflict.
  - Fetch schema after connect -> SchemaSnapshot created with correct data.
  - Disconnect source -> connection deleted, snapshot deleted, plan sourceConnectionId null, currentStep reset to SOURCE.
  - Disconnect when no connection -> 404.
  - Verify audit logs for connect and disconnect.
- [ ] T024 [P] Create `tests/integration/source/schema-diff.test.ts` (Vitest): test pure diff function with fixture schemas.
  - Identical schemas -> empty diff.
  - Schema with added object -> addedObjects populated.
  - Schema with removed object -> removedObjects populated.
  - Schema with added field on existing object -> addedFields populated.
  - Schema with removed field -> removedFields populated.
  - Schema with type-changed field (text -> number) -> typeChangedFields populated.
  - Schema with compatible type change (string -> textarea, both normalize to text) -> not in typeChangedFields.
- [ ] T025 [P] Create `tests/integration/source/impact-report.test.ts` (Vitest): test impact computation.
  - Empty diff -> isEmpty true.
  - Diff with removedObject that has a mapping -> objectMappingsToDelete populated.
  - Diff with removedField that has a field mapping -> fieldMappingsToDelete populated.
  - Diff with typeChanged field -> fieldMappingsToBreak populated.
  - SuggestedStepRollback computed correctly per FR-015 rules.
  - Graceful empty result when downstream tables don't exist.
- [ ] T026 [P] Create `tests/integration/source/normalize-type.test.ts` (Vitest): test type normalization.
  - Salesforce types: string->text, double->number, boolean->boolean, date->date, datetime->datetime, picklist->picklist, reference->lookup, base64->binary.
  - HubSpot types: string->text, number->number, bool->boolean, enumeration->picklist.
  - Unknown type -> unknown.
  - `areTypesCompatible('string', 'textarea')` -> true (both text).
  - `areTypesCompatible('string', 'double')` -> false (text vs number).

**Checkpoint**: All integration tests pass. Schema diff is deterministic. Impact report correctly identifies downstream artifacts.

---

## Phase 8: E2E Tests

- [ ] T027 Create `tests/e2e/source/source-connection.spec.ts` (Playwright): end-to-end test of source connection within a plan.
  - Create a plan via API (setup).
  - Navigate to `/plans/[planId]/source`.
  - Verify adapter selector is visible with demo option.
  - Select demo adapter, click connect.
  - Verify connection status shows CONNECTED with schema summary (object count, field count).
  - Click "Rafraichir le schema", verify snapshot updates (fetchedAt changes).
  - Click "Deconnecter", confirm dialog, verify page reverts to adapter selector.
  - Reconnect with demo, verify connection restored.
  - Delete plan via API (cleanup).

**Checkpoint**: Full E2E source connection test passes. Feature 002 is complete.

---

## Dependencies & Execution Order

- **T001**: No deps within this feature -- start immediately (requires 001 Prisma schema to exist)
- **T002**: Depends on T001 (schema changes to migrate)
- **T003, T004**: Depend on T001 (types reference enums/models). Parallel-safe.
- **T005**: Depends on T002, T003 (Prisma client with new models, types)
- **T006**: Depends on T002, T003 (needs ConnectorConnection + SchemaSnapshot models)
- **T007**: Depends on T003 (uses normalizeType)
- **T008**: Depends on T004, T007 (uses types, diff result)
- **T009**: Depends on T002, T004, T008 (transaction on new models, uses impact report)
- **T010**: Depends on T005, T006 (service functions for connect/disconnect/fetch)
- **T011, T012, T013**: Depend on T010 (routes must exist for reconfigure preview/apply). Parallel-safe.
- **T014**: Depends on T003 (adapter registry, uses types). Can start early.
- **T015**: Depends on T004, T010 (types, GET source route)
- **T016**: Depends on T014 (adapter registry route for fetching list)
- **T017**: Depends on T004, T010 (types, POST source route)
- **T018**: Depends on T004, T010 (types, connection status data)
- **T019, T020**: Depend on T004 (types). Parallel-safe.
- **T021**: Depends on T015, T016, T017, T018, T019, T020 (all sub-components)
- **T022**: Depends on T021 (client component to render)
- **T023**: Depends on T005, T006 (service functions)
- **T024, T025, T026**: Depend on T003, T007, T008 (normalize-type, schema-diff, impact-report). Parallel-safe.
- **T027**: Depends on T022 (full UI built)

### Parallel Opportunities

```
Phase 1: T001 -> T002
Phase 2: [T003 | T004] parallel
Phase 3: [T005 | T006] parallel (after Phase 2)
Phase 4: T007 -> T008 -> T009 (sequential chain)
Phase 5: T010 -> [T011 | T012 | T013] parallel, T014 parallel with T010
Phase 6: [T015 | T016 | T017 | T018] after routes, [T019 | T020] parallel -> T021 -> T022
Phase 7: T023, [T024 | T025 | T026] parallel
Phase 8: T027 sequential (needs all UI)
```
