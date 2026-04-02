# Quickstart: Mapping Integrity Check

## Prerequisites

- Features 011 (Object Mapping) and 012 (Field Mapping) implemented
- At least one plan with field mappings
- Source or destination connection available for schema refresh

## Setup

```bash
# Run Prisma migration after adding IntegrityIssue model
npx prisma migrate dev --name add-integrity-issue

# Start dev server
npm run dev
```

## Verify

1. Open a plan with existing field mappings
2. Simulate a schema change:
   - Delete a field from the schema snapshot (via DB or test helper)
   - Or change a field type in the schema snapshot
3. Trigger integrity check (POST endpoint or via schema refresh)
4. Verify the plan status changes to BROKEN
5. Verify IntegrityIssues are displayed in the banner
6. Fix the broken mapping (remove or remap the field)
7. Verify the IntegrityIssue is resolved and plan status recovers

## Run Tests

```bash
npx vitest run tests/unit/services/integrity-check.test.ts
npx vitest run tests/integration/api/integrity-check.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/services/integrity-check.ts` | Core check logic |
| `src/components/mapping/IntegrityIssuesBanner.tsx` | Plan-level warning banner |
| `prisma/schema.prisma` | IntegrityIssue model |
