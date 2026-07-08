"use client";

// Panneau de couverture d'une paire (02-domain-rules règle 7) : ce qui reste
// à traiter côté source (mapper ou exclure) et les champs requis destination
// non mappés. Repliable ; l'exclusion documente une décision consultante.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCoverage } from "../hooks/use-coverage";
import { ChevronDown, ChevronRight, ListChecks, RotateCcw } from "lucide-react";

export function CoveragePanel({
  planId,
  mappingId,
  sourceObjectLabel,
}: {
  planId: string;
  mappingId: string;
  sourceObjectLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const { report, busy, exclude, reinstate } = useCoverage(planId, mappingId);

  return (
    <section className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <ListChecks className="size-3.5" />
        Couverture — {sourceObjectLabel}
        {report && (
          <Badge
            variant={report.isComplete ? "secondary" : "outline"}
            className={report.isComplete ? "ml-1 border-green-300 bg-green-50 text-green-800" : "ml-1"}
          >
            source {report.sourceCoverage}% · requis destination {report.destinationRequiredCoverage}%
          </Badge>
        )}
      </button>

      {open && report && (
        <div className="space-y-4 border-t px-3 py-3">
          {report.unmappedRequiredDestFields.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-amber-700">
                Champs requis destination non mappés ({report.unmappedRequiredDestFields.length})
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {report.unmappedRequiredDestFields.map((f) => (
                  <li key={f.apiName}>
                    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">
                      {f.label} ({f.apiName})
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Champs source ni mappés ni exclus ({report.unmappedSourceFields.length})
            </p>
            {report.unmappedSourceFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tous les champs source sont traités.</p>
            ) : (
              <ul className="space-y-1">
                {report.unmappedSourceFields.map((f) => (
                  <li
                    key={f.apiName}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <span>
                      {f.label} <span className="text-xs text-muted-foreground">({f.apiName})</span>
                    </span>
                    <Badge variant="secondary" className="ml-auto">
                      {f.dataType}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => exclude(f.apiName, null)}
                      aria-label={`Exclure ${f.apiName}`}
                    >
                      Exclure
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {report.excludedSourceFields.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Champs exclus du périmètre ({report.excludedSourceFields.length})
              </p>
              <ul className="space-y-1">
                {report.excludedSourceFields.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground"
                  >
                    <span>{e.sourceFieldName}</span>
                    {e.reason && <span className="text-xs italic">« {e.reason} »</span>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={busy}
                      onClick={() => reinstate(e.sourceFieldName)}
                      aria-label={`Réintégrer ${e.sourceFieldName}`}
                    >
                      <RotateCcw className="size-3.5" /> Réintégrer
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
