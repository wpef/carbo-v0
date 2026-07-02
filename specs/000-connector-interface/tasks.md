# Tasks: Connector Interface

**Input**: `specs/000-connector-interface/`
**Prerequisites**: None (foundation feature)

## Phase 1: Type Definitions

- [ ] T001 Create `src/lib/types/connector.ts` with all interface types: ConnectorConnection, ConnectorSchema, ConnectorObject, ConnectorField, ConnectorRecord, FieldStats, PaginatedRecords, SchemaDiffResult, ConnectorCapabilities, ConnectorAdapter. All per data-model.md. Include JSDoc on `getRecords` page param: "1-indexed (FR-012)".
- [ ] T002 [P] Create `src/lib/adapters/demo/demo-adapter.ts`: mock implementation of ConnectorAdapter using in-memory data. Provide 3 objects (Contact, Account, Deal) with 5-10 fields each, 50 mock records per object. Set capabilities: canRead=true, canWrite=false, canWriteSchema=false.
- [ ] T003 [P] Create `src/lib/adapters/registry.ts`: adapter registry mapping adapter type string to ConnectorAdapter instance. Initial entries: "demo" → DemoAdapter. Export `getAdapter(type: string): ConnectorAdapter`.

**Checkpoint**: Types compile, demo adapter passes type check, registry resolves "demo".

---

## Phase 2: Contract Tests

- [ ] T004 Create `tests/unit/types/connector-contract.test.ts`: contract test suite validating DemoAdapter against ConnectorAdapter interface. Verify: all required methods exist, capabilities flags set, connect returns valid status, getSchema returns objects array, getRecords with page=1 returns currentPage=1, getFieldStats returns matching field names. Verify createObject/createField are undefined when canWriteSchema=false.

**Checkpoint**: All contract tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps — start immediately
- **T002, T003**: Depend on T001 (types). Parallel-safe.
- **T004**: Depends on T002, T003 (needs demo adapter + registry)

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003] parallel
Phase 2: T004 (sequential after Phase 1)
```
