"use client";

// Destination — connexion + schéma (01-journeys §1.7), miroir de la source.
// Anti-régression n°2 : sortie = « Continuer vers les champs → »
// (/destination/fields), jamais un saut direct au mapping.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

type PlanPayload = {
  plan: {
    id: string;
    destinationConnection: { id: string; name: string; status: string } | null;
  };
};

export default function DestinationPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [connection, setConnection] =
    useState<PlanPayload["plan"]["destinationConnection"]>(null);
  const [objectCount, setObjectCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/plans/${planId}`);
    if (!res.ok) return;
    const { plan }: PlanPayload = await res.json();
    setConnection(plan.destinationConnection);
    if (plan.destinationConnection) {
      const fieldsRes = await fetch(`/api/plans/${planId}/destination/fields`);
      if (fieldsRes.ok) {
        const data = await fieldsRes.json();
        setObjectCount(data.groups.length);
      }
    }
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectDemo() {
    setConnecting(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}/destination`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adapterType: "demo" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Échec de la connexion");
      setConnecting(false);
      return;
    }
    router.refresh();
    await load();
    setConnecting(false);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Système de destination</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connectez le CRM qui recevra les données. Tous les objets de destination sont
          conservés — la sélection ne concerne que la source.
        </p>
      </div>

      {!connection ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choisir un connecteur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={connectDemo} disabled={connecting}>
              {connecting ? "Connexion…" : "Connecter le CRM démo"}
            </Button>
            <p className="text-xs text-muted-foreground">
              HubSpot (OAuth) arrive dans une prochaine itération.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-green-600" />
              {connection.name} — connecté
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {objectCount !== null
                ? `${objectCount} objets de destination découverts.`
                : "Schéma récupéré."}
            </p>
            <Button render={<Link href={`/plans/${planId}/destination/fields`} />}>
              Continuer vers les champs →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
