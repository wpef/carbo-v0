# Quickstart: Migration Logic

## Prerequisites

- Features 011 (Object Mapping) and 012 (Field Mapping) implemented
- At least one FieldMapping exists
- (Optional) `ANTHROPIC_API_KEY` set in `.env.local` for D2 LLM classification

## Setup

```bash
# Run Prisma migration after adding MigrationLogic, ValueEquivalence, ClassificationPrompt models
npx prisma migrate dev --name add-migration-logic

# (Optional) Set up Claude API key for D2 classification
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local

# Start dev server
npm run dev
```

## Verify

1. Open a plan with field mappings
2. Click on a field link (C1) to open the migration logic modal
3. Verify the correct section appears based on type combination:
   - Picklist-to-Picklist: D1 (Value Equivalence) with auto-linked matching values
   - Text-to-Picklist: D2 (Prompt) with classification examples (if API key set)
   - Text-to-Number: D3 (Error) with red-bordered message
   - Text-to-Text: D4 (Informational) with "copied as-is" message
4. Test Save and Validate buttons, verify link color changes
5. Re-open the modal to verify persisted state loads correctly

## Run Tests

```bash
npx vitest run tests/unit/services/migration-logic.test.ts
npx vitest run tests/unit/services/classification.test.ts
npx vitest run tests/integration/api/migration-logic.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/components/mapping/MigrationLogicModal.tsx` | Modal wrapper (C2) |
| `src/components/mapping/ValueEquivalenceSection.tsx` | D1 section |
| `src/components/mapping/ClassificationPromptSection.tsx` | D2 section |
| `src/lib/services/migration-logic.ts` | Domain logic |
| `src/lib/services/classification.ts` | Claude API integration |
| `src/lib/services/type-compatibility.ts` | Matrix (from 012, reused) |
