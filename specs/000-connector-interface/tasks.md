# Tasks: Connector Interface

**Input**: `specs/000-connector-interface/`
**Prerequisites**: plan.md, spec.md, research.md

## Phase 1: Setup

- [ ] T001 [P] Initialize project tooling: add Vitest config if not present (`vitest.config.ts`), ensure `tsconfig.json` paths include `@/` alias for `src/`

## Phase 2: Core Types (US1 — Implement connector interface)

**Goal**: All connector types and the adapter interface are defined and compile-checked.

**Independent Test**: `npx tsc --noEmit` passes; contract test suite passes.

### Implementation

- [ ] T002 Create `src/lib/connectors/types.ts` with all types: ConnectorConnection (id, name, type, status, config), ConnectorSchema (objects array), ConnectorObject (apiName, label, description, isCustom, isSelected), ConnectorField (apiName, label, dataType, isRequired, isReadOnly, isUnique, referenceTo, relationshipType), ConnectorRecord (key-value map), FieldStats (fieldApiName, nullCount, distinctCount, sampleValues), PaginatedRecords (records, totalCount, pageSize, currentPage, hasNextPage), SchemaDiffResult (addedObjects, removedObjects, modifiedObjects), ConnectionStatus enum (CONNECTED, EXPIRED, ERROR)
- [ ] T003 Define ConnectorAdapter interface in `src/lib/connectors/types.ts`: capability flags (canRead, canWrite, canWriteSchema), required methods (connect, disconnect, getSchema, getFields, getRecords, getRecordCount, getFieldStats), optional methods (createObject, createField — only when canWriteSchema). All methods return Promise.
- [ ] T004 Create barrel export `src/lib/connectors/index.ts` re-exporting all types from `types.ts`

## Phase 3: Validation

- [ ] T005 Create contract test suite `tests/unit/connectors/contract.test.ts`: implement a MockAdapter satisfying ConnectorAdapter, verify all method signatures return correct types, verify capability flags are declared, verify a read-only mock (canWriteSchema=false) compiles without createObject/createField
- [ ] T006 Run `npx tsc --noEmit` and `npx vitest run tests/unit/connectors/contract.test.ts` to confirm zero errors

## Dependencies & Execution Order

- **T001**: No dependencies, can start immediately
- **T002, T003**: Depend on T001 (need tsconfig paths). T002 and T003 target the same file — execute sequentially.
- **T004**: Depends on T002, T003 (needs types to re-export)
- **T005**: Depends on T004 (imports from barrel)
- **T006**: Depends on T005 (runs the tests)
