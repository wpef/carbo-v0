# Feature Specification: Migration Plan

**Feature**: 001-migration-plan
**Created**: 2026-03-27
**Status**: Draft
**Depends on**: 000-connector-interface

## User Story (atomic)

As a consultant, I can create a migration plan that serves as the container for an entire
migration project — from source and destination connection to field mapping and document
generation. A plan has a name, description, and tracks my progress through each step.

**Independent Test**: A consultant creates a plan named "Acme Corp Migration", sees it in the
plan list on the home page, opens it and sees the step-by-step workflow (all steps pending),
then deletes it.

**Acceptance Scenarios**:

1. **Given** the home page, **When** the consultant clicks "New Plan", **Then** a creation form
   appears asking for a name and optional description.
2. **Given** a valid plan name, **When** the consultant submits, **Then** the plan is created
   and the consultant is redirected to the plan detail page showing all steps as pending.
3. **Given** existing plans, **When** the consultant views the home page, **Then** all plans are
   listed with their name, status, and current step indicator.
4. **Given** a plan, **When** the consultant opens it, **Then** a vertical step workflow is
   displayed: Source → Destination → Object Mapping → Field Mapping → Documents.
   <!-- Updated: 2026-04-07 — Workflow simplified from 6 steps to 5. Source/Destination steps auto-retrieve schema+objects+fields. Field Mapping is a dedicated step, separate from Object Mapping. RUN step removed (Phase 2). -->
5. **Given** a plan with no dependencies, **When** the consultant deletes it, **Then** the plan
   and all associated data (connections, schemas, mappings, documents) are cascade-deleted.

## Edge Cases

- The consultant creates two plans with the same name: allowed (plans are identified by UUID, not name).
- The consultant deletes a plan mid-workflow: all associated connections, schemas, selections, and mappings are deleted.
- The consultant has 20+ plans: the home page displays them with pagination or scroll.

## Functional Requirements

- **FR-001**: The system MUST allow the consultant to create a migration plan with a name and
  optional description.
- **FR-002**: The system MUST display all plans on the home page with: name, description,
  current step/status, creation date, last update date.
- **FR-003**: The system MUST allow the consultant to delete a plan, cascade-deleting all
  associated data (connections, schemas, selections, mappings, documents).
- **FR-004**: The plan workflow (vertical step indicator with progress) MUST be displayed exactly once, in the persistent sidebar defined by FR-007. Each completed step shows a green checkmark; the current step is highlighted. The plan detail page (`/plans/[planId]`) MUST NOT render its own in-page copy of the workflow — the main content area shows only the plan metadata (name, description, creation date) and the current step's description + call-to-action.
  <!-- Updated: 2026-04-17 — Removed in-page workflow duplicate; workflow lives solely in the layout sidebar. -->
  <!-- Updated: 2026-04-08 — Ensuite déplacé dans la sidebar persistente du layout. -->
  <!-- Note: Refer to FR-007 for the layout structure. -->
  
- **FR-005**: The plan MUST track its overall status: DRAFT (in progress), READY (all steps
  before Run are complete), BROKEN (schema change broke mappings).
- **FR-006**: All plan operations MUST be logged to the audit trail.
- **FR-007**: The plan detail page MUST use a persistent layout with: a fixed header (plan name, status badge, source/destination connector labels with connection status), a persistent left sidebar (workflow steps + next-step button), and a scrollable main content area. The sidebar and header MUST NOT scroll.
  <!-- Added: 2026-04-08 -->
- **FR-008**: The sidebar MUST display a "next step" button pinned at the bottom. The button MUST be active when the current step is valid (i.e., the user is on the current max step or a completed step). When clicked on the max step, it MUST advance the plan via `PATCH /step` then navigate. When clicked on a completed step, it MUST navigate directly.
  <!-- Added: 2026-04-08 -->
- **FR-009**: The header MUST display the plan's source and destination connector types and connection statuses (green dot = connected, grey dot = not connected). The `getPlan` API MUST include `sourceConnection` and `destinationConnection` data.
  <!-- Added: 2026-04-08 -->

## Key Entities

- **MigrationPlan**: Top-level container. Fields: id, name, description, status (DRAFT/READY/BROKEN),
  sourceConnectionId (nullable), destinationConnectionId (nullable), currentStep, createdAt, updatedAt.

## Success Criteria

