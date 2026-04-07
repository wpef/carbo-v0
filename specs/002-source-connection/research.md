# Research: Source Connection

## Decision 1: Connection storage model

**Options**:
- (A) Store connection as a standalone entity with a foreign key on MigrationPlan
- (B) Embed connection fields directly in MigrationPlan

**Decision**: (A) Standalone `SourceConnection` entity. Reasons:
- Cleaner cascade delete logic
- Allows connection to hold adapter-specific config (JSON blob) without polluting plan schema
- Aligns with Connector Interface's `ConnectorConnection` type
- Future-proofs for connection reuse across plans (Phase 3)

## Decision 2: Adapter registry pattern

**Options**:
- (A) Hardcoded map of adapter type -> adapter factory
- (B) Plugin-based auto-discovery (file system scanning)

**Decision**: (A) Hardcoded registry. Reasons:
- Two adapters in Phase 1 (Salesforce, HubSpot). No need for plugin overhead.
- Explicit is better. A simple `Record<string, AdapterFactory>` in `src/lib/connectors/registry.ts`.
- Easy to extend: add one line per new adapter.

## Decision 3: Demo mode implementation

**Options**:
- (A) A special adapter type "demo" in the registry
- (B) A flag on any adapter that bypasses auth and returns mock data

**Decision**: (A) Demo as a distinct adapter type. Reasons:
- Clean separation: no conditional logic inside real adapters
- The DemoAdapter implements the same ConnectorAdapter interface with seeded data
- "Use Demo Data" in the UI simply selects the "demo" adapter type
- Consistent with roadmap: "Demo mode is connector-scoped"

## Decision 4: Cascade cleanup on disconnect

When the consultant disconnects or switches adapter type, dependent data must be cleaned up (FR-004).

**Approach**: The `source-connection` service calls a cascade function that:
1. Deletes schema snapshots (003) for this connection
2. Deletes object selections (004) for this connection
3. Deletes field metadata (005) for this connection
4. Sets `MigrationPlan.sourceConnectionId` to null

This uses Prisma's `onDelete: Cascade` where possible, plus explicit service-level cleanup for cross-feature data.

## Decision 5: Auth flow

Authentication is adapter-specific (spec assumption). This feature does NOT implement auth UIs. Each adapter exposes a `connect(config)` method. The UI collects config fields dynamically based on the adapter's declared config schema (e.g., Salesforce needs instance URL + OAuth token; demo needs nothing).

For Phase 1, the config form will be a simple key-value input derived from the adapter's declared fields. OAuth flows (Salesforce) will be handled by the adapter itself via redirect.

## API Design

RESTful routes scoped under the plan:
- `GET /api/plans/[planId]/source` -- get current connection status
- `POST /api/plans/[planId]/source` -- connect (body: adapter type + config)
- `DELETE /api/plans/[planId]/source` -- disconnect with cascade cleanup

No PATCH -- reconnecting is a POST that replaces the existing connection.
