# Quickstart: Destination Connection

## Prerequisites

- Node.js 18+
- Feature 001 (Migration Plan) implemented and working
- Feature 000 (Connector Interface) types available at `src/lib/connectors/types.ts`

## Environment Variables

```bash
# .env.local
HUBSPOT_ACCESS_TOKEN=pat-xxx-xxxxxxxx-xxxx   # HubSpot private app token (optional for demo mode)
```

## Setup

```bash
npm install @hubspot/api-client
npx prisma db push   # Apply schema if ConnectorConnection not yet created
```

## Dev Workflow

```bash
# Start dev server
npm run dev

# Run unit tests
npx vitest run tests/unit/services/destination-connection.test.ts

# Run integration tests
npx vitest run tests/integration/destination-connection.test.ts
```

## Manual Testing

1. Create a plan at `/plans`
2. Open the plan, navigate to the destination step
3. Select "Demo Data" adapter (or "HubSpot" if token configured)
4. Click "Connect" — status should change to CONNECTED
5. Verify the plan's destination step shows a green checkmark
6. Click "Disconnect" — status reverts, dependent data is cleaned

## Integration Scenario

```typescript
// Connect destination within a plan
const res = await fetch(`/api/plans/${planId}/destination-connection`, {
  method: "POST",
  body: JSON.stringify({ adapterType: "demo-destination" }),
});
const { connection } = await res.json();
// connection.status === "CONNECTED"

// Check status
const status = await fetch(`/api/plans/${planId}/destination-connection`);
// { connection: { id, status: "CONNECTED", adapterType: "demo-destination" } }

// Disconnect
await fetch(`/api/plans/${planId}/destination-connection`, { method: "DELETE" });
```
