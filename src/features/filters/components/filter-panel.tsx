"use client";

// Panneau des filtres de migration d'une paire (01-journeys — étape field
// mapping). Repliable ; toggle ON/OFF sans suppression ; estimation du
// volume sous les filtres (gracieuse si le connecteur ne la supporte pas).

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOperatorMeta } from "../lib/filter-operators";
import { useMigrationFilters } from "../hooks/use-migration-filters";
import { FilterForm } from "./filter-form";
import type { FilterItem } from "../types";
import { ChevronDown, ChevronRight, Filter, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

function FilterRow({
  filter,
  onToggle,
  onRemove,
}: {
  filter: FilterItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const meta = getOperatorMeta(filter.operator);
  return (
    <li className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", !filter.isActive && "opacity-60")}>
      <span>
        {filter.fieldLabel ?? filter.fieldApiName}{" "}
        <span className="text-xs text-muted-foreground">({filter.fieldApiName})</span>
      </span>
      <Badge variant="secondary">{meta?.label ?? filter.operator}</Badge>
      {filter.value !== null && filter.value !== "" && <span className="font-medium">{filter.value}</span>}
      {filter.warning && (
        <span title={filter.warning}>
          <TriangleAlert className="size-3.5 text-amber-600" />
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          aria-label={`${filter.isActive ? "Désactiver" : "Activer"} le filtre ${filter.fieldApiName}`}
        >
          {filter.isActive ? "Actif" : "Inactif"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Supprimer le filtre ${filter.fieldApiName}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

export function FilterPanel({
  planId,
  mappingId,
  sourceObjectLabel,
  sourceFields,
}: {
  planId: string;
  mappingId: string;
  sourceObjectLabel: string;
  sourceFields: { apiName: string; label: string; dataType: string }[];
}) {
  const [open, setOpen] = useState(false);
  const { filters, estimate, error, busy, create, toggle, remove } = useMigrationFilters(
    planId,
    mappingId,
  );
  const activeCount = filters.filter((f) => f.isActive).length;

  return (
    <section className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <Filter className="size-3.5" />
        Filtres de migration — {sourceObjectLabel}
        <Badge variant={activeCount > 0 ? "default" : "secondary"} className="ml-1">
          {activeCount} actif{activeCount > 1 ? "s" : ""}
        </Badge>
      </button>

      {open && (
        <div className="space-y-3 border-t px-3 py-3">
          <p className="text-xs text-muted-foreground">
            Seuls les enregistrements source qui passent TOUS les filtres actifs seront migrés.
            Un filtre désactivé est conservé mais ignoré.
          </p>

          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {filters.length > 0 && (
            <ul className="divide-y rounded-md border">
              {filters.map((f) => (
                <FilterRow
                  key={f.id}
                  filter={f}
                  onToggle={() => void toggle(f)}
                  onRemove={() => void remove(f.id)}
                />
              ))}
            </ul>
          )}

          <FilterForm sourceFields={sourceFields} busy={busy} onCreate={create} />

          {estimate && (
            <p className="text-xs text-muted-foreground">
              {estimate.isEstimateAvailable && estimate.estimatedCount !== null
                ? `${estimate.estimatedCount} enregistrement(s) sur ${estimate.totalCount ?? "?"} seront migrés.${estimate.message ? ` ${estimate.message}` : ""}`
                : (estimate.message ?? "Estimation indisponible.")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
