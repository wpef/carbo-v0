// Tests unitaires — HubSpot auth (port v4 → v5).
// Aucun appel réseau réel : fetch est mocké via vi.stubGlobal.
// Changement v4 → v5 : validatePrivateAppToken → validateToken.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildOAuthUrl,
  computeOAuthExpiresAt,
  exchangeOAuthCode,
  HubSpotAuthError,
  loadHubSpotOAuthConfig,
  MissingHubSpotEnvError,
  refreshOAuthToken,
  validateToken,
} from "@/features/connectors/hubspot/auth";
import { HS_AUTHORIZE_URL, HS_TOKEN_URL } from "@/features/connectors/hubspot/constants";

// ---------------------------------------------------------------------------
// loadHubSpotOAuthConfig
// ---------------------------------------------------------------------------

describe("loadHubSpotOAuthConfig", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    // restore env
    Object.assign(process.env, ORIGINAL_ENV);
    delete process.env.HUBSPOT_CLIENT_ID;
    delete process.env.HUBSPOT_CLIENT_SECRET;
    delete process.env.HUBSPOT_CALLBACK_URL;
  });

  it("returns config when all env vars are set", () => {
    process.env.HUBSPOT_CLIENT_ID = "cid";
    process.env.HUBSPOT_CLIENT_SECRET = "csec";
    process.env.HUBSPOT_CALLBACK_URL = "https://example.com/callback";

    const cfg = loadHubSpotOAuthConfig();
    expect(cfg).toEqual({
      clientId: "cid",
      clientSecret: "csec",
      callbackUrl: "https://example.com/callback",
    });
  });

  it("throws MissingHubSpotEnvError when env vars are absent", () => {
    delete process.env.HUBSPOT_CLIENT_ID;
    delete process.env.HUBSPOT_CLIENT_SECRET;
    delete process.env.HUBSPOT_CALLBACK_URL;

    expect(() => loadHubSpotOAuthConfig()).toThrow(MissingHubSpotEnvError);
  });

  it("lists all missing var names in the error", () => {
    process.env.HUBSPOT_CLIENT_ID = "cid";
    delete process.env.HUBSPOT_CLIENT_SECRET;
    delete process.env.HUBSPOT_CALLBACK_URL;

    try {
      loadHubSpotOAuthConfig();
    } catch (e) {
      expect(e).toBeInstanceOf(MissingHubSpotEnvError);
      const msg = (e as MissingHubSpotEnvError).message;
      expect(msg).toContain("HUBSPOT_CLIENT_SECRET");
      expect(msg).toContain("HUBSPOT_CALLBACK_URL");
    }
  });
});

// ---------------------------------------------------------------------------
// buildOAuthUrl
// ---------------------------------------------------------------------------

describe("buildOAuthUrl", () => {
  const config = {
    clientId: "cid",
    clientSecret: "csec",
    callbackUrl: "https://example.com/callback",
  };

  it("builds a URL that starts with the HubSpot authorize endpoint", () => {
    const url = buildOAuthUrl(config, "state123");
    expect(url).toContain(HS_AUTHORIZE_URL);
  });

  it("includes client_id, redirect_uri, and state in the URL", () => {
    const url = buildOAuthUrl(config, "plan-1:nonce");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("client_id")).toBe("cid");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/callback");
    expect(parsed.searchParams.get("state")).toBe("plan-1:nonce");
  });

  it("includes scope param", () => {
    const url = buildOAuthUrl(config, "state");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBeTruthy();
    expect(parsed.searchParams.get("scope")).toContain("crm.objects.contacts.read");
  });
});

// ---------------------------------------------------------------------------
// computeOAuthExpiresAt
// ---------------------------------------------------------------------------

describe("computeOAuthExpiresAt", () => {
  it("subtracts a 2-minute safety buffer from the expiry", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const result = computeOAuthExpiresAt(1800, now); // 30 minutes
    const expected = new Date("2026-01-01T00:28:00Z").toISOString(); // 30min - 2min
    expect(result).toBe(expected);
  });

  it("returns an ISO string", () => {
    const result = computeOAuthExpiresAt(3600);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// validateToken (ex-validatePrivateAppToken)
// ---------------------------------------------------------------------------

describe("validateToken", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns portal info on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ portalId: 12345, accountType: "DEVELOPER" }),
    });

    const info = await validateToken("valid-token");
    expect(info.portalId).toBe(12345);
    expect(info.accountType).toBe("DEVELOPER");
  });

  it("sends the token as a Bearer Authorization header", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ portalId: 1 }),
    });

    await validateToken("my-token");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init?.headers as Record<string, string>)?.Authorization).toBe("Bearer my-token");
  });

  it("throws HubSpotAuthError on 401", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    });

    await expect(validateToken("bad-token")).rejects.toThrow(HubSpotAuthError);
  });

  it("throws HubSpotAuthError when portalId is absent from response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accountType: "STANDARD" }), // no portalId
    });

    await expect(validateToken("token")).rejects.toThrow(HubSpotAuthError);
  });
});

// ---------------------------------------------------------------------------
// exchangeOAuthCode
// ---------------------------------------------------------------------------

describe("exchangeOAuthCode", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const config = {
    clientId: "cid",
    clientSecret: "csec",
    callbackUrl: "https://example.com/callback",
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the token URL with authorization_code grant", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 1800,
        token_type: "bearer",
      }),
    });

    await exchangeOAuthCode(config, "auth-code");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HS_TOKEN_URL);
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
  });

  it("returns the token response on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 1800,
        token_type: "bearer",
      }),
    });

    const result = await exchangeOAuthCode(config, "code");
    expect(result.access_token).toBe("access");
    expect(result.refresh_token).toBe("refresh");
  });

  it("throws HubSpotAuthError on HTTP error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ message: "invalid_grant" }),
    });

    await expect(exchangeOAuthCode(config, "bad-code")).rejects.toThrow(HubSpotAuthError);
  });
});

// ---------------------------------------------------------------------------
// refreshOAuthToken
// ---------------------------------------------------------------------------

describe("refreshOAuthToken", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const config = {
    clientId: "cid",
    clientSecret: "csec",
    callbackUrl: "https://example.com/callback",
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts with refresh_token grant_type", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "new-at",
        refresh_token: "new-rt",
        expires_in: 1800,
        token_type: "bearer",
      }),
    });

    await refreshOAuthToken(config, "old-rt");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-rt");
  });

  it("throws HubSpotAuthError on failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ message: "token_expired" }),
    });

    await expect(refreshOAuthToken(config, "expired-rt")).rejects.toThrow(HubSpotAuthError);
  });
});
