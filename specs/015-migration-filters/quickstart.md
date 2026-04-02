# Quickstart: Migration Filters

## Prerequisites

- Feature 011 (Object Mapping) implemented
- At least one ObjectMapping exists in a plan with a connected source

## Setup

```bash
# Run Prisma migration after adding MigrationFilter model
npx prisma migrate dev --name add-migration-filter

# Start dev server
npm run dev
```

## Verify

1. Open a plan with an object mapping (e.g., Contact to Contacts)
2. Open the filter panel (via object detail modal or mapping view)
3. Add a filter: field "Email", operator "NOT_EQUALS", value ""
4. Add a second filter: field "CreatedDate", operator "DATE_AFTER", value "2020-01-01"
5. Verify both filters appear with "AND" between them
6. Check the estimated record count updates
7. Remove one filter and verify the estimate recalculates

## Run Tests

```bash
npx vitest run tests/unit/services/migration-filter.test.ts
npx vitest run tests/unit/services/filter-estimation.test.ts
npx vitest run tests/integration/api/migration-filter.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/components/mapping/MigrationFilterPanel.tsx` | Filter list + add form |
| `src/lib/services/migration-filter.ts` | Domain logic |
| `src/lib/services/filter-estimation.ts` | Record count estimation |
| `prisma/schema.prisma` | MigrationFilter model |
