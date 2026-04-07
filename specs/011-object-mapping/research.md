# Research: Object Mapping

## Decision 1: Visual Link Rendering

**Options**:
- **SVG lines**: Draw SVG paths between connection circles. Simple, performant, CSS-animatable.
- **Canvas**: HTML5 canvas for link rendering. Better for 1000+ links, but harder to make interactive.
- **CSS-only**: Pure CSS connectors with absolute positioning. Limited to straight lines.

**Decision**: SVG lines. The expected link count (max ~50 per plan) is well within SVG performance limits. SVG paths support bezier curves for visual appeal, are CSS-styleable, and each path is a DOM element that can receive click events (needed for opening migration logic modal in 013).

## Decision 2: Link Creation Interaction Pattern

**Options**:
- **Drag from circle to circle**: Intuitive but complex to implement (drag state, drop targets, visual feedback).
- **Click source circle, then click destination circle**: Simpler state machine (IDLE -> SOURCE_SELECTED -> link created). No drag handling needed.
- **Dropdown selection**: Select destination from a dropdown on the source card. No visual feedback during creation.

**Decision**: Click-click pattern (two-click). Simpler to implement, works well on all devices, and the state machine is trivial: `idle -> sourceSelected(objectName) -> idle` with link creation on second click. A visual indicator (highlighted circle, subtle connecting line following cursor) provides feedback during the intermediate state.

## Decision 3: Auto-Link Registry Architecture

**Options**:
- **Database table**: Store predictable pairs in DB. Flexible, admin-editable at runtime.
- **Static config file**: JSON/TS map of connector-pair to object-pair list. Simple, version-controlled.
- **Adapter method**: Each adapter declares its known pairs. Distributed, harder to find.

**Decision**: Static TypeScript map in `src/lib/services/auto-link-registry.ts`. For v0 we only have SF-HS, so a static map is sufficient. The map is keyed by `${sourceAdapterType}:${destinationAdapterType}` and returns an array of `{ sourceObject, destinationObject }` pairs. Easy to extend for new connector combinations.

## Decision 4: Cascade Deletion Strategy

**Options**:
- **Prisma cascade**: Use `onDelete: Cascade` in schema. Automatic, but implicit.
- **Service-level cascade**: Delete children explicitly in ObjectMappingService before deleting the mapping. Explicit, auditable.
- **Soft delete**: Mark as deleted instead of removing. Recoverable, but adds complexity.

**Decision**: Service-level cascade. Principle VI (Traceability) requires logging each deletion. Prisma cascades are silent. The service explicitly deletes FieldMappings, MigrationLogicRules, MigrationFilters, then the ObjectMapping, logging each step. Prisma `onDelete: Cascade` is kept as a safety net but the service handles the primary flow.

## Decision 5: Object List Performance for 100+ Objects

**Options**:
- **Virtualized list**: Only render visible items (react-window or similar). Required for 1000+.
- **Simple scrollable div**: Render all items. Sufficient for ~200 objects.
- **Paginated list**: Load objects in pages. Adds pagination UI complexity.

**Decision**: Simple scrollable div with search/filter. 100-200 objects generate ~100-200 DOM nodes, well within browser limits. A search input filters the list client-side. Virtualization can be added later if performance degrades.

## Decision 6: Fan-In Warning Mechanism

When multiple source objects map to the same destination object, the spec requires a visible warning about potential record conflicts. The warning is computed at render time by grouping ObjectMappings by destinationObjectName and flagging any destination with count > 1. No separate database field needed.
