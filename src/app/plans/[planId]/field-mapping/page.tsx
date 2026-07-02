"use client";

// Field mapping — FRONTIÈRE 4 (01-journeys §1.10).
// v5 : lit `?object=` pour ouvrir la bonne paire (dette v4 corrigée).
// Auto-match au premier affichage d'une paire vide (gated serveur par
// fieldAutoMatchedAt, Principe IX). « Continuer vers les documents → » =
// recordStep(DOCUMENTS) — la frontière est VALIDÉE côté serveur (≥1 champ
// mappé) et le refus est AFFICHÉ ici (pas avalé : on est à la frontière).

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordStep } from "@/features/plans/lib/record-step";
import { cn } from "@/lib/utils";
import { Trash2, Wand2 } from "lucide-react";

type PairSummary = {
  id: string;
  sourceObjectName: string;
  destinationObjectName: string;
  _count: { fieldMappings: number };
};

type PairDetail = {
  objectMapping: PairSummary & { fieldAutoMatchedAt: string | null };
  sourceFields: { apiName: string; label: string; dataType: string; isRequired: boolean }[];
  destinationFields: { apiName: string; label: string; dataType: string }[];
  fieldMappings: {
    id: string;
    sourceFieldName: string;
    destinationFieldName: string;
    compatibilityStatus: "COMPATIBLE" | "WARNING" | "INCOMPATIBLE";
    autoCreated: boolean;
  }[];
};

const COMPAT_LABELS = { COMPATIBLE: "compatible", WARNING: "à vérifier", INCOMPATIBLE: "incompatible" } as const;
const COMPAT_VARIANTS = { COMPATIBLE: "secondary", WARNING: "outline", INCOMPATIBLE: "destructive" } as const;

