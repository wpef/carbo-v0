"use client";

// Page champs générique (source OU destination) — 01-journeys §1.6/§1.8.
// Auto-récupération au premier passage si aucun champ (§4.2, ref-guard une
// fois par mount) : avec un vrai CRM, les champs ne sont PAS récupérés à la
// connexion (1 describe par objet) — c'est ici que ça se passe, scopé aux
// objets sélectionnés côté source.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanStep } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { recordStep } from "@/features/plans/lib/record-step";
import { FieldCatalogView, type FieldCatalog } from "./field-catalog-view";
import { ArrowLeft, RefreshCw } from "lucide-react";

type Side = "source" | "destination";

const COPY: Record<
  Side,
  {
    title: string;
    backHref: string;
    backLabel: string;
    continueLabel: string;
    nextStep: PlanStep;
    nextPath: string;
  }
> = {
  source: {
    title: "Champs des objets sélectionnés",
    backHref: "/source/objects",
    backLabel: "Sélection d'objets",
    continueLabel: "Connecter la destination →",
    nextStep: "DESTINATION",
    nextPath: "/destination",
  },
  destination: {
    title: "Champs de la destination",
    backHref: "/destination",
    backLabel: "Connexion destination",
    continueLabel: "Créer le mapping →",
    nextStep: "OBJECT_MAPPING",
    nextPath: "/object-mapping",
  },
};

export function FieldsPage({ side }: { side: Side }) {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const copy = COPY[side];
  const [catalog, setCatalog] = useState<FieldCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrieving, setRetrieving] = useState(false);
  const autoRetrievedRef = useRef(false);

  const loadCatalog = useCallback(async (): Promise<FieldCatalog | null> => {
    const res = await fetch(`/api/plans/${planId}/${side}/fields`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur de chargement");
      return null;
    }
    const payload: FieldCatalog = await res.json();
    setCatalog(payload);
    return payload;
  }, [planId, side]);

  const retrieve = useCallback(async () => {
    setRetrieving(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}/${side}/fields`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "La récupération des champs a échoué");
    } else {
      await loadCatalog();
    }
    setRetrieving(false);
  }, [planId, side, loadCatalog]);

  useEffect(() => {
    void (async () => {
      const payload = await loadCatalog();
      // Auto-retrieve à la PREMIÈRE arrivée seulement (§4.2).
      if (payload && payload.totalFields === 0 && !autoRetrievedRef.current) {
        autoRetrievedRef.current = true;
        await retrieve();
      }
    })();
  }, [loadCatalog, retrieve]);

  async function continueToNext() {
    await recordStep(planId, copy.nextStep);
    router.push(`/plans/${planId}${copy.nextPath}`);
    router.refresh();
  }

  if (error && !catalog) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-destructive">{error}</p>
        <Link href={`/plans/${planId}${copy.backHref}`} className="text-sm underline">
          ← {copy.backLabel}
        </Link>
      </div>
    );
  }
  if (!catalog) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/plans/${planId}${copy.backHref}`}
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> {copy.backLabel}
          </Link>
          <h1 className="text-xl font-semibold">{copy.title}</h1>
        </div>
        <Button onClick={continueToNext} disabled={retrieving || catalog.totalFields === 0}>
          {copy.continueLabel}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {retrieving ? (
          <span>Récupération des champs en cours…</span>
        ) : (
          <span>
            {catalog.groups.length} objets · {catalog.totalFields} champs
            {catalog.inaccessibleCount > 0 && ` · ${catalog.inaccessibleCount} inaccessibles`}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={retrieve} disabled={retrieving}>
          <RefreshCw className="size-3.5" /> Re-récupérer
        </Button>
      </div>

      <FieldCatalogView catalog={catalog} />
    </div>
  );
}
