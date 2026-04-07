# Quickstart: Object Mapping

## Prerequisites

- Node.js 18+, npm
- Features 000, 001, 005, 008 implemented (Connector Interface, Migration Plan, Field Retrieval)
- Prisma schema includes MigrationPlan, SourceConnection, DestinationConnection, schema snapshot models

## Setup

```bash
# Install dependencies (if not already)
npm install

# Run Prisma migration after adding ObjectMapping model
npx prisma migrate dev --name add-object-mapping

# Start dev server
npm run dev
```

## Verify

1. Open `http://localhost:3000`
2. Create or open a migration plan with both source and destination connected
3. Navigate to the mapping step (should show the two-column object view)
4. Verify source objects appear on the left, destination objects on the right
5. Click a source circle then a destination circle to create a link
6. Click an object card to open the detail modal

## Run Tests

```bash
# Unit tests
npx vitest run tests/unit/services/object-mapping.test.ts
npx vitest run tests/unit/services/auto-link-registry.test.ts

# Integration tests
npx vitest run tests/integration/api/object-mapping.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/app/plans/[planId]/mapping/page.tsx` | Object mapping page |
| `src/lib/services/object-mapping.ts` | Domain logic |
| `src/lib/services/auto-link-registry.ts` | Predictable pair definitions |
| `src/components/mapping/ObjectMappingView.tsx` | Two-column layout |
| `prisma/schema.prisma` | ObjectMapping model |
