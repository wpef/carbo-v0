"use client";

// Champs source — FRONTIÈRE 1 du parcours (01-journeys §1.6) :
// « Connecter la destination → » = recordStep(DESTINATION) puis navigation.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { recordStep } from "@/features/plans/lib/record-step";
import { FieldCatalogView, type FieldCatalog } from "@/features/schema/components/field-catalog-view";
import { ArrowLeft } from "lucide-react";

export default function SourceFieldsPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [catalog, setCatalog] = useState<FieldCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/plans/${planId}/source/fields`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erreur de chargement");
        return;
      }
      setCatalog(await res.json());
    })();
  }, [planId]);

  async function continueToDestination() {
    await recordStep(planId, "DESTINATION");
    router.push(`/plans/${planId}/destination`);
    router.refresh();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link href={`/plans/${planId}/source/objects`} className="text-sm underline">
          ← Retour à la sélection d&apos;objets
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
            href={`/plans/${planId}/source/objects`}
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Sélection d&apos;objets
          </Link>
          <h1 className="text-xl font-semibold">Champs des objets sélectionnés</h1>
        </div>
        <Button onClick={continueToDestination}>Connecter la destination →</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {catalog.groups.length} objets · {catalog.totalFields} champs
        {catalog.inaccessibleCount > 0 && ` · ${catalog.inaccessibleCount} inaccessibles`}
      </p>
      <FieldCatalogView catalog={catalog} />
    </div>
  );
}
