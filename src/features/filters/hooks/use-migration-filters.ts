"use client";

// État et actions des filtres d'une paire d'objets. Les composants du
// panneau ne font que rendre ; toute la logique vit ici.

import { useCallback, useEffect, useState } from "react";
import type { CreateFilterInput, FilterEstimate, FilterItem } from "../types";

export function useMigrationFilters(planId: string, mappingId: string) {
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [estimate, setEstimate] = useState<FilterEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/plans/${planId}/object-mappings/${mappingId}/filters`;

  const loadEstimate = useCallback(async () => {
    const res = await fetch(`${base}/estimate`);
    if (res.ok) setEstimate(await res.json());
  }, [base]);

  const load = useCallback(async () => {
    const res = await fetch(base);
    if (!res.ok) return;
    const data = await res.json();
    setFilters(data.filters);
    void loadEstimate();
  }, [base, loadEstimate]);

  useEffect(() => {
    setFilters([]);
    setEstimate(null);
    setError(null);
    void load();
  }, [load]);

  async function create(input: CreateFilterInput): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "La création du filtre a échoué");
      return false;
    }
    await load();
    return true;
  }

  async function toggle(filter: FilterItem) {
    setError(null);
    const res = await fetch(`${base}/${filter.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !filter.isActive }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "La mise à jour du filtre a échoué");
    }
    await load();
  }

  async function remove(filterId: string) {
    setError(null);
    await fetch(`${base}/${filterId}`, { method: "DELETE" });
    await load();
  }

  return { filters, estimate, error, busy, create, toggle, remove };
}
