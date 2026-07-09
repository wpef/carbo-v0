"use client";

// Aperçu des enregistrements réels d'un objet + taux de remplissage par champ
// (05-acceptance §4). Back déjà en place : route /records + computeFieldStats
// (client). Chargé à l'ouverture seulement.

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { computeFieldStats } from "@/features/schema/lib/compute-field-stats";
import { ChevronDown, ChevronRight, Table2 } from "lucide-react";

type Side = "source" | "destination";
type Field = { apiName: string; label: string };

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "vrai" : "faux";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function RecordPreview({
  planId,
  side,
  objectApiName,
  fields,
}: {
  planId: string;
  side: Side;
  objectApiName: string;
  fields: Field[];
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/plans/${planId}/${side}/records/${encodeURIComponent(objectApiName)}?page=${page}&pageSize=25`,
    );
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Aperçu indisponible.");
      setRecords([]);
      return;
    }
    setRecords(body.records ?? []);
    setTotal(body.totalCount ?? 0);
    setHasNext(Boolean(body.hasNextPage));
  }, [planId, side, objectApiName, page]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Taux de remplissage par champ (sur la page courante) — nullCount -1 = binaire.
  const statByField = new Map(computeFieldStats(records).map((s) => [s.fieldApiName, s]));
  const fillRate = (apiName: string): string => {
    const s = statByField.get(apiName);
    if (!s || records.length === 0) return "—";
    if (s.nullCount < 0) return "N/A";
    return `${Math.round(((records.length - s.nullCount) / records.length) * 100)}%`;
  };

  return (
    <div className="border-t">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Table2 className="size-3.5" />
        Aperçu des données{total > 0 ? ` (${total} enregistrements)` : ""}
      </button>

      {open && (
        <div className="px-4 pb-3">
          {loading ? (
            <p className="animate-pulse py-2 text-xs text-muted-foreground">Chargement…</p>
          ) : error ? (
            <p className="py-2 text-xs text-muted-foreground italic">{error}</p>
          ) : records.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">Aucun enregistrement.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {fields.map((f) => (
                        <th key={f.apiName} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                          {f.label}
                          <div className="font-normal text-[10px] text-muted-foreground">
                            rempli {fillRate(f.apiName)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {fields.map((f) => (
                          <td key={f.apiName} className="max-w-[220px] truncate px-2 py-1 font-mono">
                            {formatCell(rec[f.apiName])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Précédent
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant →
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
