"use client";

// Source — connexion + schéma (01-journeys §1.4).
// Sortie du parcours : « Continuer vers la sélection d'objets → »
// (anti-régression n°1 : ne JAMAIS sauter directement à la destination).

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

type PlanPayload = {
  plan: {
    id: string;
    sourceConnection: { id: string; name: string; status: string } | null;
  };
};

export default function SourcePage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [connection, setConnection] = useState<PlanPayload["plan"]["sourceConnection"]>(null);
  const [objectCount, setObjectCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/plans/${planId}`);
    if (!res.ok) return;
    const { plan }: PlanPayload = await res.json();
    setConnection(plan.sourceConnection);
    if (plan.sourceConnection) {
      const objectsRes = await fetch(`/api/plans/${planId}/source/objects`);
      if (objectsRes.ok) {
        const data = await objectsRes.json();
        setObjectCount(data.summary.total);
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
    const res = await fetch(`/api/plans/${planId}/source`, {
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
    router.refresh(); // header : pastille connecteur
    await load();
    setConnecting(false);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Système source</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connectez le CRM d&apos;où proviennent les données. Le schéma est récupéré
          automatiquement à la connexion.
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
              Salesforce (OAuth) arrive dans une prochaine itération.
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
                ? `${objectCount} objets découverts dans le schéma source.`
                : "Schéma récupéré."}
            </p>
            <Button render={<Link href={`/plans/${planId}/source/objects`} />}>
              Continuer vers la sélection d&apos;objets →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
