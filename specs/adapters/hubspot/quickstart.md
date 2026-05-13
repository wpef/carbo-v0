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

Create a Private App in HubSpot: Settings > Integrations > Private Apps > Create. Grant scopes for standard objects: `crm.objects.contacts.read`, `crm.schemas.contacts.read`, `crm.objects.contacts.write`, `crm.schemas.contacts.write` (and equivalent for companies, deals, tickets). Optionally add `crm.objects.custom.read` and `crm.objects.custom.write` for Enterprise custom object support. Do NOT add `crm.schemas.custom.read` / `crm.schemas.custom.write` — those scopes don't exist in HubSpot (see note in Option B).

### Option B: OAuth2

```env
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_CALLBACK_URL=http://localhost:3001/api/connectors/hubspot/callback
```

> **Note:** The older "Create App" UI in the HubSpot Developer dashboard no longer allows creating Public (OAuth) apps. The CLI + Projects workflow is the only supported path as of 2026.

**Step-by-step setup:**

1. Create a HubSpot Developer Account (separate from your CRM portal) at https://developers.hubspot.com/get-started → "Create App Developer Account".
2. Install the HubSpot CLI: `npm install -g @hubspot/cli`
3. Authenticate the CLI: `hs account auth` → choose **Personal Access Key** → browser opens → generate key → paste back → set the dev account as default.
4. Scaffold a Public App project in a sibling folder (outside Carbo-v0):
   ```bash
   hs project create \
     --name carbo-v0-oauth \
     --dest ../carbo-hs-oauth-app \
     --platform-version 2026.03 \
     --project-base app \
     --distribution marketplace \
     --auth oauth
   ```
   When prompted for features, press Enter (no features needed).
5. Edit `src/app/app-hsmeta.json` inside the generated project to set the redirect URL and scopes:
   ```json
   {
     "uid": "carbo_v0_oauth_app",
     "type": "app",
     "config": {
       "name": "Carbo-v0 OAuth",
       "description": "OAuth app for Carbo-v0 local development",
       "distribution": "marketplace",
       "auth": {
         "type": "oauth",
         "redirectUrls": ["http://localhost:3001/api/connectors/hubspot/callback"],
         "requiredScopes": [
           "oauth",
           "crm.objects.contacts.read", "crm.objects.contacts.write",
           "crm.schemas.contacts.read", "crm.schemas.contacts.write",
           "crm.objects.companies.read", "crm.objects.companies.write",
           "crm.schemas.companies.read", "crm.schemas.companies.write",
           "crm.objects.deals.read", "crm.objects.deals.write",
           "crm.schemas.deals.read", "crm.schemas.deals.write",
           "tickets"
         ],
         "optionalScopes": [
           "crm.objects.custom.read", "crm.objects.custom.write"
         ],
         "conditionallyRequiredScopes": []
       },
       "permittedUrls": {
         "fetch": ["https://api.hubapi.com"],
         "iframe": [],
         "img": []
       }
     }
   }
   ```
   **Important:** `crm.schemas.custom.read` and `crm.schemas.custom.write` do NOT exist as HubSpot scopes — adding them causes `hs project upload` to fail with `"The scope crm.schemas.custom.write could not be recognized."` (observed 2026-04-23). The standard-object schema scopes (`crm.schemas.contacts.*`, `crm.schemas.companies.*`, `crm.schemas.deals.*`) ARE valid and required. For custom objects, use `crm.objects.custom.*` (Enterprise portal only) — custom-object schema modifications go through the standard Properties API once the object is granted.
6. Deploy: from inside the project folder, run `hs project upload` (answer `Y` to create the project on first run).
7. Retrieve credentials: `hs project open` → **Project Components** → click the app name → **Auth** tab → copy **Client ID** and **Client Secret**.
8. Paste into `.env.local` as shown in the env block above.

## Run the app

```bash
npm run dev
```

## Test Private App connection

```bash
# Validate token via API route
curl -X POST http://localhost:3001/api/connectors/hubspot/auth \
  -H "Content-Type: application/json" \
  -d '{"method":"private-app","accessToken":"pat-na1-..."}'
```

Expected: `200 OK` with portal name and CONNECTED status.

## Test OAuth2 flow

1. Navigate to: `http://localhost:3001/api/connectors/hubspot/auth?planId=<your-plan-id>`
2. Authorize in HubSpot
3. Callback completes, redirect to plan page

## Test schema write

After connecting, create a test property:

```bash
curl -X POST http://localhost:3001/api/connectors/hubspot/schema/properties \
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
