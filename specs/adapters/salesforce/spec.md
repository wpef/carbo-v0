# Feature Specification: Salesforce Adapter

**Feature**: adapters/salesforce
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 000-connector-interface, 001-connection, 002-schema-retrieval, 003-object-selection, 004-field-retrieval, 005-record-preview, 006-field-stats

## User Story (atomic)

As a consultant, I can connect to Salesforce and use it as a source system in Carbo-v0, so that I can authenticate via OAuth2, retrieve the full object and field schema, select relevant objects, preview records with field-level statistics, and use Salesforce data as the source for my mapping plans.

**Independent Test**: A consultant configures the Salesforce Connected App credentials, initiates a connection via OAuth2 with PKCE, sees the org name confirmed, browses the object selection step with custom objects and common CRM objects pre-selected (system objects hidden by default), confirms the selection, views fields for "Contact" with types and constraints, previews 25 records with field stats (null count, distinct values, sample values), and disconnects cleanly.

**Acceptance Scenarios**:

1. **Given** valid Salesforce Connected App credentials (client ID, client secret, callback URL), **When** the consultant initiates a connection, **Then** the system redirects to the Salesforce OAuth2 authorization page with a PKCE code challenge (S256 method).
2. **Given** the consultant authorizes the Connected App in Salesforce, **When** the callback is received, **Then** the system exchanges the authorization code for tokens using a direct HTTP POST to `/services/oauth2/token` with the code_verifier parameter, and the connection status is set to CONNECTED with the org name displayed.
3. **Given** a CONNECTED Salesforce connection, **When** the system retrieves the object list, **Then** it calls describeGlobal via jsforce and returns all objects (standard and custom) with label, API name, description, and isCustom flag.
4. **Given** the full object list (~1200+ objects), **When** the object selection step is displayed, **Then** system objects (~130 known patterns) are filtered out by default, custom objects (__c suffix) and common CRM objects (Account, Contact, Lead, Opportunity, Case, Campaign, Task, Event, Note, Attachment, ContentDocument) are pre-selected, and the consultant can search/filter by label or API name.
5. **Given** the object selection list, **When** the consultant expands an object, **Then** the system fetches the record count (via `SELECT COUNT() FROM ObjectName`) and sample fields on-demand only — no API call is made until the expand is triggered.
6. **Given** confirmed object selection, **When** the system retrieves fields for a selected object, **Then** it calls describe (per object) via jsforce and returns all fields with: label, API name, data type (text, number, date, picklist, lookup, etc.), isRequired, isReadOnly, isUnique, and relationship info (referenceTo, relationshipType) for lookup/master-detail fields.
7. **Given** a selected object with records, **When** the consultant requests a record preview, **Then** the system executes a SOQL query (e.g., `SELECT field1, field2, ... FROM Contact LIMIT 25 OFFSET 0`) and returns paginated results.
8. **Given** a record preview, **When** the consultant views field stats, **Then** the system calculates and displays per-field statistics: null count, distinct value count, and up to 5 sample values.
9. **Given** a Salesforce API response with `Sforce-Limit-Info` header, **When** the system detects approaching rate limits (>80% consumed), **Then** it applies exponential backoff before subsequent requests and logs the rate limit status.
10. **Given** a connection whose access token has expired but a refresh token is available, **When** the system detects the expiration (401 response), **Then** it transparently refreshes the token and retries the request without prompting the consultant.
11. **Given** a consultant using the adapter, **When** any significant operation occurs (connect, disconnect, schema retrieval, record read, error, rate limit), **Then** the operation is logged to the audit trail.

## Connected App Setup Prerequisites

The consultant must configure a Connected App in Salesforce before using this adapter:

1. **Create the Connected App**: Setup > App Manager > New Connected App
2. **Enable OAuth Settings**: check "Enable OAuth Settings"
3. **Callback URL**: must exactly match the `SALESFORCE_CALLBACK_URL` env var (e.g., `http://localhost:3001/api/connectors/salesforce/callback`)
4. **OAuth Scopes**: select "Full access (full)" and "Perform requests at any time (refresh_token, offline_access)"
5. **Require Proof Key for Code Exchange (PKCE)**: this is now mandatory for all Connected Apps
6. **IP Relaxation**: in Manage > Edit Policies, set to "Relax IP restrictions" (required for localhost development)
7. **Permitted Users**: set to "All users may self-authorize"
8. **Propagation delay**: after creating or modifying the Connected App, wait 10-15 minutes for Salesforce to propagate changes across its infrastructure

