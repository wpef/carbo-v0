# Quickstart: Rule Description Engine

## Prerequisites

- Node.js 18+
- Feature 013 (migration-logic) implemented (MigrationLogic, ValueEquivalence, ClassificationPrompt entities available)

## Environment Variables

```bash
# Required for LLM-powered descriptions (PROMPT logic type)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: override default timeout (milliseconds)
RULE_DESCRIPTION_TIMEOUT_MS=15000
```

If `ANTHROPIC_API_KEY` is not set, PROMPT rules fall back to raw prompt text + "(requires review)". Template-based descriptions (VALUE_EQUIVALENCE, INFORMATIONAL, ERROR) work without any API key.

## Install

```bash
npm install @anthropic-ai/sdk
```

## Usage (service layer)

```typescript
import { generateDescriptions } from '@/lib/services/rule-description';

const batch = await generateDescriptions(migrationLogicRules);
// batch.descriptions: RuleDescription[]
// batch.stats: { templateCount, llmCount, fallbackCount, totalLatencyMs }
```

## Usage (API route)

```bash
# Generate descriptions for all rules in a plan
POST /api/plans/{planId}/rule-descriptions

# Response
{
  "descriptions": [
    { "ruleId": "...", "logicType": "VALUE_EQUIVALENCE", "description": "...", "source": "template" },
    { "ruleId": "...", "logicType": "PROMPT", "description": "...", "source": "llm", "latencyMs": 2340 }
  ],
  "stats": { "templateCount": 8, "llmCount": 2, "fallbackCount": 0, "totalLatencyMs": 4200 }
}
```

## Run Tests

```bash
npx vitest run tests/unit/services/rule-description/
```
