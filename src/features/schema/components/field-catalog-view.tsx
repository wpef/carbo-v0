"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RecordPreview } from "./record-preview";

export type FieldCatalog = {
  groups: {
    objectApiName: string;
    objectLabel: string;
    fields: {
      apiName: string;
      label: string;
      dataType: string;
      isRequired: boolean;
      isReadOnly: boolean;
      isUnique: boolean;
      isAccessible: boolean;
    }[];
  }[];
  totalFields: number;
  inaccessibleCount: number;
};

/** Accordéon objets → champs (+ aperçu des données), partagé source/destination. */
export function FieldCatalogView({
  catalog,
  planId,
  side,
}: {
  catalog: FieldCatalog;
  planId: string;
  side: "source" | "destination";
}) {
  // Ouvert par défaut : la raison d'être de l'écran est de VOIR les champs
  // (revue UX v5) — le repli reste disponible objet par objet.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(catalog.groups.map((g) => g.objectApiName)),
  );

  function toggle(apiName: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(apiName)) next.delete(apiName);
      else next.add(apiName);
      return next;
    });
  }

  return (
    <ul className="space-y-2">
      {catalog.groups.map((group) => {
        const isOpen = open.has(group.objectApiName);
        return (
          <li key={group.objectApiName} className="rounded-md border">
            <button
              onClick={() => toggle(group.objectApiName)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              <span className="font-medium">{group.objectLabel}</span>
              <span className="text-xs text-muted-foreground">({group.objectApiName})</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {group.fields.length} champs
              </span>
            </button>
            {isOpen && (
              <ul className="divide-y border-t">
                {group.fields.map((field) => (
                  <li key={field.apiName} className="flex items-center gap-2 px-4 py-1.5 text-sm">
                    <span>{field.label}</span>
                    <span className="text-xs text-muted-foreground">{field.apiName}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {field.isRequired && <Badge variant="outline">requis</Badge>}
                      {field.isReadOnly && <Badge variant="outline">lecture seule</Badge>}
                      {field.isUnique && <Badge variant="outline">unique</Badge>}
                      {!field.isAccessible && <Badge variant="destructive">inaccessible</Badge>}
                      <Badge variant="secondary">{field.dataType}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {isOpen && (
              <RecordPreview
                planId={planId}
                side={side}
                objectApiName={group.objectApiName}
                fields={group.fields}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