**Environment variables required**:
- `SALESFORCE_CLIENT_ID` — Consumer Key from the Connected App
- `SALESFORCE_CLIENT_SECRET` — Consumer Secret from the Connected App
- `SALESFORCE_CALLBACK_URL` — must match the Connected App callback URL exactly
- `SALESFORCE_LOGIN_URL` (optional) — defaults to `https://login.salesforce.com`, use `https://test.salesforce.com` for sandbox orgs

## Implementation Gotchas

These are hard-won lessons from research and testing. Each gotcha has caused real authentication or runtime failures:

- **PKCE store must survive hot-reloads**: Next.js in development mode performs hot-module replacement that re-executes module-level code. A PKCE code verifier stored in a module-level variable is lost on hot-reload, causing the token exchange to fail with "invalid_grant". The code verifier MUST be stored on `globalThis` (e.g., `globalThis.__pkceStore`) which persists across hot-reloads.
- **Login URL must match**: The `SALESFORCE_LOGIN_URL` used to initiate OAuth MUST match the Salesforce instance type. Use `https://login.salesforce.com` for production orgs, `https://test.salesforce.com` for sandbox orgs. A mismatch causes a silent redirect failure or "invalid_client_id" error.
- **OAuth scopes**: Use `"full refresh_token"` as the scope string. Using `"api"` alone does not grant schema access via describeGlobal. Using `"id"` alone does not grant data access. The scope `"full"` grants all API permissions; `"refresh_token"` enables offline token refresh.
- **IP Relaxation must be set**: The Connected App's IP Relaxation policy MUST be set to "Relax IP restrictions". The default policy ("Enforce IP restrictions") blocks OAuth from localhost and any IP not in the org's trusted IP ranges, causing an "invalid_grant" error with no helpful message.
- **Connected App propagation delay**: After creating or modifying a Connected App, Salesforce requires 10-15 minutes to propagate changes. Attempting OAuth before propagation completes results in "invalid_client_id" or "invalid_grant" errors that are indistinguishable from real configuration errors.
- **jsforce authorize() does not support code_verifier**: The jsforce library's `OAuth2.authorize()` method does not accept a `code_verifier` parameter. The token exchange MUST be done via a direct HTTP POST to `{loginUrl}/services/oauth2/token` with `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`, and `code_verifier`. After obtaining tokens, create a jsforce Connection instance using the `accessToken` and `instanceUrl` from the response.

## Edge Cases

- Salesforce credentials are invalid or the account is locked: the system displays a clear error identifying the cause (wrong credentials, locked account, IP restriction) without exposing sensitive details.
- The Salesforce org has no custom objects: the system displays only standard objects without error.
- A field type is uncommon or proprietary (e.g., encrypted text, external lookup, geolocation): the system displays the type as reported by Salesforce and flags it for manual review during mapping.
- The network connection drops during schema retrieval: the system reports the failure and allows retry without losing the authentication context.
- The Salesforce org contains 1200+ objects: the object selection list loads without performance degradation. System objects are hidden by default. Search/filter enables navigation.
- The consultant selects zero objects: the system prevents proceeding and asks to select at least one object.
- The consultant expands an object with millions of records: the record count query uses `SELECT COUNT() FROM ObjectName` which is optimized by Salesforce.
- A record contains null or empty values for most fields: these are displayed as explicitly empty, not hidden or omitted.
- API rate limits are reached: the system reports the rate limit, applies exponential backoff, and informs the consultant of the wait time.
- A field is restricted by field-level security: the field appears in the field list marked "no access"; its values are not shown in record preview but the field is not hidden.
- The PKCE code verifier is lost (hot-reload in development): the system detects the missing verifier and restarts the OAuth flow with a new code challenge rather than showing a cryptic error.
- The Connected App was just created and has not propagated: the "invalid_client_id" error is caught and the system suggests waiting 10-15 minutes.

## Functional Requirements

