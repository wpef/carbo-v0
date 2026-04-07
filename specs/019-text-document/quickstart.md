# Quickstart: Text Document Generation

## Prerequisites

- Node.js 18+
- Feature 013 (migration-logic), 016 (unmapped-fields-detection), 018 (rule-description-engine) implemented
- Prisma schema includes `TextDocument` model
- `ANTHROPIC_API_KEY` set in `.env.local` (optional -- needed only if plan has PROMPT rules)

## Setup

```bash
# After adding TextDocument to prisma/schema.prisma
npx prisma db push
```

## Generate a Document

```bash
# Via API
POST /api/plans/{planId}/documents/text

# Response: document metadata with stats (no HTML body)
```

## View a Document

```bash
# List versions
GET /api/plans/{planId}/documents/text

# Get specific document with HTML
GET /api/plans/{planId}/documents/text/{documentId}
```

## Preview in App

Navigate to `/plans/{planId}/documents/text/{documentId}` to see the rendered HTML preview in an iframe.

## Run Tests

```bash
npx vitest run tests/unit/services/text-document/
npx vitest run tests/integration/text-document.test.ts
```

## Key Behaviors

- Each POST creates a **new immutable version** -- documents are never updated
- Stats (field count, rule count, etc.) are snapshot values at generation time
- If the plan has PROMPT rules and no API key, rule descriptions show fallback text
- A table of contents is included when the plan has 3+ object mappings
