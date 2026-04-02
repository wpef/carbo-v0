# API Contracts: Rule Description Engine

## POST /api/plans/[planId]/rule-descriptions

Generate human-readable descriptions for all migration logic rules in a plan.

### Request

No body required. The route loads all migration logic rules from the plan.

### Response 200

```json
{
  "descriptions": [
    {
      "ruleId": "clxyz123",
      "logicType": "VALUE_EQUIVALENCE",
      "description": "'Web' becomes 'Online', 'Referral' becomes 'Partner', 'Phone' becomes 'Call', and 2 more equivalences.",
      "source": "template",
      "latencyMs": null
    },
    {
      "ruleId": "clxyz456",
      "logicType": "PROMPT",
      "description": "Free-text values are classified into categories using AI: Support, Sales, or Other.",
      "source": "llm",
      "latencyMs": 2340
    },
    {
      "ruleId": "clxyz789",
      "logicType": "INFORMATIONAL",
      "description": "The value will be copied as-is.",
      "source": "template",
      "latencyMs": null
    },
    {
      "ruleId": "clxyz000",
      "logicType": "ERROR",
      "description": "These field types are incompatible (text to number). A CSV file with source values and destination record IDs will be provided after migration for manual update.",
      "source": "template",
      "latencyMs": null
    }
  ],
  "stats": {
    "templateCount": 8,
    "llmCount": 2,
    "fallbackCount": 0,
    "totalLatencyMs": 4200
  }
}
```

### Response 404

```json
{ "error": "Plan not found" }
```

### Response 500

```json
{ "error": "Failed to generate descriptions", "details": "..." }
```

### Types

```typescript
interface RuleDescription {
  ruleId: string;
  logicType: 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL';
  description: string;
  source: 'template' | 'llm' | 'fallback';
  latencyMs: number | null;
}

interface DescriptionBatch {
  descriptions: RuleDescription[];
  stats: {
    templateCount: number;
    llmCount: number;
    fallbackCount: number;
    totalLatencyMs: number;
  };
}
```
