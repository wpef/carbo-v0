# Quickstart: Source Field Retrieval

## Prerequisites

- Feature 000 (Connector Interface) types defined
- Feature 001 (Migration Plan) implemented
- Feature 002 (Source Connection) implemented
- Feature 003 (Source Schema Retrieval) implemented
- Feature 004 (Source Object Selection) implemented: ObjectSelection model, selection API, at least one object selected

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
```

## Setup

```bash
# 1. Run Prisma migration after adding ObjectField model
npx prisma migrate dev --name add-object-field

# 2. Verify the schema
npx prisma studio
```

## Development

```bash
npm run dev
```

## Verification

1. Open `http://localhost:3000`
2. Open a plan with connected source, retrieved schema, and selected objects (from 002 + 003 + 004)
3. Navigate to the field retrieval step
4. Click "Retrieve Fields"
5. Verify: progress indicator shows per-object progress
6. After completion, verify: each selected object shows its fields
7. Click an object to expand and see fields with: label, apiName, type, required/optional, unique, read-only, relationship info
8. Verify: inaccessible fields (if any in demo data) show "No Access" badge
9. Check if destination is connected -- see appropriate "Next step" guidance

## Test

```bash
npx vitest run tests/unit/services/field-retrieval.test.ts
npx vitest run tests/integration/api/field-retrieval.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | ObjectField model |
| `src/app/plans/[planId]/source/fields/page.tsx` | Field retrieval step UI |
| `src/app/api/plans/[planId]/source/fields/route.ts` | POST retrieve + GET all fields |
| `src/lib/services/field-retrieval.ts` | Domain service |
| `src/components/fields/ObjectFieldAccordion.tsx` | Object accordion with field tables |
| `src/components/fields/FieldTable.tsx` | Field display table |
