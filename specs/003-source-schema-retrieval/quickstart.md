# Quickstart: Source Schema Retrieval

## Prerequisites

- Feature 000 (Connector Interface) types defined
- Feature 001 (Migration Plan) implemented
- Feature 002 (Source Connection) implemented: SourceConnection model + connect/disconnect API

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
```

## Setup

```bash
# 1. Run Prisma migration after adding SchemaSnapshot + SchemaObject models
npx prisma migrate dev --name add-schema-snapshot

# 2. Verify the schema
npx prisma studio
```

## Development

```bash
npm run dev
```

## Verification

1. Open `http://localhost:3000`
2. Open a plan with an active source connection (from 002)
3. Navigate to the schema retrieval step
4. Click "Retrieve Schema"
5. Verify: object list appears with labels, API names, standard/custom badges
6. Click "Refresh Schema" again
7. Verify: diff view shows "No changes detected" (same demo data)

## Test

```bash
npx vitest run tests/unit/services/schema-retrieval.test.ts
npx vitest run tests/integration/api/schema-retrieval.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | SchemaSnapshot + SchemaObject models |
| `src/app/plans/[planId]/source/schema/page.tsx` | Schema retrieval step UI |
| `src/app/api/plans/[planId]/source/schema/route.ts` | POST retrieve + GET current |
| `src/lib/services/schema-retrieval.ts` | Domain service (retrieve, rotate, diff) |
| `src/components/schema/ObjectList.tsx` | Object list display |
| `src/components/schema/SchemaDiff.tsx` | Diff display |
