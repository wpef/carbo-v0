# Research: Migration Plan

## Decision: Plan status tracking

**Chosen**: Enum field `status` on MigrationPlan with values: DRAFT, READY, BROKEN.

**Rationale**: Per FR-005, plans must track overall status. DRAFT is the default (in-progress). READY means all pre-Run steps are complete. BROKEN indicates a schema change broke mappings. Status transitions are explicit and logged.

**Rejected**: Computed status from step completion. Would require querying all related entities to determine status — fragile and slow.

## Decision: Step workflow representation

**Chosen**: A `currentStep` string field on MigrationPlan plus a static step definition array in the UI.

**Rationale**: Steps are fixed and sequential (Source Connection -> Object Selection -> Destination Connection -> Mapping -> Documents -> Run). Storing the current step as a string identifier is sufficient. The step definitions (labels, order, icons) live in a UI constant — not in the database.

**Rejected**: Separate `Step` table with per-plan rows. Over-engineering for a fixed sequence.

## Decision: Audit trail implementation

**Chosen**: Dedicated `AuditLog` table in Prisma with: id, planId (nullable), action, details (JSON string), timestamp.

**Rationale**: Constitution Principle VI requires persistent audit trail. A dedicated table enables querying by plan, action type, or time range. The `planId` is nullable to support system-level events not tied to a specific plan.

**Rejected**: File-based logging. Not queryable, not tied to plans, not persistent across deployments.

## Decision: Cascade deletion strategy

**Chosen**: Prisma `onDelete: Cascade` on all relations pointing to MigrationPlan.

**Rationale**: FR-003 requires deleting a plan to cascade-delete all associated data. Prisma's referential actions handle this at the database level, which is atomic and reliable.

**Rejected**: Application-level cascade (delete connections, then schemas, then plan). Race conditions and partial failures possible.

## Decision: Prisma client singleton

**Chosen**: Module-level singleton with `globalThis` persistence for dev hot-reload.

**Rationale**: Standard Next.js + Prisma pattern. Without globalThis, each hot-reload creates a new PrismaClient, eventually exhausting database connections.

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Decision: UUID generation

**Chosen**: Prisma `@default(uuid())` for plan IDs.

**Rationale**: Plans are identified by UUID (not name, per spec edge case "two plans with the same name: allowed"). Prisma handles UUID generation at the database level.

## Constraint: No Prisma schema exists yet

The project currently has only `prisma/dev.db` (empty). The schema.prisma file must be created from scratch, including the datasource, generator, and both MigrationPlan and AuditLog models.

## Constraint: shadcn/ui components

The plan list and creation form use shadcn/ui components (Card, Dialog, Button, Input, Badge). These must be installed via `npx shadcn-ui@latest add <component>` before use.
