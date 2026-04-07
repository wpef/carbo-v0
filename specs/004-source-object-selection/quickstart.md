# Quickstart: Source Object Selection

## Prerequisites

- Feature 000 (Connector Interface) types defined
- Feature 001 (Migration Plan) implemented
- Feature 002 (Source Connection) implemented
- Feature 003 (Source Schema Retrieval) implemented: SchemaSnapshot + SchemaObject models, retrieval API

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
```

## Setup

```bash
# 1. Run Prisma migration after adding ObjectSelection model
npx prisma migrate dev --name add-object-selection

# 2. Verify the schema
npx prisma studio
```

## Development

```bash
npm run dev
```

## Verification

1. Open `http://localhost:3000`
2. Open a plan with a connected source and retrieved schema (from 002 + 003)
3. Navigate to the object selection step
4. Verify: custom objects and common business objects are pre-selected
5. Toggle "Hide system objects" off -> verify system objects appear (deselected)
6. Use search bar to filter objects by name
7. Click expand on an object -> verify record count, fields, and sample records appear
8. Select/deselect objects, navigate away, return -> verify selection is restored
9. Try to proceed with zero objects selected -> verify validation message

## Test

```bash
npx vitest run tests/unit/services/object-selection.test.ts
npx vitest run tests/integration/api/object-selection.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | ObjectSelection model |
| `src/app/plans/[planId]/source/objects/page.tsx` | Object selection step UI |
| `src/app/api/plans/[planId]/source/objects/route.ts` | GET list + PUT bulk update |
| `src/app/api/plans/[planId]/source/objects/[objectId]/expand/route.ts` | On-demand expand |
| `src/lib/services/object-selection.ts` | Domain service |
| `src/components/objects/ObjectSelectionList.tsx` | Selectable list with search |