- **SC-001**: A consultant can create, view, and delete a plan in under 30 seconds.
- **SC-002**: The home page loads the plan list in under 1 second.
- **SC-003**: Deleting a plan removes 100% of associated data.

## Assumptions

- The home page is a plan list — there is no content outside of a plan context.
- A plan has at most one source connection and one destination connection.
- All features (connection, schema, mapping, documents) are scoped to a plan.

## Session Learnings

### Bugs résolus

1. **No navigation after source connection** — After connecting a source, there was no button to proceed. Fixed by adding "Next" buttons on every step page and an API endpoint (`PATCH /api/plans/[planId]/step`) for forward-only step advancement.
2. **Plan step not advancing** — `currentStep` was hardcoded to advance inside `connectSource()`/`connectDestination()` services, creating coupling. Step advancement is now client-driven via the step API.
3. **Legacy step values in DB** — Existing plans with old step names (`SOURCE_CONNECTION`, `OBJECT_SELECTION`, etc.) would break. Added `normalizeStep()` function that maps legacy values to new step names.
4. **Sidebar next-step button never active** — The sidebar button checked `nextStepIndex <= currentMaxIndex`, which prevented advancing from the current max step. Fixed by changing the condition to `activeIndex <= currentMaxIndex` so the button is active when the user is on the current step (can advance) or any completed step.
   <!-- Added: 2026-04-08 -->
5. **Sidebar sticky not working** — The preview sidebar and workflow sidebar used `position: sticky` inside a parent with `overflow-auto`, which creates a new scroll context and breaks sticky positioning. Fixed by restructuring the layout: the outer wrapper is `h-screen overflow-hidden`, the sidebar is a flex child (no sticky needed), and only the main content area scrolls (`overflow-auto`).
   <!-- Added: 2026-04-08 -->
6. **Workflow duplicated on plan detail page** — The plan detail page rendered its own `<StepWorkflow>` aside in addition to the layout's persistent sidebar, showing the workflow twice. Fixed by removing the in-page workflow and the duplicated back-link/plan-header (already provided by the layout). The detail page now shows only plan metadata (name, description, creation date) + current-step action.
   <!-- Added: 2026-04-17 -->

### Clarifications

1. **Workflow steps reduced from 6 to 5**: `SOURCE → DESTINATION → MAPPING → FIELD_MAPPING → DOCUMENTS`. The `OBJECT_SELECTION` step is absorbed into `SOURCE` (auto-selected after connection). The `RUN` step is deferred to Phase 2.
2. **Auto-setup after connection**: When the user connects a source or destination, schema retrieval, object selection (defaults), and field retrieval happen automatically in sequence. The user only clicks "Connect" — no manual "Retrieve Schema" or "Retrieve Fields" steps.
3. **Field Mapping is a dedicated step**: Field mapping is NOT a sub-feature of object mapping. It has its own page (`/field-mapping`) and step in the workflow. The user validates object correspondences first, then maps fields.
4. **Step advancement is forward-only**: The `PATCH /step` API validates that the target step index is strictly greater than the current step. No backward navigation via API.
5. **Persistent layout with sidebar navigation**: The plan uses a shared layout (`layout.tsx`) with three zones: a fixed header (plan name, status badge, source/destination connector info with connection status dots), a persistent left sidebar (workflow steps + next-step button pinned at bottom), and a scrollable main content area. The sidebar and header never scroll — only the main content does.
   <!-- Added: 2026-04-08 -->
6. **Centralized step advancement**: Per-page "Next" buttons (e.g., "Next: Object Mapping →") have been removed from source, destination, mapping, and field-mapping pages. Step advancement is handled exclusively by the sidebar's next-step button, which calls `PATCH /step` when the user is on the current max step, then navigates. This avoids duplicate navigation controls and ensures the sidebar always reflects the current state.
   <!-- Added: 2026-04-08 -->
7. **Header displays connector info**: The plan header shows: plan name (link to plan overview), status badge (Brouillon/Prêt/Erreur), and on the right side: source connector label + connection status dot → destination connector label + connection status dot. The `getPlan` API now includes `sourceConnection` and `destinationConnection` with `adapterType` and `status`.
   <!-- Added: 2026-04-08 -->
8. **Page-specific navigation preserved**: Pages may still have navigation buttons specific to their context (e.g., "Objet suivant" in field-mapping to cycle between object pairs). Only cross-step "Next" buttons were removed.
   <!-- Added: 2026-04-08 -->
