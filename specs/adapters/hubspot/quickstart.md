# Quickstart: HubSpot Adapter

## Prerequisites

- Node.js 18+
- A HubSpot account (free tier works for standard objects; Enterprise for custom objects)
- Either a Private App token or OAuth2 app credentials

## Install dependencies

```bash
npm install @hubspot/api-client
```

## Environment variables

Create or update `.env.local`:

### Option A: Private App (simpler, recommended for testing)

```env
HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Create a Private App in HubSpot: Settings > Integrations > Private Apps > Create. Grant scopes: `crm.objects.contacts.read`, `crm.schemas.contacts.read`, `crm.objects.contacts.write`, `crm.schemas.contacts.write` (and equivalent for companies, deals, tickets).

### Option B: OAuth2

```env
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_CALLBACK_URL=http://localhost:3000/api/connectors/hubspot/callback
```

Create an app in HubSpot Developer Portal. Add redirect URI matching `HUBSPOT_CALLBACK_URL`. Select required scopes.

## Run the app

```bash
npm run dev
```

## Test Private App connection

```bash
# Validate token via API route
curl -X POST http://localhost:3000/api/connectors/hubspot/auth \
  -H "Content-Type: application/json" \
  -d '{"method":"private-app","accessToken":"pat-na1-..."}'
```

Expected: `200 OK` with portal name and CONNECTED status.

## Test OAuth2 flow

1. Navigate to: `http://localhost:3000/api/connectors/hubspot/auth?planId=<your-plan-id>`
2. Authorize in HubSpot
3. Callback completes, redirect to plan page

## Test schema write

After connecting, create a test property:

```bash
curl -X POST http://localhost:3000/api/connectors/hubspot/schema/properties \
  -H "Content-Type: application/json" \
  -d '{"objectType":"contacts","name":"migration_test","label":"Migration Test","type":"string"}'
```

Verify it appears in HubSpot: Settings > Properties > Contact Properties.

## Run tests

```bash
# Unit tests (mocked @hubspot/api-client)
npx vitest run tests/unit/connectors/hubspot/

# All tests verbose
npx vitest run tests/unit/connectors/hubspot/ --reporter=verbose
```

Tests use fixture files in `tests/fixtures/hubspot/`.

## Common issues

- **401 on Private App**: Token was rotated or revoked in HubSpot. Generate a new one.
- **403 on custom objects**: Portal is not Enterprise tier. Custom objects are skipped gracefully.
- **429 rate limit**: Adapter handles automatically with exponential backoff. Check console logs for retry timing.
