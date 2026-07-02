# Quickstart: Rule Description Engine

## What this feature provides

A backend service that converts migration logic rules (from feature 013) into human-readable natural language descriptions for use in client-facing documents. No UI -- consumed by features 019 (text document) and 020 (contractual document).

## Prerequisites

- Feature 013 (Migration Logic) entities available: MigrationLogic, ValueEquivalence, ClassificationPrompt
- `@anthropic-ai/sdk` installed (`npm install @anthropic-ai/sdk`)
- Optional: `ANTHROPIC_API_KEY` environment variable set for LLM-powered PROMPT descriptions

## How to use

### 1. Build description inputs from migration logic

```typescript
import type { DescriptionInput, DescriptionBatchInput } from '@/features/rule-descriptions/types'

// Example: build inputs from a plan's migration logic rules
const rules: DescriptionInput[] = [
  {
    ruleId: 'ml_001',
    logicType: 'VALUE_EQUIVALENCE',
    valueEquivalences: [
      { sourceValue: 'Web', destinationValue: 'Online' },
      { sourceValue: 'Referral', destinationValue: 'Partner' },
      { sourceValue: 'Trade Show', destinationValue: 'Event' },
    ],
    unmappedSourceValues: ['Cold Call'],
  },
  {
    ruleId: 'ml_002',
    logicType: 'PROMPT',
    promptText: 'Classify this text into one of the following categories based on the content',
    destinationPicklistValues: ['Support', 'Sales', 'Other'],
  },
  {
    ruleId: 'ml_003',
    logicType: 'INFORMATIONAL',
    informationalMessage: 'La valeur sera copiee.',
  },
  {
    ruleId: 'ml_004',
    logicType: 'ERROR',
    sourceFieldType: 'Text',
    destinationFieldType: 'Number',
  },
]

const batchInput: DescriptionBatchInput = {
  planId: 'plan_abc123',
  rules,
}
```

### 2. Generate descriptions

```typescript
import { generateDescriptions } from '@/features/rule-descriptions/services/description-service'

const batch = await generateDescriptions(batchInput)

// batch.descriptions[0].description
// → "'Web' devient 'Online', 'Referral' devient 'Partner', 'Trade Show' devient 'Event'. 1 valeur source sans equivalence."

// batch.descriptions[1].description
// → "Les valeurs textuelles sont classifiees par IA dans les categories suivantes : Support, Sales, Other."

// batch.descriptions[2].description
// → "La valeur sera copiee."

// batch.descriptions[3].description
// → "Types incompatibles (Text vers Number). Les valeurs seront exportees en CSV pour mise a jour manuelle."

// batch.stats
// → { templateCount: 3, llmCount: 1, fallbackCount: 0, totalLatencyMs: 1200 }
```

### 3. Without API key (graceful degradation)

```typescript
// If ANTHROPIC_API_KEY is not set:
// batch.descriptions[1].description
// → "Classify this text into one of the following categories based on the content (necessite une verification)"
// batch.descriptions[1].source → "fallback"
// batch.stats.fallbackCount → 1
```

## Dependencies

- **Depends on**: 013 (Migration Logic entities)
- **Used by**: 019 (Text Document), 020 (Contractual Document)
