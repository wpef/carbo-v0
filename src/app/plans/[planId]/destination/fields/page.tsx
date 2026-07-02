"use client";

// Champs destination — FRONTIÈRE 2 (01-journeys §1.8) :
// « Créer le mapping → » = recordStep(OBJECT_MAPPING) puis navigation.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { recordStep } from "@/features/plans/lib/record-step";
import {
  FieldCatalogView,
  type FieldCatalog,
} from "@/features/schema/components/field-catalog-view";
import { ArrowLeft } from "lucide-react";

export default function DestinationFieldsPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [catalog, setCatalog] = useState<FieldCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/plans/${planId}/destination/fields`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erreur de chargement");
        return;
      }
      setCatalog(await res.json());
    })();
  }, [planId]);

  async function continueToMapping() {
    await recordStep(planId, "OBJECT_MAPPING");
    router.push(`/plans/${planId}/object-mapping`);
    router.refresh();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link href={`/plans/${planId}/destination`} className="text-sm underline">
          ← Retour à la connexion destination
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
            href={`/plans/${planId}/destination`}
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Connexion destination
          </Link>
          <h1 className="text-xl font-semibold">Champs de la destination</h1>
        </div>
        <Button onClick={continueToMapping}>Créer le mapping →</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Schéma destination prêt : {catalog.groups.length} objets · {catalog.totalFields} champs.
      </p>
      <FieldCatalogView catalog={catalog} />
    </div>
  );
}
