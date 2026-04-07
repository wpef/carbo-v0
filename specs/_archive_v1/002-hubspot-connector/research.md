# Research: HubSpot Destination Connector

**Feature**: 002-hubspot-connector
**Date**: 2026-03-19

## Decision 1: HubSpot API Strategy

**Decision**: HubSpot CRM API v3 via @hubspot/api-client (official Node.js SDK)

**Rationale**:
- CRM API v3 is the current standard for HubSpot integrations (v1/v2 are deprecated).
- Covers all needs: object listing, property retrieval, record search, property/object creation.
- @hubspot/api-client is the official SDK, actively maintained by HubSpot, with TypeScript support.
- Provides built-in rate limit handling and retry logic.

**Alternatives considered**:
- Raw REST calls: possible but would require reimplementing pagination, rate limits, and auth token management.
- hubspot-api-nodejs (community): less maintained than the official SDK.

## Decision 2: OAuth2 Flow

**Decision**: Private App token for v0 (simplest), with public app OAuth2 flow as future upgrade

**Rationale**:
- Private app tokens are the simplest HubSpot auth mechanism: a single access token, no OAuth2
  redirect flow, no token refresh needed.
- For local-first v0 with a single consultant, this is sufficient.
- Public app OAuth2 (Authorization Code flow) would be needed for multi-tenant SaaS deployment
  but adds complexity not needed in v0.
- The auth module will be structured to support both: private app token now, OAuth2 later.

**Alternatives considered**:
- Public app OAuth2: full redirect flow like Salesforce. Deferred — adds complexity for no v0 value.
- API key (legacy): deprecated by HubSpot, no longer recommended.

## Decision 3: Schema Write Operations

**Decision**: Use HubSpot CRM Properties API and Custom Objects API for schema modifications

**Rationale**:
- Properties API: `POST /crm/v3/properties/{objectType}` creates new properties.
- Custom Objects API: `POST /crm/v3/schemas` creates new custom objects.
- Both require validation before submission (name uniqueness, type compatibility).
- Custom objects require Enterprise tier — must detect and report gracefully.

**Alternatives considered**:
- No schema write: rejected — the whole point of a destination connector is to prepare the
  destination for incoming data, which often requires creating new fields.

## Decision 4: Record Reading (HubSpot-specific)

**Decision**: Use CRM Search API for paginated record retrieval

**Rationale**:
- HubSpot Search API (`POST /crm/v3/objects/{objectType}/search`) supports:
  - Pagination via `after` cursor (not offset-based)
  - Filtering and sorting
  - Selecting specific properties to return
  - Max 100 records per page (HubSpot limit)
- For record counts: Search API returns `total` in response.
- For field stats: compute client-side from fetched records (same approach as Salesforce connector).

**Alternatives considered**:
- List API (`GET /crm/v3/objects/{objectType}`): simpler but less flexible (no filtering, max 100 per page too). Search API is strictly better.

## Decision 5: Pattern Consistency with Salesforce Connector

**Decision**: Mirror the exact same architecture patterns from feature 001

**Rationale**:
- Same directory structure (lib/connectors/hubspot/ mirrors lib/connectors/salesforce/)
- Same entity naming conventions (DestinationSchema mirrors SourceSchema)
- Same API route patterns (/api/connectors/hubspot/ mirrors /api/connectors/salesforce/)
- Same UI component patterns (connection-form, object-list, property-list, record-preview)
- This consistency is critical for the bottom-up Connector SDK extraction later.

**Alternatives considered**:
- Different architecture: rejected — inconsistency would make SDK extraction much harder.

## Decision 6: Rate Limit Handling

**Decision**: Use @hubspot/api-client built-in retry + monitor X-HubSpot-RateLimit headers

**Rationale**:
- HubSpot rate limits: 100 requests per 10 seconds (private apps), 150/10s (OAuth2 apps).
- The official SDK handles 429 responses with automatic retry.
- Additionally log rate limit headers for observability (Principle VII).
- For schema write operations: add explicit pre-flight validation to minimize wasted API calls.

**Alternatives considered**:
- Manual rate limit handling: unnecessary since the official SDK handles it.
