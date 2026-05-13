# Quickstart: Salesforce Adapter

## Prerequisites

- Node.js 18+
- A Salesforce org with API access enabled
- A Connected App configured per the spec (see "Connected App Setup Prerequisites" in spec.md)

## Install dependencies

```bash
npm install jsforce@3
```

## Environment variables

Create or update `.env.local`:

```env
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_CALLBACK_URL=http://localhost:3001/api/connectors/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```

- `SALESFORCE_LOGIN_URL`: use `https://test.salesforce.com` for sandbox orgs
- `SALESFORCE_CALLBACK_URL`: must exactly match the Connected App's callback URL

## Run the app

```bash
npm run dev
```

## Test the OAuth flow

1. Navigate to the auth initiation endpoint: `http://localhost:3001/api/connectors/salesforce/auth?planId=<your-plan-id>`
2. Browser redirects to Salesforce authorization page
3. Authorize the Connected App
4. Callback completes, tokens are stored, connection status is CONNECTED

**Common errors**:
- `invalid_client_id`: Connected App not yet propagated (wait 10-15 minutes after creation)
- `invalid_grant`: IP Relaxation not set, or PKCE verifier lost (check dev console for hot-reload issues)

## Test schema retrieval

After connecting, use the adapter's getSchema method via the plan's source connection. The API will return all objects with system objects filtered out.

## Test with a Developer Edition org — pre-seeded sample data <!-- Added: 2026-05-12 -->

**Gotcha for live testing**: any Salesforce org of the form `orgfarm-...develop.my.salesforce.com` (free Developer Edition obtained via the SF developer signup) is **pre-seeded with sample data** by SF:

- ~20-25 Leads (recurring sample names: Edna Frank, Phyllis Cotton, Carolyn Crenshaw, Andy Young, etc.)
- ~10 sample Accounts (Burlington Textiles, Dickenson plc, Edge Communications, Express Logistics, etc.)
- Associated Contacts and Opportunities
- Sample Tasks and Events

This is **not Carbo data** — SF inserts it the first time you provision the org. Two consequences:

1. **A fresh `record-preview` on Lead/Account/Contact will return many records, not zero**, even on an "empty" org where you only created one Lead manually. The count is correct (`SELECT COUNT() FROM Lead` will match), but the records are mostly seed data. Don't interpret this as a bug.
2. **The integrity check (017) will count the seed records as valid source data** for any mapping you create. If you intend to test broken-mapping behaviour, prefer creating/deleting a **custom field** (the seed records won't have it anyway) rather than expecting "empty" Lead.

To get a truly empty org for testing, either:
- Mass-delete the sample records in the SF UI (Leads tab → All Leads → bulk select → Delete)
- Or use a SF Sandbox org (no auto-seeded data)
- Or run a SOQL `DELETE` via Workbench / Developer Console

This is a one-time annoyance — once you've cleaned (or accepted) the seed data, normal testing works as expected.

## Run tests

```bash
# Unit tests (mock jsforce, no real API calls)
npx vitest run tests/unit/connectors/salesforce/

# All Salesforce adapter tests
npx vitest run tests/unit/connectors/salesforce/ --reporter=verbose
```

Tests use fixture files in `tests/fixtures/salesforce/` that mirror real Salesforce API responses.

## Fixture data

The test fixtures include:
- `describe-global.json`: ~50 objects mixing standard, custom, and system objects
- `describe-contact.json`: Contact object with ~30 fields of various types (text, phone, email, lookup, picklist)
- `records-contact.json`: 25 Contact records with realistic data including nulls and varied values
