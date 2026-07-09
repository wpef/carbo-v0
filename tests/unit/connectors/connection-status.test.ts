import { describe, it, expect } from "vitest";
import { classifyConnectionError } from "@/features/connectors/connection-status";

describe("classifyConnectionError", () => {
  it("panne de token/auth → EXPIRED", () => {
    expect(classifyConnectionError(new Error("Token expiré et aucun refresh_token"))).toBe("EXPIRED");
    expect(classifyConnectionError(new Error("invalid_grant"))).toBe("EXPIRED");
    expect(classifyConnectionError({ name: "SalesforceAuthError", message: "refresh failed" })).toBe(
      "EXPIRED",
    );
    expect(classifyConnectionError(new Error("HTTP 401 Unauthorized"))).toBe("EXPIRED");
  });
  it("autre panne → ERROR", () => {
    expect(classifyConnectionError(new Error("ECONNREFUSED"))).toBe("ERROR");
    expect(classifyConnectionError(new Error("500 Internal Server Error"))).toBe("ERROR");
    expect(classifyConnectionError("boom")).toBe("ERROR");
  });
});
