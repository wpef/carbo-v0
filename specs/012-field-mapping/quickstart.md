# Quickstart: Field Mapping

## Prerequisites

- Features 000-008 implemented (Connector Interface through Destination Field Retrieval)
- Feature 011 (Object Mapping) implemented
- At least one ObjectMapping exists in a plan

## Setup

```bash
# Run Prisma migration after adding FieldMapping model
npx prisma migrate dev --name add-field-mapping

# Start dev server
npm run dev
```

## Verify

1. Open a migration plan with an existing object mapping
2. Click on the object mapping link (or navigate to the object mapping)
3. Verify the field mapping two-column view loads with source fields (left) and destination fields (right)
4. Check that auto-matching created links for known field correspondences
5. Click a source field circle then a destination field circle to create a manual link
6. Verify link color reflects compatibility status
7. Click a field card to open the detail modal

## Run Tests

```bash
npx vitest run tests/unit/services/field-mapping.test.ts
npx vitest run tests/unit/services/type-compatibility.test.ts
npx vitest run tests/unit/services/field-auto-match-registry.test.ts
npx vitest run tests/integration/api/field-mapping.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/app/plans/[planId]/mapping/[mappingId]/page.tsx` | Field mapping page |
| `src/lib/services/field-mapping.ts` | Domain logic |
| `src/lib/services/type-compatibility.ts` | Type compatibility matrix (shared with 013, 017) |
| `src/lib/services/field-auto-match-registry.ts` | Native field correspondences |
| `src/components/mapping/FieldMappingView.tsx` | Two-column layout |
