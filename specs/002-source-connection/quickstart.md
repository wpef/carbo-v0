# Quickstart: Source Connection

## Prerequisites

- Node.js 18+
- Feature 000 (Connector Interface) types defined in `src/lib/types/connector.ts`
- Feature 001 (Migration Plan) implemented: `MigrationPlan` model + CRUD routes + plan detail page

## Environment Variables

```env
# No feature-specific env vars. Adapter-specific vars (e.g., SF_CLIENT_ID) belong to adapters.
DATABASE_URL="file:./dev.db"
```

## Setup

```bash
# 1. Run Prisma migration after adding SourceConnection model
npx prisma migrate dev --name add-source-connection

# 2. Verify the schema
npx prisma studio
```

## Development

```bash
npm run dev
```

## Verification

1. Open `http://localhost:3000`
2. Create a migration plan (001)
3. Click the plan -> Source Connection step
4. Select "Demo" adapter -> Click "Connect"
5. Verify status shows CONNECTED
6. Click "Disconnect" -> Verify status reverts to pending

## Test

```bash
npx vitest run tests/unit/services/source-connection.test.ts
npx vitest run tests/integration/api/source-connection.test.ts
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | SourceConnection model |
| `src/app/plans/[planId]/source/page.tsx` | Source connection step UI |
| `src/app/api/plans/[planId]/source/route.ts` | API route handlers |
| `src/lib/services/source-connection.ts` | Domain service |
| `src/lib/connectors/registry.ts` | Adapter registry |
| `src/components/source/AdapterPicker.tsx` | Adapter selector component |
