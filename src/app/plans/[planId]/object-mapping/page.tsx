"use client";

// Object mapping (01-journeys §1.9) — version skeleton : deux colonnes,
// création de paire par sélection source puis destination, auto-link au
// premier chargement (gated serveur par objectAutoLinkedAt, Principe IX),
// liste des paires avec « Mapper les champs → » (FRONTIÈRE 3 via recordStep).

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordStep } from "@/features/plans/lib/record-step";
import { cn } from "@/lib/utils";
import { Link2, Trash2, Wand2 } from "lucide-react";

type Payload = {
  mappings: {
    id: string;
    sourceObjectName: string;
    destinationObjectName: string;
    autoCreated: boolean;
    _count: { fieldMappings: number };
  }[];
  sourceObjects: { apiName: string; label: string; fieldCount: number }[];
  destinationObjects: { apiName: string; label: string; fieldCount: number }[];
  objectAutoLinkedAt: string | null;
};

export default function ObjectMappingPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [autoLinkInfo, setAutoLinkInfo] = useState<string | null>(null);
  const autoLinkTriedRef = useRef(false);

  const load = useCallback(async (): Promise<Payload | null> => {
    const res = await fetch(`/api/plans/${planId}/object-mappings`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur de chargement");
      return null;
    }
    const payload: Payload = await res.json();
    setData(payload);
    return payload;
  }, [planId]);

  useEffect(() => {
    void (async () => {
      const payload = await load();
      // Auto-link au premier chargement seulement si jamais fait (§4.3).
      if (payload && payload.objectAutoLinkedAt === null && !autoLinkTriedRef.current) {
        autoLinkTriedRef.current = true;
        const res = await fetch(`/api/plans/${planId}/object-mappings/auto-link`, {
          method: "POST",
        });
        if (res.ok) {
          const result = await res.json();
          if (result.created > 0) {
            setAutoLinkInfo(
              `${result.created} paire(s) créée(s) automatiquement depuis le registre du connecteur.`,
            );
          }
          await load();
        }
      }
    })();
  }, [load, planId]);

  async function createPair(destinationObjectName: string) {
    if (!pendingSource) return;
    const res = await fetch(`/api/plans/${planId}/object-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceObjectName: pendingSource, destinationObjectName }),
    });
    setPendingSource(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur de création");
      return;
    }
    setError(null);
    await load();
  }

  async function deletePair(mappingId: string, label: string) {
    if (
      !window.confirm(
        `Supprimer le mapping ${label} ? Les mappings de champs associés seront supprimés.`,
      )
    )
      return;
    await fetch(`/api/plans/${planId}/object-mappings/${mappingId}`, { method: "DELETE" });
    await load();
  }

  async function goToFieldMapping(sourceObjectName?: string) {
    await recordStep(planId, "FIELD_MAPPING");
    router.push(
      `/plans/${planId}/field-mapping${sourceObjectName ? `?object=${sourceObjectName}` : ""}`,
    );
    router.refresh();
  }

  if (error && !data) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const mappedSources = new Set(data.mappings.map((m) => m.sourceObjectName));
  const mappedDestinations = new Set(data.mappings.map((m) => m.destinationObjectName));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mapping des objets</h1>
        {data.mappings.length > 0 && (
          <Button onClick={() => goToFieldMapping()}>Mapper les champs →</Button>
        )}
      </div>
      {autoLinkInfo && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          <Wand2 className="mr-1 inline size-3.5" />
          {autoLinkInfo}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">
        {pendingSource
          ? `Objet source « ${pendingSource} » sélectionné — choisissez l'objet de destination.`
          : "Pour créer une paire : cliquez un objet source, puis un objet de destination."}
      </p>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Objets source sélectionnés ({data.sourceObjects.length})
          </h2>
          <ul className="space-y-1.5">
            {data.sourceObjects.map((o) => (
              <li key={o.apiName}>
                <button
                  onClick={() => setPendingSource(pendingSource === o.apiName ? null : o.apiName)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted",
                    pendingSource === o.apiName && "border-primary ring-1 ring-primary",
                    mappedSources.has(o.apiName) && "bg-muted/50",
                  )}
                >
                  <span>
                    {o.label} <span className="text-xs text-muted-foreground">({o.apiName})</span>
                  </span>
                  {mappedSources.has(o.apiName) && <Link2 className="size-3.5 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Objets destination ({data.destinationObjects.length})
          </h2>
          <ul className="space-y-1.5">
            {data.destinationObjects.map((o) => (
              <li key={o.apiName}>
                <button
                  onClick={() => createPair(o.apiName)}
                  disabled={!pendingSource}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                    pendingSource ? "hover:border-primary hover:bg-muted" : "opacity-70",
                    mappedDestinations.has(o.apiName) && "bg-muted/50",
                  )}
                >
                  <span>
                    {o.label} <span className="text-xs text-muted-foreground">({o.apiName})</span>
                  </span>
                  {mappedDestinations.has(o.apiName) && <Link2 className="size-3.5 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Paires mappées ({data.mappings.length})
        </h2>
        {data.mappings.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Aucune paire pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {data.mappings.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-medium">{m.sourceObjectName}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{m.destinationObjectName}</span>
                {m.autoCreated && <Badge variant="outline">auto</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {m._count.fieldMappings} champ(s) mappé(s)
                </span>
                <Button variant="ghost" size="sm" onClick={() => goToFieldMapping(m.sourceObjectName)}>
                  Mapper les champs →
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer ${m.sourceObjectName} → ${m.destinationObjectName}`}
                  onClick={() => deletePair(m.id, `${m.sourceObjectName} → ${m.destinationObjectName}`)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
