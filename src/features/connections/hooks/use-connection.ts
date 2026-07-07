"use client";

// État et actions d'une page de connexion (source OU destination).
// Toute la logique vit ici ; les composants ne font que rendre.

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdapterDescriptor } from "@/features/connectors/contract";

export type Side = "source" | "destination";

type ConnectionInfo = { id: string; name: string; status: string; adapterType: string };

type PlanPayload = {
  plan: {
    id: string;
    sourceConnection: ConnectionInfo | null;
    destinationConnection: ConnectionInfo | null;
  };
};

export function useConnection(planId: string, side: Side) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [adapters, setAdapters] = useState<AdapterDescriptor[]>([]);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [objectCount, setObjectCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // action en cours (libellé)
  const [error, setError] = useState<string | null>(null);
  const autoFetchTriedRef = useRef(false);

  // Erreur remontée par un callback OAuth (?connector_error=…).
  useEffect(() => {
    const oauthError = searchParams.get("connector_error");
    if (oauthError) {
      setError(
        oauthError === "not_configured"
          ? "Ce connecteur n'est pas configuré (variables d'environnement manquantes)."
          : `Échec de la connexion : ${oauthError}`,
      );
    }
  }, [searchParams]);

  const loadObjectCount = useCallback(async (): Promise<number | null> => {
    // Le compteur d'objets vient du snapshot ; la route diffère par side.
    const url =
      side === "source"
        ? `/api/plans/${planId}/source/objects`
        : `/api/plans/${planId}/destination/fields`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const count: number = side === "source" ? data.summary.total : data.groups.length;
    setObjectCount(count);
    return count;
  }, [planId, side]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/plans/${planId}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const { plan }: PlanPayload = await res.json();
    const conn = side === "source" ? plan.sourceConnection : plan.destinationConnection;
    setConnection(conn);
    if (conn) {
      const count = await loadObjectCount();
      // Filet §4.1 : connecté SANS snapshot (fetch du callback échoué) →
      // on relance la récupération du schéma, une fois.
      if (count === null && !autoFetchTriedRef.current) {
        autoFetchTriedRef.current = true;
        setBusy("Récupération du schéma…");
        const fetchRes = await fetch(`/api/plans/${planId}/${side}/schema`, { method: "POST" });
        if (fetchRes.ok) await loadObjectCount();
        else {
          const body = await fetchRes.json().catch(() => ({}));
          setError(body.error ?? "La récupération du schéma a échoué.");
        }
        setBusy(null);
      }
    }
    setLoading(false);
  }, [planId, side, loadObjectCount]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/connectors?side=${side.toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setAdapters(data.adapters);
      }
      await load();
    })();
  }, [side, load]);

  /** Connexion directe (connectMode "direct", ex. démo). */
  async function connectDirect(adapterType: string) {
    setBusy("Connexion…");
    setError(null);
    const res = await fetch(`/api/plans/${planId}/${side}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adapterType }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Échec de la connexion");
    } else {
      router.refresh(); // header : pastille connecteur
      await load();
    }
    setBusy(null);
  }

  /** Connexion OAuth : redirection navigateur vers la route d'init. */
  function connectOAuth(adapterType: string) {
    window.location.href = `/api/connectors/${adapterType}/auth?planId=${planId}`;
  }

  /** Connexion HubSpot par token Private App. */
  async function connectPrivateApp(accessToken: string) {
    setBusy("Validation du token…");
    setError(null);
    const res = await fetch(`/api/connectors/hubspot/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, accessToken }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Token invalide");
    } else {
      router.refresh();
      await load();
    }
    setBusy(null);
  }

  async function refreshSchema() {
    setBusy("Actualisation du schéma…");
    setError(null);
    const res = await fetch(`/api/plans/${planId}/${side}/schema`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "L'actualisation a échoué");
    } else {
      await loadObjectCount();
    }
    setBusy(null);
  }

  async function disconnect() {
    if (!window.confirm("Déconnecter ce système ? Le schéma récupéré et la sélection d'objets seront supprimés.")) {
      return;
    }
    setBusy("Déconnexion…");
    await fetch(`/api/plans/${planId}/${side}`, { method: "DELETE" });
    setConnection(null);
    setObjectCount(null);
    autoFetchTriedRef.current = false;
    router.refresh();
    setBusy(null);
  }

  return {
    adapters,
    connection,
    objectCount,
    loading,
    busy,
    error,
    connectDirect,
    connectOAuth,
    connectPrivateApp,
    refreshSchema,
    disconnect,
  };
}
