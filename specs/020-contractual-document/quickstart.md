# Quickstart: Contractual Document Generation

## Prerequisites

- Node.js 18+
- Features 013 (migration-logic), 016 (unmapped-fields-detection), 018 (rule-description-engine) implemented
- Prisma schema includes `ContractualDocument` model
- `ANTHROPIC_API_KEY` set in `.env.local` (optional -- needed only if plan has PROMPT rules)

## Setup

```bash
# After adding ContractualDocument to prisma/schema.prisma
npx prisma db push
```

## Generate a Document

```bash
# Via API
POST /api/plans/{planId}/documents/contractual

# Response: document metadata with reference number + stats (no HTML body)
```

## View a Document

```bash
# List versions
GET /api/plans/{planId}/documents/contractual

# Get specific document with HTML
GET /api/plans/{planId}/documents/contractual/{documentId}
```

## Preview in App

Navigate to `/plans/{planId}/documents/contractual/{documentId}` to see the formal document preview.

## Run Tests

```bash
npx vitest run tests/unit/services/contractual-document/
npx vitest run tests/integration/contractual-document.test.ts
```

## Key Behaviors

- Each POST creates a **new immutable version** with a unique reference number (format: `CARBO-YYYYMMDD-XXXX`)
- All sections are **always present** -- even empty ones show explicit messages
- The signature block is designed for print-and-sign workflow
- Table of contents appears when 3+ object mappings exist
- The consultant identifier comes from plan metadata (no auth required)
