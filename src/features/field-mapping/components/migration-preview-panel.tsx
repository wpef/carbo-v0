"use client";

// Aperçu de migration avant/après (02-domain-rules règle 10) — porté de v4.
// Charge une page d'enregistrements source réels et projette l'objet
// destination en appliquant, CÔTÉ CLIENT, les équivalences de valeurs D1
// portées par les mappings. Aperçu non critique : une erreur d'aperçu
// n'interrompt jamais le mapping (message discret, pas de crash).

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import { applyMappings, type PreviewFieldMapping } from "../lib/apply-mappings";

type FieldMappingItem = PreviewFieldMapping & {
  id: string;
  sourceFieldLabel: string;
  destinationFieldLabel: string;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "vrai" : "faux";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function recordLabel(record: Record<string, unknown>, index: number): string {
  const textValues = Object.values(record)
    .filter((v) => typeof v === "string" && v.length > 0 && v.length < 60)
    .slice(0, 2);
  return textValues.length > 0 ? textValues.join(" · ") : `Enregistrement ${index + 1}`;
}

export function MigrationPreviewPanel({
  planId,
  sourceObjectApiName,
  sourceObjectLabel,
  destinationObjectLabel,
  fieldMappings,
}: {
  planId: string;
  sourceObjectApiName: string;
  sourceObjectLabel: string;
  destinationObjectLabel: string;
  fieldMappings: FieldMappingItem[];
}) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/plans/${planId}/source/records/${encodeURIComponent(sourceObjectApiName)}?page=1&pageSize=25`,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Aperçu indisponible.");
      setRecords(body.records ?? []);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aperçu indisponible.");
      setRecords([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [planId, sourceObjectApiName]);

  // Chargement paresseux : on ne récupère les records qu'à l'ouverture.
  useEffect(() => {
    if (open && !loaded) void fetchRecords();
  }, [open, loaded, fetchRecords]);

  const sourceRecord = records[selectedIndex] ?? null;
  const destRecord = sourceRecord ? applyMappings(sourceRecord, fieldMappings) : null;

  return (
    <section className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <Eye className="size-3.5" />
        Aperçu de migration
        <span className="text-xs font-normal text-muted-foreground">
          {sourceObjectLabel} → {destinationObjectLabel}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t px-3 py-3">
          {fieldMappings.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Mappez au moins un champ pour voir l&apos;aperçu.
            </p>
          ) : loading ? (
            <p className="animate-pulse text-xs text-muted-foreground">Chargement des enregistrements…</p>
          ) : error ? (
            <p className="text-xs text-muted-foreground italic">{error}</p>
          ) : records.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun enregistrement source disponible.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label htmlFor="preview-record" className="text-xs text-muted-foreground">
                  Enregistrement source
                </label>
                <select
                  id="preview-record"
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(Number(e.target.value))}
                  className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {records.map((rec, i) => (
                    <option key={i} value={i}>
                      {recordLabel(rec, i)}
                    </option>
                  ))}
                </select>
              </div>

              {sourceRecord && destRecord && (
                <div className="grid grid-cols-2 divide-x overflow-hidden rounded-md border text-xs">
                  <div>
                    <div className="border-b bg-muted/30 px-2 py-1.5 font-semibold text-muted-foreground">
                      {sourceObjectLabel}
                    </div>
                    {fieldMappings.map((m, i) => (
                      <div key={m.id} className={i > 0 ? "border-t px-2 py-1.5" : "px-2 py-1.5"}>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {m.sourceFieldLabel}
                        </div>
                        <div className="truncate font-mono">
                          {formatValue(sourceRecord[m.sourceFieldName])}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="border-b bg-muted/30 px-2 py-1.5 font-semibold text-muted-foreground">
                      {destinationObjectLabel}
                    </div>
                    {fieldMappings.map((m, i) => {
                      const srcVal = sourceRecord[m.sourceFieldName];
                      const dstVal = destRecord[m.destinationFieldName];
                      const changed = String(srcVal ?? "") !== String(dstVal ?? "");
                      return (
                        <div
                          key={m.id}
                          className={`${i > 0 ? "border-t " : ""}px-2 py-1.5 ${changed ? "bg-amber-50" : ""}`}
                        >
                          <div className="truncate text-[11px] text-muted-foreground">
                            {m.destinationFieldLabel}
                          </div>
                          <div
                            className={`truncate font-mono ${changed ? "font-semibold text-amber-700" : ""}`}
                          >
                            {formatValue(dstVal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="px-1 py-0 text-[10px]">
                  local
                </Badge>
                Aperçu calculé côté client : seules les équivalences de valeurs sont appliquées.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
