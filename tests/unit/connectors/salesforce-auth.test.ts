// Tests unitaires — Salesforce OAuth2 + PKCE (port v4 → v5).
// Aucun appel réseau réel : fetch est mocké via vi.stubGlobal.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildAuthorizationUrl,
  generatePkceChallenge,
  exchangeCodeForTokens,
  refreshAccessToken,
  storePkceVerifier,
  takePkceVerifier,
  computeExpiresAt,
  MissingSalesforceEnvError,
  SalesforceAuthError,
  loadSalesforceConfig,
} from "@/features/connectors/salesforce/auth";

const VALID_CONFIG = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  callbackUrl: "https://example.com/callback",
  loginUrl: "https://login.salesforce.com",
};

function makeFetchOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

function makeFetchError(status: number, body: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.resolve(body),
  } as Response);
}

describe("salesforce/auth", () => {
  describe("loadSalesforceConfig", () => {
    it("throws MissingSalesforceEnvError when env vars are absent", () => {
      const saved = { ...process.env };
      delete process.env.SALESFORCE_CLIENT_ID;
      delete process.env.SALESFORCE_CLIENT_SECRET;
      delete process.env.SALESFORCE_CALLBACK_URL;
      expect(() => loadSalesforceConfig()).toThrow(MissingSalesforceEnvError);
      Object.assign(process.env, saved);
    });

    it("returns config when all env vars are set", () => {
      process.env.SALESFORCE_CLIENT_ID = "CID";
      process.env.SALESFORCE_CLIENT_SECRET = "CSEC";
      process.env.SALESFORCE_CALLBACK_URL = "https://cb.example.com";
      process.env.SALESFORCE_LOGIN_URL = "https://test.salesforce.com";
      const cfg = loadSalesforceConfig();
      expect(cfg.clientId).toBe("CID");
      expect(cfg.loginUrl).toBe("https://test.salesforce.com");
      delete process.env.SALESFORCE_CLIENT_ID;
      delete process.env.SALESFORCE_CLIENT_SECRET;
      delete process.env.SALESFORCE_CALLBACK_URL;
      delete process.env.SALESFORCE_LOGIN_URL;
    });
  });

  describe("generatePkceChallenge", () => {
    it("produces distinct verifier and challenge", () => {
      const { verifier, challenge } = generatePkceChallenge();
      expect(verifier).not.toBe(challenge);
      expect(verifier.length).toBeGreaterThanOrEqual(43);
    });

    it("challenge is base64url (no + / =)", () => {
      const { challenge } = generatePkceChallenge();
      expect(challenge).not.toMatch(/[+/=]/);
    });

    it("two calls produce independent pairs", () => {
      const a = generatePkceChallenge();
      const b = generatePkceChallenge();
      expect(a.verifier).not.toBe(b.verifier);
      expect(a.challenge).not.toBe(b.challenge);
    });
  });

  describe("storePkceVerifier / takePkceVerifier", () => {
    beforeEach(() => {
      // Reset the global store between tests
      globalThis.__sfPkceStore = undefined;
    });

    it("returns the verifier after storing it", () => {
      storePkceVerifier("state-abc", "verifier-xyz");
      expect(takePkceVerifier("state-abc")).toBe("verifier-xyz");
    });

    it("is single-use: second take returns undefined", () => {
      storePkceVerifier("state-def", "verifier-v2");
      takePkceVerifier("state-def");
      expect(takePkceVerifier("state-def")).toBeUndefined();
    });

    it("returns undefined for unknown state", () => {
      expect(takePkceVerifier("no-such-state")).toBeUndefined();
    });
  });

  describe("buildAuthorizationUrl", () => {
    it("includes required OAuth2 + PKCE parameters", () => {
      const url = buildAuthorizationUrl(VALID_CONFIG, "test-state", "test-challenge");
      expect(url).toContain("/services/oauth2/authorize");
      expect(url).toContain("response_type=code");
      expect(url).toContain("code_challenge=test-challenge");
      expect(url).toContain("code_challenge_method=S256");
      expect(url).toContain("state=test-state");
      expect(url).toContain(`client_id=${encodeURIComponent(VALID_CONFIG.clientId)}`);
    });

    it("uses the loginUrl as base", () => {
      const url = buildAuthorizationUrl(VALID_CONFIG, "s", "c");
      expect(url.startsWith(VALID_CONFIG.loginUrl)).toBe(true);
    });
  });

  describe("token exchange (fetch mocké)", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("exchangeCodeForTokens", () => {
      it("returns token response on success", async () => {
        const tokenResponse = {
          access_token: "AT",
          refresh_token: "RT",
          instance_url: "https://na1.salesforce.com",
          id: "https://login.salesforce.com/id/org/user",
          token_type: "Bearer",
          issued_at: String(Date.now()),
          signature: "sig",
        };
        fetchMock.mockReturnValueOnce(makeFetchOk(tokenResponse));
        const result = await exchangeCodeForTokens(VALID_CONFIG, "auth-code", "verifier");
        expect(result.access_token).toBe("AT");
        expect(result.refresh_token).toBe("RT");
      });

      it("throws SalesforceAuthError on non-200 response", async () => {
        fetchMock.mockReturnValueOnce(
          makeFetchError(400, { error: "invalid_grant", error_description: "Code expired" }),
        );
        await expect(
          exchangeCodeForTokens(VALID_CONFIG, "bad-code", "verifier"),
        ).rejects.toThrow(SalesforceAuthError);
      });
    });

    describe("refreshAccessToken", () => {
      it("returns refreshed token response on success", async () => {
        const refreshed = {
          access_token: "AT2",
          instance_url: "https://na1.salesforce.com",
          id: "https://login.salesforce.com/id/org/user",
          token_type: "Bearer",
          issued_at: String(Date.now()),
          signature: "sig",
        };
        fetchMock.mockReturnValueOnce(makeFetchOk(refreshed));
        const result = await refreshAccessToken(VALID_CONFIG, "REFRESH_TOKEN");
        expect(result.access_token).toBe("AT2");
      });

      it("throws SalesforceAuthError on refresh failure", async () => {
        fetchMock.mockReturnValueOnce(
          makeFetchError(401, { error: "invalid_grant", error_description: "Refresh failed" }),
        );
        await expect(refreshAccessToken(VALID_CONFIG, "bad-rt")).rejects.toThrow(
          SalesforceAuthError,
        );
      });
    });
  });

  describe("computeExpiresAt", () => {
    it("returns a date ~28 min in the future from issued_at", () => {
      const issuedAt = Date.now();
      const expires = new Date(computeExpiresAt(String(issuedAt))).getTime();
      const diffMin = (expires - issuedAt) / 60000;
      expect(diffMin).toBeCloseTo(28, 0); // 30 min - 2 min safety buffer
    });

    it('falls back to "now" when issuedAt is absent', () => {
      const before = Date.now();
      const expires = new Date(computeExpiresAt()).getTime();
      expect(expires).toBeGreaterThanOrEqual(before + 28 * 60 * 1000 - 1000);
    });
  });
});
