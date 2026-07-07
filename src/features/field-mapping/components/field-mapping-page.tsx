"use client";

// Field mapping — FRONTIÈRE 4 (01-journeys §1.10).
// v5 : lit `?object=` pour ouvrir la bonne paire (dette v4 corrigée).
// Auto-match au premier affichage d'une paire vide (gated serveur par
// fieldAutoMatchedAt, Principe IX). « Continuer vers les documents → » =
// recordStep(DOCUMENTS) — la frontière est VALIDÉE côté serveur (≥1 champ
// mappé) et le refus est AFFICHÉ ici (pas avalé : on est à la frontière).
//
// Revue UX v5 : les colonnes ne montrent que le travail RESTANT (les paires
// faites vivent dans la liste du bas) ; info ≠ erreur (deux bandeaux
// distincts) ; libellés humains partout ; sortie en bas de la dernière paire.

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordStep } from "@/features/plans/lib/record-step";
import { MigrationLogicDialog } from "@/features/migration-logic/components/migration-logic-dialog";
import { cn } from "@/lib/utils";
import { Trash2, TriangleAlert, Wand2 } from "lucide-react";

type PairSummary = {
  id: string;
  sourceObjectName: string;
  destinationObjectName: string;
  _count: { fieldMappings: number };
};

type ObjectInfo = { apiName: string; label: string };

type FieldMappingItem = {
  id: string;
  sourceFieldName: string;
  sourceFieldLabel: string;
  destinationFieldName: string;
  destinationFieldLabel: string;
  sourceFieldType: string;
  destinationFieldType: string;
  compatibilityStatus: "COMPATIBLE" | "WARNING" | "INCOMPATIBLE";
  linkStatus: "GREEN" | "ORANGE" | "RED_SOLID" | "RED_DASHED" | "BROKEN";
  statusDetail?: string;
  autoCreated: boolean;
};

type PairDetail = {
  objectMapping: PairSummary & { fieldAutoMatchedAt: string | null };
  sourceFields: { apiName: string; label: string; dataType: string; isRequired: boolean }[];
  destinationFields: { apiName: string; label: string; dataType: string }[];
  fieldMappings: FieldMappingItem[];
};

// Statut de lien 5 états (02-domain-rules règle 1) — le badge EST le bouton
// d'ouverture du modal de logique de migration.
const LINK_STATUS_UI = {
  GREEN: { label: "prêt", className: "border-green-300 bg-green-50 text-green-800" },
  ORANGE: { label: "en cours", className: "border-amber-400 bg-amber-50 text-amber-900" },
  RED_SOLID: { label: "à configurer", className: "border-red-400 bg-red-50 text-red-800" },
  RED_DASHED: {
    label: "incompatible",
    className: "border-dashed border-red-400 bg-background text-red-700",
  },
  BROKEN: { label: "rompu", className: "border-zinc-400 bg-zinc-100 text-zinc-700" },
} as const;

function LinkStatusBadge({
  mapping,
  onOpenLogic,
}: {
  mapping: FieldMappingItem;
  onOpenLogic: () => void;
}) {
  const ui = LINK_STATUS_UI[mapping.linkStatus];
  const explanation =
    mapping.statusDetail ??
    `${mapping.sourceFieldType} → ${mapping.destinationFieldType}. Cliquez pour ouvrir la logique de migration.`;
  return (
    <button
      type="button"
      onClick={onOpenLogic}
      title={explanation}
      aria-label={`Logique de migration pour ${mapping.sourceFieldName}`}
      className="ml-auto shrink-0"
      disabled={mapping.linkStatus === "BROKEN"}
    >
      <Badge variant="outline" className={cn("cursor-pointer", ui.className)}>
        {ui.label}
        {mapping.statusDetail && mapping.linkStatus === "ORANGE" && (
          <span className="ml-1 font-normal">· {mapping.statusDetail}</span>
        )}
      </Badge>
    </button>
  );
}

