"use client";

// Bannière de drift (§11 c11) : visible si le schéma a changé depuis le
// dernier refresh (comparaison PREVIOUS→CURRENT). Informe le consultant que
// des objets/champs ont été ajoutés, supprimés ou modifiés côté CRM.

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type DriftChange = {
  type: string;
  objectApiName: string;
  fieldApiName?: string;
  severity: "info" | "warning" | "critical";
  role: "source" | "destination";
};

const LABELS: Record<string, string> = {
  OBJECT_ADDED: "objet ajouté",
  OBJECT_REMOVED: "objet supprimé",
  FIELD_ADDED: "champ ajouté",
  FIELD_REMOVED: "champ supprimé",
  FIELD_TYPE_CHANGED: "type modifié",
  FIELD_BECAME_REQUIRED: "devenu requis",
  FIELD_BECAME_OPTIONAL: "devenu optionnel",
};

export function DriftBanner({ planId }: { planId: string }) {
  const [changes, setChanges] = useState<DriftChange[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/plans/${planId}/drift`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "drift") setChanges(data.changes);
      }
    })();
  }, [planId]);

  if (changes.length === 0) return null;

  return (
    <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" />
        Le schéma a changé depuis le dernier import — {changes.length} modification(s)
      </p>
      <ul className="ml-6 list-disc space-y-0.5">
        {changes.slice(0, 8).map((c, i) => (
          <li key={i}>
            [{c.role === "source" ? "source" : "destination"}] {LABELS[c.type] ?? c.type} :{" "}
            {c.objectApiName}
            {c.fieldApiName ? `.${c.fieldApiName}` : ""}
          </li>
        ))}
        {changes.length > 8 && <li>… et {changes.length - 8} autre(s)</li>}
      </ul>
    </div>
  );
}
