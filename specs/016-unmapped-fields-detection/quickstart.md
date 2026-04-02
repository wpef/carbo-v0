# Quickstart: Unmapped Fields Detection

## Prerequisites

- Features 011 (Object Mapping) and 012 (Field Mapping) implemented
- At least one ObjectMapping with some (but not all) fields mapped

## Setup

```bash
# Run Prisma migration after adding FieldExclusion model
npx prisma migrate dev --name add-field-exclusion

# Start dev server
npm run dev
```

## Verify

1. Open a plan with an object mapping where some fields are mapped
2. Verify the unmapped fields warning panel is visible in the field mapping view
3. Check that unmapped source fields are listed with their names and types
4. Check that unmapped required destination properties are listed separately
5. Mark a source field as "intentionally excluded" -- verify it moves to the excluded section
6. Reverse the exclusion -- verify the field reappears in the unmapped list
7. Create a field mapping for a previously excluded field -- verify the exclusion is auto-cleared

## Run Tests

```bash
npx vitest run tests/unit/services/unmapped-fields.test.ts
npx vitest run tests/integration/api/unmapped-fields.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/components/mapping/UnmappedFieldsPanel.tsx` | Warning panel |
| `src/lib/services/unmapped-fields.ts` | Computation logic |
| `prisma/schema.prisma` | FieldExclusion model |