function FieldMappingContent() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedObject = searchParams.get("object");

  const [pairs, setPairs] = useState<PairSummary[] | null>(null);
  const [objectLabels, setObjectLabels] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PairDetail | null>(null);
  const [pendingSourceField, setPendingSourceField] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [logicFieldMappingId, setLogicFieldMappingId] = useState<string | null>(null);
  const autoMatchTriedRef = useRef<Set<string>>(new Set());

  // Liste des paires (compteurs des onglets inclus) — rafraîchie après
  // chaque mutation, sinon les badges mentent (bug attrapé par le test de
  // parcours). Sélection initiale pilotée par ?object= (dette v4).
  const loadPairs = useCallback(async (): Promise<PairSummary[] | null> => {
    const res = await fetch(`/api/plans/${planId}/object-mappings`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLoadError(body.error ?? "Erreur de chargement");
      return null;
    }
    const data = await res.json();
    const labels = new Map<string, string>();
    for (const o of [...data.sourceObjects, ...data.destinationObjects] as ObjectInfo[]) {
      labels.set(o.apiName, o.label);
    }
    setObjectLabels(labels);
    setPairs(data.mappings as PairSummary[]);
    return data.mappings as PairSummary[];
  }, [planId]);

  useEffect(() => {
    void loadPairs().then((list) => {
      if (list && list.length > 0) {
        const requested = list.find((p) => p.sourceObjectName === requestedObject);
        setActivePairId((prev) => prev ?? (requested ?? list[0]).id);
      }
    });
  }, [loadPairs, requestedObject]);

  const labelOf = useCallback(
    (apiName: string) => objectLabels.get(apiName) ?? apiName,
    [objectLabels],
  );

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
    setNotice(null);
    setActionError(null);
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
          await Promise.all([loadDetail(activePairId), loadPairs()]);
        }
      }
    })();
  }, [activePairId, loadDetail, loadPairs, planId]);

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
      setActionError(body.error ?? "La création du mapping a échoué.");
    } else {
      setActionError(null);
    }
    await Promise.all([loadDetail(activePairId), loadPairs()]);
  }

  async function deleteMapping(fieldMappingId: string) {
    if (!activePairId) return;
    await fetch(`/api/plans/${planId}/field-mappings/${fieldMappingId}`, { method: "DELETE" });
    router.refresh(); // le statut du plan peut redescendre (recomputeReadiness)
    await Promise.all([loadDetail(activePairId), loadPairs()]);
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

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold">Mapping des champs</h1>
        <p className="text-sm text-destructive">{loadError}</p>
        <div className="flex gap-4 text-sm">
          <Link href={`/plans/${planId}/source`} className="underline">
            ← Connecter la source
          </Link>
          <Link href={`/plans/${planId}/destination`} className="underline">
            ← Connecter la destination
          </Link>
        </div>
      </div>
    );
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
  const remainingSourceFields =
    detail?.sourceFields.filter((f) => !mappedSourceFields.has(f.apiName)) ?? [];
  const remainingDestinationFields =
    detail?.destinationFields.filter((f) => !mappedDestinationFields.has(f.apiName)) ?? [];
  const fieldLabel = (apiName: string) =>
    detail?.sourceFields.find((f) => f.apiName === apiName)?.label ??
    detail?.destinationFields.find((f) => f.apiName === apiName)?.label ??
    apiName;
  const activeIdx = pairs.findIndex((p) => p.id === activePairId);
  const nextPair = activeIdx >= 0 && activeIdx < pairs.length - 1 ? pairs[activeIdx + 1] : null;
  const emptyPairCount = pairs.filter((p) => p._count.fieldMappings === 0).length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Mapping des champs</h1>
        <div className="flex items-center gap-3">
          {emptyPairCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-700">
              <TriangleAlert className="size-3.5" />
              {emptyPairCount} paire(s) sans champ mappé
            </span>
          )}
          <Button onClick={continueToDocuments}>Continuer vers les documents →</Button>
        </div>
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
            title={`${pair.sourceObjectName} → ${pair.destinationObjectName}`}
            className={cn(
              "rounded-t-md px-3 py-1.5 text-sm",
              pair.id === activePairId
                ? "border border-b-0 bg-background font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {labelOf(pair.sourceObjectName)} → {labelOf(pair.destinationObjectName)}
            <span className="ml-1.5 text-xs text-muted-foreground">
              · {pair._count.fieldMappings} champ{pair._count.fieldMappings > 1 ? "s" : ""}
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
      {actionError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {detail && (
        <>
          <p className="text-sm text-muted-foreground">
            {pendingSourceField
              ? `Champ source « ${fieldLabel(pendingSourceField)} » sélectionné — choisissez le champ de destination.`
              : "Pour mapper : cliquez un champ source, puis un champ de destination. Les paires déjà faites sont dans la liste ci-dessous."}
          </p>

          <div className="grid grid-cols-2 gap-6">
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                1. Champs source restants — {labelOf(detail.objectMapping.sourceObjectName)}
              </h2>
              {remainingSourceFields.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                  Tous les champs source sont mappés.
                </p>
              ) : (
                <ul className="space-y-1">
                  {remainingSourceFields.map((f) => (
                    <li key={f.apiName}>
                      <button
                        onClick={() =>
                          setPendingSourceField(pendingSourceField === f.apiName ? null : f.apiName)
                        }
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm hover:bg-muted",
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
              )}
            </section>
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                2. Champs destination restants — {labelOf(detail.objectMapping.destinationObjectName)}
              </h2>
              {remainingDestinationFields.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                  Tous les champs destination sont mappés.
                </p>
              ) : (
                <ul className="space-y-1">
                  {remainingDestinationFields.map((f) => (
                    <li key={f.apiName}>
                      <button
                        onClick={() => createMapping(f.apiName)}
                        disabled={!pendingSourceField}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm",
                          pendingSourceField ? "hover:border-primary hover:bg-muted" : "opacity-70",
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
              )}
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
                    <span>
                      {m.sourceFieldLabel}{" "}
                      <span className="text-xs text-muted-foreground">({m.sourceFieldName})</span>
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span>
                      {m.destinationFieldLabel}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({m.destinationFieldName})
                      </span>
                    </span>
                    {m.autoCreated && <Badge variant="outline">auto</Badge>}
                    <LinkStatusBadge mapping={m} onOpenLogic={() => setLogicFieldMappingId(m.id)} />
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

          <div className="flex justify-end">
            {nextPair ? (
              <Button variant="outline" onClick={() => setActivePairId(nextPair.id)}>
                Objet suivant : {labelOf(nextPair.sourceObjectName)} →
              </Button>
            ) : (
              <Button onClick={continueToDocuments}>Terminer le mapping →</Button>
            )}
          </div>
        </>
      )}

      {logicFieldMappingId && activePairId && (
        <MigrationLogicDialog
          planId={planId}
          fieldMappingId={logicFieldMappingId}
          onClose={() => setLogicFieldMappingId(null)}
          onSaved={() => void loadDetail(activePairId)}
        />
      )}
    </div>
  );
}

export function FieldMappingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <FieldMappingContent />
    </Suspense>
  );
}
