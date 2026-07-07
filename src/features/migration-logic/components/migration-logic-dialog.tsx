"use client";

// Conteneur autonome du modal de logique : charge le contexte + la logique
// existante, gère enregistrer/valider/classifier. La page appelante n'a qu'à
// fournir planId + fieldMappingId et recharger à la fermeture après sauvegarde.

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MigrationLogicDTO } from "../migration-logic-service";
import type { ClassifyResult } from "../classify-service";
import {
  MigrationLogicModal,
  type MigrationLogicModalContext,
  type SaveLogicInput,
} from "./migration-logic-modal";

export function MigrationLogicDialog({
  planId,
  fieldMappingId,
  onClose,
  onSaved,
}: {
  planId: string;
  fieldMappingId: string;
  onClose: () => void;
  /** Appelé après un enregistrement réussi (recharge des linkStatus). */
  onSaved: () => void;
}) {
  const [context, setContext] = useState<MigrationLogicModalContext | null>(null);
  const [migrationLogic, setMigrationLogic] = useState<MigrationLogicDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const base = `/api/plans/${planId}/field-mappings/${fieldMappingId}`;

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${base}/migration-logic`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoadError(body.error ?? "Erreur de chargement de la logique");
        return;
      }
      const data = await res.json();
      setContext(data.context);
      setMigrationLogic(data.migrationLogic);
    })();
  }, [base]);

  async function persist(input: SaveLogicInput, status: "DEFINED" | "VALIDATED") {
    setSaving(true);
    const res = await fetch(`${base}/migration-logic`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, status }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error ?? "L'enregistrement a échoué" };
    }
    onSaved();
    return {};
  }

  async function classify(promptText: string): Promise<{ results: ClassifyResult[]; error?: string }> {
    const res = await fetch(`${base}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptText }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { results: [], error: body.error ?? "La classification a échoué" };
    }
    return res.json();
  }

  // Chargement / erreur : dialog minimal (le modal complet ne se monte
  // qu'avec ses données, pour que ses états initiaux soient corrects).
  if (!context) {
    return (
      <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>Logique de migration</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[120px] items-center justify-center text-sm">
            {loadError ? (
              <span className="text-destructive">{loadError}</span>
            ) : (
              <span className="text-muted-foreground">Chargement…</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <MigrationLogicModal
      context={context}
      migrationLogic={migrationLogic}
      saving={saving}
      onClose={onClose}
      onSave={(input) => persist(input, "DEFINED")}
      onValidate={(input) => persist(input, "VALIDATED")}
      onClassify={classify}
    />
  );
}
