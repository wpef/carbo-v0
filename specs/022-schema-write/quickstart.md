# Quickstart: Schema Write

## Prerequisites

- Node.js 18+
- Feature 008 (destination-field-retrieval) implemented
- Feature 012 (field-mapping) implemented (for UI integration)
- Connector adapter with `canWriteSchema: true` and `createField()`, `modifyField()`, `createObject()` methods
- Prisma schema includes `SchemaWriteOperation` model
- `ANTHROPIC_API_KEY` set in `.env.local` (optional -- only for LLM field descriptions)

## Setup

```bash
# After adding SchemaWriteOperation to prisma/schema.prisma
npx prisma db push
```

## Create a Field

```bash
POST /api/plans/{planId}/connections/{connectionId}/schema-write/fields
Content-Type: application/json

{
  "objectApiName": "contacts",
  "name": "annual_revenue",
  "type": "number",
  "description": "Annual revenue"
}
```

## Modify a Field

```bash
PATCH /api/plans/{planId}/connections/{connectionId}/schema-write/fields/annual_revenue
Content-Type: application/json

{
  "objectApiName": "contacts",
  "description": "Annual revenue in USD"
}
```

## Create an Object

```bash
POST /api/plans/{planId}/connections/{connectionId}/schema-write/objects
Content-Type: application/json

{
  "name": "Projects",
  "primaryPropertyName": "project_name",
  "primaryPropertyType": "text"
}
```

## Generate Field Description (LLM)

```bash
POST /api/plans/{planId}/connections/{connectionId}/schema-write/describe-field
Content-Type: application/json

{
  "objectApiName": "contacts",
  "fieldName": "annual_revenue",
  "fieldType": "number"
}
```

## Run Tests

```bash
npx vitest run tests/unit/services/schema-write/
npx vitest run tests/integration/schema-write.test.ts
```

## Key Behaviors

- Schema write is **only available for destination connections** with `canWriteSchema: true`
- Every operation (success or failure) is logged to `SchemaWriteOperation`
- After a successful write, the local schema snapshot is automatically refreshed
- Pre-validation catches name conflicts and type issues before making API calls
- LLM descriptions are optional and always editable before saving