- **FR-001**: The adapter MUST implement the Connector Interface (feature 000) with capabilities: canRead=true, canWrite=false, canWriteSchema=false.
- **FR-002**: The adapter MUST authenticate via OAuth2 with PKCE (S256 method). The authorization URL MUST include `code_challenge` and `code_challenge_method=S256` parameters.
- **FR-003**: The adapter MUST exchange the authorization code for tokens via a direct HTTP POST to `/services/oauth2/token` with the `code_verifier` parameter. The jsforce `OAuth2.authorize()` method MUST NOT be used for token exchange.
- **FR-004**: The adapter MUST store the PKCE code verifier on `globalThis` to survive Next.js hot-reloads in development mode.
- **FR-005**: The adapter MUST use jsforce v3 to interact with the Salesforce REST API after authentication (schema retrieval, record queries). The jsforce Connection MUST be initialized with the `accessToken` and `instanceUrl` obtained from the manual token exchange.
- **FR-006**: The adapter MUST retrieve the full object list via `describeGlobal()` and map results to `ConnectorObject` (apiName, label, description, isCustom).
- **FR-007**: The adapter MUST filter system objects using a list of ~130 known patterns (e.g., objects ending in `__Share`, `__History`, `__Feed`, `__Tag`, `__ChangeEvent`; objects starting with `AI`, `Auth`, `Flow`, `Setup`; specific system objects like `ApexClass`, `ApexTrigger`, `AsyncApexJob`). The filter list MUST be maintainable and documented.
- **FR-008**: The adapter MUST pre-select custom objects (API name ending in `__c`) and common CRM objects (Account, Contact, Lead, Opportunity, Case, Campaign, Task, Event, Note, Attachment, ContentDocument) by default.
- **FR-009**: The adapter MUST retrieve fields for a selected object via `describe()` and map results to `ConnectorField` (apiName, label, dataType, isRequired, isReadOnly, isUnique, relationship info).
- **FR-010**: The adapter MUST retrieve records via SOQL queries and return paginated results as `PaginatedRecords`.
- **FR-011**: The adapter MUST calculate per-field statistics (null count, distinct count, sample values) from the retrieved records and return them as `FieldStats`.
- **FR-012**: The adapter MUST handle rate limits by reading the `Sforce-Limit-Info` response header and applying exponential backoff when approaching the limit (>80% consumed).
- **FR-013**: The adapter MUST handle token expiration by refreshing the access token using the refresh token. If refresh fails, the connection status MUST transition to EXPIRED.
- **FR-014**: The adapter MUST use the OAuth scopes `"full refresh_token"`.
- **FR-015**: The adapter MUST log every significant operation to the audit trail (Constitution Principle VI).

## Key Entities

This adapter does not introduce new entities beyond those defined in the Connector Interface (feature 000). It implements:
- `ConnectorConnection` as a Salesforce org connection (OAuth2 + PKCE)
- `ConnectorSchema` as a describeGlobal snapshot
- `ConnectorObject` as a Salesforce standard or custom object
- `ConnectorField` as a Salesforce field with full metadata

## Success Criteria

- A consultant can connect to a Salesforce sandbox via OAuth2 with PKCE and browse its full schema in under 2 minutes.
- 100% of selected objects and their fields are retrieved — no silent omissions.
- System objects (~130 patterns) are correctly filtered and hidden by default.
- Custom objects and common CRM objects are correctly pre-selected.
- Record preview loads the first page in under 5 seconds for objects with up to 100,000 records.
- Token refresh is transparent — no manual re-authentication when a valid refresh token exists.
- Rate limit handling prevents 429 errors from reaching the consultant.
- All operations are traceable in the audit trail.

## Assumptions

- The consultant has a Salesforce account with API access enabled (API Enabled permission).
- The consultant has configured a Connected App following the prerequisites checklist above.
- This adapter is read-only — it does not create, modify, or delete data or schema in Salesforce (canWrite=false, canWriteSchema=false).
- jsforce v3 is the SDK for Salesforce API interactions, except for the OAuth2 token exchange which uses a direct HTTP POST.
- A single adapter instance targets one Salesforce org at a time.
- The system object filter list (~130 patterns) is maintained as a configuration constant within the adapter, not in the database.
