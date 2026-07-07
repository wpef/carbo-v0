"use client";

// Formulaire d'ajout de filtre : champ source + opérateur + valeur.
// La valeur disparaît pour IS_NULL ; input date pour DATE_AFTER/DATE_BEFORE.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATE_OPERATORS, FILTER_OPERATORS, getOperatorMeta } from "../lib/filter-operators";
import type { FilterOperator } from "../types";
import { Plus } from "lucide-react";

export function FilterForm({
  sourceFields,
  busy,
  onCreate,
}: {
  sourceFields: { apiName: string; label: string; dataType: string }[];
  busy: boolean;
  onCreate: (input: { fieldApiName: string; operator: string; value?: string }) => Promise<boolean>;
}) {
  const [fieldApiName, setFieldApiName] = useState("");
  const [operator, setOperator] = useState<FilterOperator>("EQUALS");
  const [value, setValue] = useState("");

  const needsValue = getOperatorMeta(operator)?.needsValue ?? true;
  const isDateOperator = DATE_OPERATORS.has(operator);
  const canSubmit = fieldApiName !== "" && (!needsValue || value.trim() !== "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await onCreate({
      fieldApiName,
      operator,
      ...(needsValue ? { value: value.trim() } : {}),
    });
    if (ok) {
      setFieldApiName("");
      setOperator("EQUALS");
      setValue("");
    }
  }

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Champ à filtrer"
        value={fieldApiName}
        onChange={(e) => setFieldApiName(e.target.value)}
        className={selectClass}
      >
        <option value="">Champ…</option>
        {sourceFields.map((f) => (
          <option key={f.apiName} value={f.apiName}>
            {f.label} ({f.apiName})
          </option>
        ))}
      </select>
      <select
        aria-label="Opérateur"
        value={operator}
        onChange={(e) => setOperator(e.target.value as FilterOperator)}
        className={selectClass}
      >
        {FILTER_OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {needsValue && (
        <Input
          aria-label="Valeur du filtre"
          type={isDateOperator ? "date" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isDateOperator ? "AAAA-MM-JJ" : "Valeur"}
          className="h-9 w-44"
        />
      )}
      <Button type="submit" size="sm" disabled={busy || !canSubmit}>
        <Plus className="size-3.5" /> Ajouter le filtre
      </Button>
    </form>
  );
}
