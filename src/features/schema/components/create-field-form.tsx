"use client";

// Création d'un champ manquant côté destination (§13). Visible seulement si le
// connecteur destination supporte l'écriture de schéma.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

export function CreateFieldForm({
  planId,
  objectApiName,
  supportedFieldTypes,
  onCreated,
}: {
  planId: string;
  objectApiName: string;
  supportedFieldTypes: string[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [apiName, setApiName] = useState("");
  const [label, setLabel] = useState("");
  const [dataType, setDataType] = useState(supportedFieldTypes[0] ?? "string");
  const [picklist, setPicklist] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/plans/${planId}/destination/schema-write/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectApiName,
        apiName: apiName.trim(),
        label: label.trim() || apiName.trim(),
        dataType,
        picklistValues:
          dataType === "picklist"
            ? picklist.split(",").map((v) => v.trim()).filter(Boolean)
            : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "La création a échoué.");
      return;
    }
    setApiName("");
    setLabel("");
    setPicklist("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 border-t px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" /> Créer un champ
      </button>
    );
  }

  const selectClass =
    "h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

  return (
    <form onSubmit={submit} className="space-y-2 border-t bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Nom d'API du champ"
          value={apiName}
          onChange={(e) => setApiName(e.target.value)}
          placeholder="nom_api"
          className="h-8 w-36"
        />
        <Input
          aria-label="Libellé du champ"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Libellé"
          className="h-8 w-36"
        />
        <select
          aria-label="Type du champ"
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          className={selectClass}
        >
          {supportedFieldTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {dataType === "picklist" && (
          <Input
            aria-label="Valeurs de la picklist"
            value={picklist}
            onChange={(e) => setPicklist(e.target.value)}
            placeholder="valeur1, valeur2…"
            className="h-8 w-44"
          />
        )}
        <Button type="submit" size="sm" disabled={busy || apiName.trim() === ""}>
          Créer
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
