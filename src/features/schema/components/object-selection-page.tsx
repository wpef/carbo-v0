"use client";

// Sélection d'objets source (01-journeys §1.5) : recherche temps réel,
// filtre Tous/Sélectionnés/Non sélectionnés, toggle système, compteurs,
// sélection/désélection en masse, toggle unitaire optimiste.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type ObjectRow = {
  apiName: string;
  label: string;
  description: string | null;
  category: "custom" | "business" | "system";
  isSelected: boolean;
  fieldCount: number;
};

type Payload = {
  objects: ObjectRow[];
  summary: { total: number; selected: number; custom: number; system: number };
};

type SelectionFilter = "all" | "selected" | "unselected";

export function ObjectSelectionPage() {
  const { planId } = useParams<{ planId: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>("all");

  const load = useCallback(async () => {
    const res = await fetch(`/api/plans/${planId}/source/objects`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLoadError(body.error ?? "Erreur de chargement");
      return;
    }
    setData(await res.json());
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.objects.filter((o) => {
      if (!showSystem && o.category === "system") return false;
      if (selectionFilter === "selected" && !o.isSelected) return false;
      if (selectionFilter === "unselected" && o.isSelected) return false;
      if (
        q &&
        !o.apiName.toLowerCase().includes(q) &&
        !o.label.toLowerCase().includes(q) &&
        !(o.description ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [data, search, showSystem, selectionFilter]);

  /** Applique un delta de sélection à l'état courant (jamais de snapshot périmé). */
  function applySelection(objectApiName: string, isSelected: boolean) {
    setData((current) => {
      if (!current) return current;
      const target = current.objects.find((o) => o.apiName === objectApiName);
      if (!target || target.isSelected === isSelected) return current; // no-op
      return {
        ...current,
        objects: current.objects.map((o) =>
          o.apiName === objectApiName ? { ...o, isSelected } : o,
        ),
        summary: {
          ...current.summary,
          selected: current.summary.selected + (isSelected ? 1 : -1),
        },
      };
    });
  }

  async function toggle(objectApiName: string, isSelected: boolean) {
    // Optimiste avec revert VISIBLE (01-journeys §1.5) : en cas d'échec du
    // PUT, on ré-applique l'inverse (delta fonctionnel, pas de snapshot
    // périmé — plusieurs toggles peuvent être en vol) et on le dit.
    setToggleError(null);
    applySelection(objectApiName, isSelected);
    const res = await fetch(`/api/plans/${planId}/source/objects`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectApiName, isSelected }),
    });
    if (!res.ok) {
      applySelection(objectApiName, !isSelected);
      setToggleError(
        `La sélection de « ${objectApiName} » n'a pas pu être enregistrée — réessayez.`,
      );
    }
  }

  async function setAll(isSelected: boolean) {
    // Portée = objets actuellement visibles (01-journeys §1.5).
    for (const o of visible.filter((v) => v.isSelected !== isSelected)) {
      await toggle(o.apiName, isSelected);
    }
    await load();
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-destructive">{loadError}</p>
        <Link href={`/plans/${planId}/source`} className="text-sm underline">
          ← Retour à la connexion source
        </Link>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const systemCount = data.summary.system;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/plans/${planId}/source`}
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Connexion source
          </Link>
          <h1 className="text-xl font-semibold">Sélection des objets à migrer</h1>
        </div>
        <Link href={`/plans/${planId}/source/fields`} className={buttonVariants()}>
          Continuer vers les champs →
        </Link>
      </div>

      {toggleError && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {toggleError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher un objet…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Filtre de sélection">
          {(
            [
              ["all", "Tous"],
              ["selected", "Sélectionnés"],
              ["unselected", "Non sélectionnés"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSelectionFilter(value)}
              className={cn(
                "rounded px-2.5 py-1 text-xs",
                selectionFilter === value ? "bg-muted font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSystem((v) => !v)}>
          {showSystem ? `Masquer les objets système (${systemCount})` : `Afficher les objets système (${systemCount})`}
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {data.summary.selected} objets sélectionnés sur {data.summary.total}
          {!showSystem && systemCount > 0 && ` · ${systemCount} objets système masqués`}
        </span>
        <span className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
            Tout sélectionner
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
            Tout désélectionner
          </Button>
        </span>
      </div>

      <ul className="divide-y rounded-md border">
        {visible.map((o) => (
          <li key={o.apiName} className="flex items-center gap-3 px-3 py-2">
            <Checkbox
              id={`select-${o.apiName}`}
              checked={o.isSelected}
              onCheckedChange={(checked) => toggle(o.apiName, checked === true)}
              aria-label={`Sélectionner ${o.apiName}`}
            />
            <label htmlFor={`select-${o.apiName}`} className="flex-1 cursor-pointer">
              <span className="font-medium">{o.label}</span>{" "}
              <span className="text-xs text-muted-foreground">({o.apiName})</span>
              {o.description && (
                <p className="text-xs text-muted-foreground">{o.description}</p>
              )}
            </label>
            <span className="text-xs text-muted-foreground">{o.fieldCount} champs</span>
            <Badge
              variant={o.category === "custom" ? "default" : o.category === "system" ? "outline" : "secondary"}
              title={
                o.category === "custom"
                  ? "Objet créé sur mesure dans le CRM source"
                  : o.category === "system"
                    ? "Objet technique du CRM, rarement migré"
                    : "Objet standard du CRM"
              }
            >
              {o.category === "custom" ? "Personnalisé" : o.category === "system" ? "Système" : "Standard"}
            </Badge>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucun objet ne correspond aux filtres.
          </li>
        )}
      </ul>
    </div>
  );
}
