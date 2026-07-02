# Quickstart: Salesforce Adapter

**Feature**: adapters/salesforce
**Date**: 2026-05-18

## Prerequisites

### 1. Salesforce Connected App

The consultant (or Salesforce admin) must create a Connected App before using this adapter. Full details in `spec.md` section "Connected App Setup Prerequisites".

Quick checklist:
1. Setup > App Manager > New Connected App
2. Enable OAuth Settings
3. Callback URL: `http://localhost:3001/api/connectors/salesforce/callback` (must match `SALESFORCE_CALLBACK_URL` exactly)
4. OAuth Scopes: "Full access (full)" + "Perform requests at any time (refresh_token, offline_access)"
5. Require PKCE: enabled (mandatory)
6. IP Relaxation: "Relax IP restrictions" (Manage > Edit Policies)
7. Permitted Users: "All users may self-authorize"
8. **Wait 10-15 minutes** for Salesforce propagation before testing

### 2. Environment Variables

In `.env.local`:
```env
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_CALLBACK_URL=http://localhost:3001/api/connectors/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```

Use `https://test.salesforce.com` for `SALESFORCE_LOGIN_URL` when connecting to a sandbox org.

---

## Integration Scenario 1: First Connection (FR-001 to FR-005)

**Actor**: Consultant connecting Salesforce as a source for the first time within a migration plan.

1. Consultant opens a plan and clicks "Configure Source"
2. Selects "Salesforce" from the adapter list
3. Clicks "Connect to Salesforce"
4. App calls `POST /api/connectors/salesforce/connect` which generates PKCE challenge and returns authorization URL
5. Consultant is redirected to Salesforce login page
6. Consultant logs in and grants access to the Connected App
7. Salesforce redirects to callback URL with authorization code
8. App exchanges code for tokens (direct HTTP POST with code_verifier)
9. Connection record created with status CONNECTED and org name
10. Consultant is redirected back to the source page (`?connected=salesforce`)
11. Source page auto-triggers schema + fields retrieval (feature 002 FR-017)
12. Consultant sees the full object list

**Result**: Source connected, schema available, ready for object selection.

---

## Integration Scenario 2: Object Selection (FR-006 to FR-008)

**Actor**: Consultant selecting relevant objects from the 1200+ available.

1. Object selection page loads with the full list from `describeGlobal`
2. System objects (~130 patterns) are hidden by default ("Hide system objects" toggle on)
3. Custom objects (`__c` suffix) and common CRM objects (Account, Contact, Lead, Opportunity, Case, Campaign, Task, Event, Note, Attachment, ContentDocument) are pre-selected
4. Consultant searches for "Invoice" -- finds `Invoice__c` already selected
5. Consultant expands "Contact" -- system fetches record count (45,230) and sample fields on-demand
6. Consultant confirms selection
7. Field retrieval is triggered for selected objects only (feature 005)

**Result**: 42 objects selected from 1,247 total. Ready for field browsing and mapping.

---

## Integration Scenario 3: Record Preview with Stats (FR-010, FR-011)

**Actor**: Consultant assessing data quality before creating a mapping plan.

1. Consultant selects "Contact" in the object browser
2. Opens record preview
3. First page loads: 50 records displayed with all field values
4. Null values shown explicitly as `null`, empty strings shown as empty
5. Consultant views field stats: Email has 34 nulls out of 200 sampled (17% null rate), 198 distinct values
6. Consultant navigates to page 2 -- next 50 records load
7. Identifies that many contacts lack a phone number -- will need a filter or default value in the mapping plan

**Result**: Consultant has a clear picture of data quality issues to address during mapping.

---

## Integration Scenario 4: Token Refresh (FR-013)

**Actor**: Consultant returning to an existing connection after the access token expired (~1 hour).

1. Consultant opens the plan with an existing Salesforce source connection
2. Consultant clicks to view Contact fields
3. The adapter detects a 401 response from Salesforce
4. The adapter automatically refreshes the token using the stored refresh token
5. The original request is retried with the new token
6. Fields are displayed normally -- no re-authentication prompt

**Fallback**: If the refresh token is also invalid (admin revoked, password changed), the connection transitions to EXPIRED and the consultant sees a "Please reconnect" message.

**Result**: Transparent session continuity. No manual re-authentication needed.

---

## Integration Scenario 5: Rate Limit Handling (FR-012)

**Actor**: Consultant working with a Developer Edition org (lower API limits).

1. Consultant is browsing multiple objects, triggering describe and SOQL calls
2. The adapter reads `Sforce-Limit-Info: api-usage=12500/15000` (83% consumed)
3. The adapter logs a rate limit warning to the audit trail
4. Subsequent requests are delayed with exponential backoff (1s, 2s, 4s...)
5. The consultant sees a notification: "Salesforce API usage at 83%. Requests are being throttled to prevent hitting the limit."
6. When usage drops below 80% on next check, normal speed resumes

**Result**: No 429 errors reach the consultant. Rate limits are handled transparently.

---

## Dependencies

- **Depends on**: 000-connector-interface (types), 002-source-connection (connection lifecycle), adapter registry
- **Used by**: 003-source-schema-retrieval, 004-source-object-selection, 005-source-field-retrieval, 009-record-preview, 010-field-stats

## Downstream Flow

```
[Salesforce Adapter]
    |
    +--> 002 Source Connection (stores connection, triggers auto-retrieval)
    |       |
    |       +--> 003 Schema Retrieval (describeGlobal snapshot)
    |       |       |
    |       |       +--> 004 Object Selection (filter, pre-select, confirm)
    |       |               |
    |       |               +--> 005 Field Retrieval (describe per selected object)
    |       |                       |
    |       |                       +--> 009 Record Preview (SOQL query)
    |       |                       |       |
    |       |                       |       +--> 010 Field Stats (computed from preview)
    |       |                       |
    |       |                       +--> 011 Object Mapping (source side)
    |       |
    |       +--> 017 Mapping Integrity Check (on schema refresh)
```
