# Quickstart: Migration Plan

## Prerequisites

- Node.js 18+
- npm (installed with Node.js)

## Setup

### 1. Install dependencies

```bash
npm install prisma @prisma/client
npm install -D vitest
```

### 2. Initialize Prisma

```bash
npx prisma generate
npx prisma db push
```

This creates the SQLite database at `prisma/dev.db` with the MigrationPlan and AuditLog tables.

### 3. Install shadcn/ui components

```bash
npx shadcn-ui@latest add card dialog button input badge
```

## Environment Variables

No feature-specific env vars needed. Prisma defaults to `file:./dev.db` for SQLite.

Optional in `.env.local`:
```
DATABASE_URL="file:./dev.db"
```

## Run the app

```bash
npm run dev
```

Open `http://localhost:3000` — the home page shows the plan list.

## Test the feature

### Manual test

1. Click "New Plan" on the home page
2. Enter name: "Acme Corp Migration", description: "CRM migration Q2 2026"
3. Submit — redirected to plan detail page with step workflow (all steps pending)
4. Go back to home — plan appears in the list with DRAFT status
5. Delete the plan — it disappears from the list

### Automated tests

```bash
# Unit tests
npx vitest run tests/unit/services/plan-service.test.ts

# Integration tests (API routes)
npx vitest run tests/integration/api/plans.test.ts
```

## Seed data (optional)

Create a seed script to pre-populate plans for development:

```bash
npx prisma db seed
```

Seed file at `prisma/seed.ts` creates 3 sample plans with different statuses.