function FieldMappingContent() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedObject = searchParams.get("object");

  const [pairs, setPairs] = useState<PairSummary[] | null>(null);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PairDetail | null>(null);
  const [pendingSourceField, setPendingSourceField] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const autoMatchTriedRef = useRef<Set<string>>(new Set());

  // Liste des paires ; sélection initiale pilotée par ?object= (dette v4).
  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/plans/${planId}/object-mappings`);
      if (!res.ok) return;
      const data = await res.json();
      const list: PairSummary[] = data.mappings;
      setPairs(list);
      if (list.length > 0) {
        const requested = list.find((p) => p.sourceObjectName === requestedObject);
        setActivePairId((prev) => prev ?? (requested ?? list[0]).id);
      }
    })();
  }, [planId, requestedObject]);

  const loadDetail = useCallback(
    async (pairId: string): Promise<PairDetail | null> => {
      const res = await fetch(
        `/api/plans/${planId}/field-mappings?objectMappingId=${pairId}`,
      );
      if (!res.ok) return null;
      const payload: PairDetail = await res.json();
      setDetail(payload);
      return payload;
    },
    [planId],
  );

  useEffect(() => {
    if (!activePairId) return;
    setPendingSourceField(null);
    void (async () => {
      const payload = await loadDetail(activePairId);
      // Auto-match si la paire est vide et jamais tentée (§4.3).
      if (
        payload &&
        payload.fieldMappings.length === 0 &&
        payload.objectMapping.fieldAutoMatchedAt === null &&
        !autoMatchTriedRef.current.has(activePairId)
      ) {
        autoMatchTriedRef.current.add(activePairId);
        const res = await fetch(`/api/plans/${planId}/field-mappings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectMappingId: activePairId, autoMatch: true }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.created > 0) {
            setNotice(`${result.created} champ(s) mappé(s) automatiquement.`);
          }
          await loadDetail(activePairId);
        }
      }
    })();
  }, [activePairId, loadDetail, planId]);

  async function createMapping(destinationFieldName: string) {
    if (!pendingSourceField || !activePairId) return;
    const res = await fetch(`/api/plans/${planId}/field-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectMappingId: activePairId,
        sourceFieldName: pendingSourceField,
        destinationFieldName,
      }),
    });
    setPendingSourceField(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setNotice(body.error ?? "Erreur de création");
    } else {
      setNotice(null);
    }
    await loadDetail(activePairId);
  }

  async function deleteMapping(fieldMappingId: string) {
    if (!activePairId) return;
    await fetch(`/api/plans/${planId}/field-mappings/${fieldMappingId}`, { method: "DELETE" });
    await loadDetail(activePairId);
  }

  async function continueToDocuments() {
    setBoundaryError(null);
    const result = await recordStep(planId, "DOCUMENTS");
    if (!result.ok && result.error) {
      // À la frontière, un refus de VALIDATION doit être visible (pas avalé).
      setBoundaryError(result.error);
      return;
    }
    router.push(`/plans/${planId}/documents`);
    router.refresh();
  }

  if (!pairs) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (pairs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold">Mapping des champs</h1>
        <p className="text-sm text-muted-foreground">
          Aucune paire d&apos;objets mappée. Commencez par le mapping des objets.
        </p>
        <Button onClick={() => router.push(`/plans/${planId}/object-mapping`)}>
          ← Retour au mapping des objets
        </Button>
      </div>
    );
  }

  const mappedSourceFields = new Set(detail?.fieldMappings.map((m) => m.sourceFieldName));
  const mappedDestinationFields = new Set(
    detail?.fieldMappings.map((m) => m.destinationFieldName),
  );
  const activeIdx = pairs.findIndex((p) => p.id === activePairId);
  const nextPair = activeIdx >= 0 && activeIdx < pairs.length - 1 ? pairs[activeIdx + 1] : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mapping des champs</h1>
        <Button onClick={continueToDocuments}>Continuer vers les documents →</Button>
      </div>
      {boundaryError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {boundaryError}
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Paires d'objets">
        {pairs.map((pair) => (
          <button
            key={pair.id}
            role="tab"
            aria-selected={pair.id === activePairId}
            onClick={() => setActivePairId(pair.id)}
            className={cn(
              "rounded-t-md px-3 py-1.5 text-sm",
              pair.id === activePairId
                ? "border border-b-0 bg-background font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {pair.sourceObjectName} → {pair.destinationObjectName}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {pair._count.fieldMappings}
            </span>
          </button>
        ))}
      </div>

      {notice && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          <Wand2 className="mr-1 inline size-3.5" />
          {notice}
        </p>
      )}

      {detail && (
        <>
          <p className="text-sm text-muted-foreground">
            {detail.fieldMappings.length} champ(s) mappé(s) ·{" "}
            {detail.sourceFields.length - detail.fieldMappings.length} non mappé(s).{" "}
            {pendingSourceField
              ? `Champ source « ${pendingSourceField} » sélectionné — choisissez le champ de destination.`
              : "Pour mapper : cliquez un champ source, puis un champ de destination."}
          </p>

          <div className="grid grid-cols-2 gap-6">
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Champs source — {detail.objectMapping.sourceObjectName}
              </h2>
              <ul className="space-y-1">
                {detail.sourceFields.map((f) => (
                  <li key={f.apiName}>
                    <button
                      onClick={() =>
                        setPendingSourceField(pendingSourceField === f.apiName ? null : f.apiName)
                      }
                      disabled={mappedSourceFields.has(f.apiName)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm",
                        mappedSourceFields.has(f.apiName)
                          ? "bg-muted/50 text-muted-foreground"
                          : "hover:bg-muted",
                        pendingSourceField === f.apiName && "border-primary ring-1 ring-primary",
                      )}
                    >
                      <span>
                        {f.label} <span className="text-xs text-muted-foreground">({f.apiName})</span>
                      </span>
                      <Badge variant="secondary">{f.dataType}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Champs destination — {detail.objectMapping.destinationObjectName}
              </h2>
              <ul className="space-y-1">
                {detail.destinationFields.map((f) => (
                  <li key={f.apiName}>
                    <button
                      onClick={() => createMapping(f.apiName)}
                      disabled={!pendingSourceField || mappedDestinationFields.has(f.apiName)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm",
                        mappedDestinationFields.has(f.apiName)
                          ? "bg-muted/50 text-muted-foreground"
                          : pendingSourceField
                            ? "hover:border-primary hover:bg-muted"
                            : "opacity-70",
                      )}
                    >
                      <span>
                        {f.label} <span className="text-xs text-muted-foreground">({f.apiName})</span>
                      </span>
                      <Badge variant="secondary">{f.dataType}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Champs mappés ({detail.fieldMappings.length})
            </h2>
            {detail.fieldMappings.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                Aucun champ mappé pour cette paire.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {detail.fieldMappings.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span>{m.sourceFieldName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{m.destinationFieldName}</span>
                    {m.autoCreated && <Badge variant="outline">auto</Badge>}
                    <Badge className="ml-auto" variant={COMPAT_VARIANTS[m.compatibilityStatus]}>
                      {COMPAT_LABELS[m.compatibilityStatus]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer le mapping ${m.sourceFieldName}`}
                      onClick={() => deleteMapping(m.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {nextPair && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setActivePairId(nextPair.id)}>
                Objet suivant : {nextPair.sourceObjectName} →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FieldMappingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <FieldMappingContent />
    </Suspense>
  );
}
