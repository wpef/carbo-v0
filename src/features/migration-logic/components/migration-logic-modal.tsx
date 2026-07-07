"use client";

// Modal de logique de migration — en-tête 2 colonnes (source | destination)
// + section selon le type (D1–D4) + pied Annuler / Enregistrer / Valider.
// Porté de v4. Enregistrer → DEFINED (orange) ; Valider → VALIDATED (vert) ;
// D3 : validation désactivée ; D4 : validation directe (copie informative).

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ValueEquivalenceSection } from "./value-equivalence-section";
import { ClassificationPromptSection } from "./classification-prompt-section";
import type { MigrationLogicDTO, SectionType } from "../migration-logic-service";
import type { ClassifyResult } from "../classify-service";

export interface MigrationLogicModalContext {
  sourceField: { name: string; label: string; type: string };
  destinationField: { name: string; label: string; type: string };
  sectionType: SectionType;
  sourcePicklistValues: string[];
  destPicklistValues: string[];
  sampleSourceValues: string[];
  informationalMessage: string | null;
}

export interface SaveLogicInput {
  sectionType: SectionType;
  valueEquivalences?: { sourceValue: string; destinationValue: string }[];
  promptText?: string;
}

const TYPE_LABELS: Record<string, string> = {
  text: "Texte",
  string: "Texte",
  number: "Nombre",
  date: "Date",
  datetime: "Date/heure",
  picklist: "Picklist",
  multipicklist: "Multi-picklist",
  boolean: "Case à cocher",
  checkbox: "Case à cocher",
};

export function MigrationLogicModal({
  context,
  migrationLogic,
  saving,
  onClose,
  onSave,
  onValidate,
  onClassify,
}: {
  context: MigrationLogicModalContext;
  migrationLogic: MigrationLogicDTO | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: SaveLogicInput) => Promise<{ error?: string }>;
  onValidate: (input: SaveLogicInput) => Promise<{ error?: string }>;
  onClassify: (promptText: string) => Promise<{ results: ClassifyResult[]; error?: string }>;
}) {
  const { sectionType } = context;
  const [equivalences, setEquivalences] = useState<
    { sourceValue: string; destinationValue: string }[]
  >([]);
  const [promptText, setPromptText] = useState(
    migrationLogic?.classificationPrompt?.promptText ?? "",
  );
  const [actionError, setActionError] = useState("");

  const handleEquivalencesChange = useCallback(
    (equivs: { sourceValue: string; destinationValue: string }[]) => setEquivalences(equivs),
    [],
  );
  const handlePromptChange = useCallback((text: string) => setPromptText(text), []);

  function buildInput(): SaveLogicInput {
    return {
      sectionType,
      ...(sectionType === "VALUE_EQUIVALENCE" ? { valueEquivalences: equivalences } : {}),
      ...(sectionType === "PROMPT" ? { promptText } : {}),
    };
  }

  async function run(action: (input: SaveLogicInput) => Promise<{ error?: string }>) {
    setActionError("");
    const result = await action(buildInput());
    if (result.error) setActionError(result.error);
    else onClose();
  }

  const isError = sectionType === "ERROR";
  const isInformational = sectionType === "INFORMATIONAL";
  const typeLabel = (t: string) => TYPE_LABELS[t.toLowerCase()] ?? t;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>Logique de migration</DialogTitle>
          <div className="mt-2 grid grid-cols-2 gap-4 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="mb-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Source
              </p>
              <p className="text-sm font-medium">{context.sourceField.label}</p>
              <p className="text-xs text-muted-foreground">{typeLabel(context.sourceField.type)}</p>
            </div>
            <div>
              <p className="mb-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Destination
              </p>
              <p className="text-sm font-medium">{context.destinationField.label}</p>
              <p className="text-xs text-muted-foreground">
                {typeLabel(context.destinationField.type)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-[200px] py-2">
          {sectionType === "VALUE_EQUIVALENCE" ? (
            <ValueEquivalenceSection
              sourceValues={context.sourcePicklistValues}
              destinationValues={context.destPicklistValues}
              initialEquivalences={migrationLogic?.valueEquivalences ?? []}
              onChange={handleEquivalencesChange}
            />
          ) : sectionType === "PROMPT" ? (
            <ClassificationPromptSection
              destinationValues={context.destPicklistValues}
              sampleSourceValues={context.sampleSourceValues}
              initialPromptText={migrationLogic?.classificationPrompt?.promptText ?? ""}
              onPromptChange={handlePromptChange}
              onClassify={onClassify}
            />
          ) : sectionType === "ERROR" ? (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-5 text-sm text-red-800">
              <p className="mb-2 font-semibold">
                Ces types de champs ne peuvent pas être liés directement.
              </p>
              <p>
                Nous ne pouvons pas lier ces deux types de champs actuellement. Un CSV contenant
                les IDs de la destination et les valeurs de la source pour ce champ vous sera
                fourni pour mise à jour manuelle après la migration.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-gray-300 bg-gray-50 p-5 text-sm text-gray-700">
              <p className="mb-1 font-semibold">Aucune transformation nécessaire</p>
              <p>{context.informationalMessage ?? "La valeur sera copiée."}</p>
            </div>
          )}
        </div>

        {actionError && <p className="-mt-2 text-sm text-destructive">{actionError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          {!isError && !isInformational && (
            <Button variant="outline" onClick={() => run(onSave)} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          )}
          <Button onClick={() => run(onValidate)} disabled={saving || isError}>
            {saving ? "Validation…" : "Valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
