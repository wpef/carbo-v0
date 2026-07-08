"use client";

// État + actions de la couverture d'une paire (rapport + exclusions).

import { useCallback, useEffect, useState } from "react";
import type { UnmappedFieldsReport } from "../lib/compute-unmapped";

export function useCoverage(planId: string, mappingId: string) {
  const [report, setReport] = useState<UnmappedFieldsReport | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/plans/${planId}/object-mappings/${mappingId}`;

  const load = useCallback(async () => {
    const res = await fetch(`${base}/coverage`);
    if (res.ok) setReport(await res.json());
  }, [base]);

  useEffect(() => {
    setReport(null);
    void load();
  }, [load]);

  async function exclude(sourceFieldName: string, reason: string | null) {
    setBusy(true);
    await fetch(`${base}/exclusions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceFieldName, reason }),
    });
    await load();
    setBusy(false);
  }

  async function reinstate(sourceFieldName: string) {
    setBusy(true);
    await fetch(`${base}/exclusions?sourceFieldName=${encodeURIComponent(sourceFieldName)}`, {
      method: "DELETE",
    });
    await load();
    setBusy(false);
  }

  return { report, busy, reload: load, exclude, reinstate };
}
