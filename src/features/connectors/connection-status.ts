// Statut d'une connexion (05-acceptance §1/§5). CONNECTED / EXPIRED / ERROR.
// Pur — aucune I/O.

import type { ConnectionStatus } from "@prisma/client";

/** Une panne de token/auth = EXPIRED (reconnexion attendue) ; le reste = ERROR. */
export function classifyConnectionError(err: unknown): "EXPIRED" | "ERROR" {
  const o = err as { name?: unknown; message?: unknown } | null;
  const s =
    o && typeof o === "object" && ("message" in o || "name" in o)
      ? `${o.name ?? ""} ${o.message ?? ""}`
      : String(err);
  return /token|expir|auth|refresh|401|403|invalid_grant/i.test(s) ? "EXPIRED" : "ERROR";
}

export const CONNECTION_STATUS_UI: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string }
> = {
  CONNECTED: { label: "connecté", dot: "bg-green-600", text: "text-green-700" },
  EXPIRED: { label: "expiré — reconnexion requise", dot: "bg-amber-500", text: "text-amber-700" },
  ERROR: { label: "erreur", dot: "bg-red-600", text: "text-destructive" },
};
