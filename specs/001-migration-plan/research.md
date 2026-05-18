# Research: Migration Plan

## Decision 1: Workflow Step State Machine

**Decision**: Steps are stored as a single `currentStep` enum value on the MigrationPlan model. Steps are ordered: `SOURCE → DESTINATION → MAPPING → FIELD_MAPPING → DOCUMENTS`. Advancement is forward-only via `PATCH /step`.

**Rationale**: The spec explicitly states forward-only advancement (Clarification 4). A single enum field is simpler than a separate `PlanStep` join table. The ordering is encoded in a constant array in `steps.ts`, not in the database — this allows reordering without a migration.

**Alternatives**: Separate `PlanStep` table with per-step status (over-engineered for 5 steps), numeric step index (loses semantic meaning in DB queries).

## Decision 2: Persistent Layout Architecture

**Decision**: Next.js nested layout at `app/plans/[planId]/layout.tsx` renders the fixed header, sidebar, and scrollable main area. The sidebar and header use `flex` with `h-screen overflow-hidden` on the outer container; only the main content area has `overflow-auto`.

**Rationale**: Session Learning #5 from the spec documents that `position: sticky` breaks inside `overflow-auto` parents. The flex-based layout avoids this entirely. Next.js App Router layouts persist across child navigations, so the sidebar and header never re-mount during intra-plan navigation.

**Alternatives**: CSS Grid layout (equivalent but less idiomatic for sidebar patterns), `position: fixed` (requires manual margin offsets, fragile).

## Decision 3: Cascade Delete Strategy

**Decision**: Use Prisma's `onDelete: Cascade` on all relations pointing to MigrationPlan. The `DELETE /api/plans/[planId]` route issues a single `prisma.migrationPlan.delete()` and Postgres cascades the rest.

**Rationale**: FR-003 and SC-003 require 100% associated data removal. Database-level cascades are atomic and cannot leave orphans (unlike application-level sequential deletes). Prisma models the cascade in the schema, so it is visible and auditable.

**Alternatives**: Application-level cascade (risk of partial deletes on error), soft-delete with background cleanup (adds complexity, not needed for v0).

## Decision 4: Audit Trail Design

**Decision**: A single `AuditLog` table with: `id`, `planId` (nullable FK), `action` (string), `entityType` (string), `entityId` (string), `details` (JSON), `createdAt`. Logged via a shared `logAudit()` utility called from service functions.

**Rationale**: FR-006 requires all plan operations to be logged. A single table is sufficient for Phase 1. The `planId` FK allows querying all audit events for a plan (useful for document generation in feature 019/020). JSON `details` keeps the schema flexible for different event types.

**Alternatives**: Per-entity audit tables (too many tables for v0), event sourcing (overkill), console-only logging (violates Principle VI — must be persistent).

## Decision 5: Drift Detection Architecture

**Decision**: Drift detection runs client-side on "plan visit" boundaries using `sessionStorage`. The plan layout component checks `sessionStorage.lastVisitedPlanId` on mount. If different from the current plan, it fires `detectLiveDrift` for both source and destination in parallel, stores the merged result in `PlanDriftContext`, and renders the banner.

**Rationale**: FR-010 specifies `sessionStorage`-based visit detection. Client-side execution avoids unnecessary API calls for intra-plan navigation. The context provider (FR-015) makes the drift report available to all child pages without re-fetching.

**Alternatives**: Server-side drift check on every page load (wasteful, violates "once per visit"), polling (over-engineered), service worker (too complex for this use case).

## Decision 6: Drift Banner and Sidebar Badge Rendering

**Decision**: The drift banner is a React component rendered in the plan layout between the header and the sidebar+main split. Sidebar badges are computed from the merged DriftReport using a per-step mapping function in `drift-utils.ts`. Both components read from `PlanDriftContext`.

**Rationale**: FR-011 requires the banner to be non-blocking. Rendering it in the layout (not as a modal) satisfies this. FR-014 requires per-step badge counts computed from the drift report — a pure function in `drift-utils.ts` maps drift changes to workflow steps using the table defined in the spec.

**Alternatives**: Toast notifications (dismissed too easily, not persistent), modal (blocks — violates FR-011 and Principle IX).

## Decision 7: Step Status Display

**Decision**: Plan status uses three values: `DRAFT` (in progress), `READY` (all steps before Documents complete), `BROKEN` (schema drift broke mappings). The status badge in the header maps to French labels: Brouillon, Pret, Erreur.

**Rationale**: FR-005 defines exactly these three statuses. The BROKEN status is set by the mapping integrity check (feature 017) — not by plan-level code. The plan service only transitions between DRAFT and READY based on step completion.

**Alternatives**: More granular statuses (PAUSED, ARCHIVED) — deferred to Phase 2 if needed.

## Decision 8: objectAutoLinkedAt Gate

**Decision**: The `objectAutoLinkedAt` field on MigrationPlan is a nullable `DateTime`. It is set exactly once by the object mapping auto-link process (feature 011). Once set, auto-link never re-fires for that plan, even if all mappings are manually deleted.

**Rationale**: Principle IX requires that auto-link runs only at first connection, not after schema refresh. This field is the gate: `if (plan.objectAutoLinkedAt !== null) skip auto-link`. The timestamp also serves as an audit record of when auto-link ran.

**Alternatives**: Boolean flag `autoLinked` (loses the "when" information), separate `AutoLinkEvent` table (overkill for a single flag).
