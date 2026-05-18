# Research: Object Mapping

## Decision 1: SVG Link Rendering Strategy

**Decision**: Absolute-positioned SVG overlay on the full two-column container. Link endpoints computed from card bounding rects using `useLayoutEffect`.

**Rationale**: Session learnings from v3 identified three critical bugs with SVG links:
1. `hsl(var(--primary))` is invalid when CSS variables contain `oklch()` values. Use `var(--primary)` directly.
2. `useLayoutEffect` depending on filtered arrays (recreated every render) causes infinite `setState` loops. Depend on primitive values (search strings) instead.
3. SVG inside the bridge column used wrong coordinate system. SVG must overlay the full container with actual x/y coordinates from card bounding rects.

**Alternatives**: CSS-only connectors (limited to straight lines), Canvas (harder to style/interact), table-based layout (no visual links — rejected for object mapping since the visual link metaphor is core to the UX).

## Decision 2: Auto-Link Registry Design

**Decision**: A `Map<string, PredictablePair[]>` keyed by `"sourceAdapter:destAdapter"` string. Each `PredictablePair` is `{ sourceObjectApiName: string, destObjectApiName: string }`.

**Rationale**: The registry must be extensible per connector combination without code changes to the auto-link engine. A simple Map with composite key scales to N connector pairs. Unknown combinations return an empty array (no auto-links created).

**Known pairs for `salesforce:hubspot`**:
- Account -> Company
- Contact -> Contact
- Opportunity -> Deal
- Lead -> Contact (warning: fan-in with Contact -> Contact)

**Alternatives**: Database-stored pairs (over-engineering for a known finite set), hardcoded switch statement (brittle), ML-based matching (overkill, violates Principle IX — consultant should decide non-obvious pairs).

## Decision 3: Cascade Delete Strategy

**Decision**: Prisma `onDelete: Cascade` on all child relations. Removing an `ObjectMapping` automatically removes all `FieldMapping`s, which cascade to `MigrationLogic`, `ValueEquivalence`, `ClassificationPrompt`, and `MigrationFilter`.

**Rationale**: FR-011 requires cascade deletion. Prisma handles this at the database level via foreign key constraints, ensuring atomicity. No application-level cascade logic needed.

**Cascade chain**:
```
ObjectMapping (delete)
  -> FieldMapping (cascade)
      -> MigrationLogic (cascade)
          -> ValueEquivalence (cascade)
          -> ClassificationPrompt (cascade)
  -> MigrationFilter (cascade)
```

**Alternatives**: Application-level cascade (error-prone, non-atomic), soft delete (adds complexity, not required by spec).

## Decision 4: Fan-In / Fan-Out Handling

**Decision**: Both fan-out (one source to many destinations) and fan-in (many sources to one destination) are allowed. Fan-in triggers a visible warning badge on the destination card ("Conflit potentiel de doublons").

**Rationale**: FR-007 explicitly allows both patterns. Fan-out is a common migration pattern (e.g., Contact to both Contacts and Leads). Fan-in is valid but risky (record conflicts), hence the warning.

**Alternatives**: Block fan-in entirely (too restrictive — some migrations legitimately merge objects), auto-resolve conflicts (violates Principle IX).

## Decision 5: Search and Filter Implementation

**Decision**: Client-side filtering with two independent filter sets (one per column). Text search is case-insensitive substring match on object label and apiName. Category filters: All, Mapped only, Unmapped only, Standard only, Custom only.

**Rationale**: FR-013 requires text search and category filters. With typical CRM schemas (50-200 objects), client-side filtering is fast enough. Each column filters independently — searching in the source column does not affect the destination column.

**Alternatives**: Server-side filtering (unnecessary overhead for <200 items), single shared search (confusing UX when source and destination have different naming conventions).

## Decision 6: Object Detail Modal Data Sources

**Decision**: The detail modal (A3) aggregates data from multiple sources:
- Object name/label: from `SchemaObject` (via snapshot)
- Record count: from `ConnectorAdapter.getRecordCount()` (on-demand, cached)
- Fields remaining to validate: computed from `FieldMapping` count vs total `ObjectField` count
- Migration filter count: from `MigrationFilter` count for this ObjectMapping

**Rationale**: FR-008 requires all four pieces of information. Record count is the only external call — it is cached per session to avoid repeated connector queries. Field validation progress and filter count are pure database queries.

**Alternatives**: Pre-compute all stats at link creation time (stale data risk), lazy-load each section independently (too many loading spinners).

## Decision 7: Drift Highlighting Rendering

**Decision**: Consume `PlanDriftContext` (from spec 001) as a React context. Object-level drift types are rendered as:
- `OBJECT_ADDED`: "Nouveau" badge + faint green outline on the card
- `OBJECT_REMOVED`: Red dashed-border card + "Supprime en source/destination" badge + dashed red SVG link + one-click "Supprimer ce mapping" action

**Rationale**: FR-Drift-1/2/3 require visual surfacing of object-level drift. No auto-removal (Principle IX). The rendering is purely presentational — the drift detection algorithm lives in spec 003.

**Alternatives**: Separate drift page (too disconnected from mapping context), inline alerts (too noisy for individual cards).
