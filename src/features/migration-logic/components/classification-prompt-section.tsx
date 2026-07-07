"use client";

// Section D2 : prompt de classification (texte → picklist).
// Textarea + tableau d'aperçu de classification (debounce 1 s). Porté de v4.

import { useState, useEffect, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { ClassifyResult } from "../classify-service";

const DEFAULT_PLACEHOLDER = "Classifie ce texte dans une des catégories suivantes";

export function ClassificationPromptSection({
  destinationValues,
  sampleSourceValues,
  initialPromptText,
  onPromptChange,
  onClassify,
}: {
  destinationValues: string[];
  sampleSourceValues: string[];
  initialPromptText: string;
  onPromptChange: (text: string) => void;
  onClassify: (promptText: string) => Promise<{ results: ClassifyResult[]; error?: string }>;
}) {
  const [promptText, setPromptText] = useState(initialPromptText);
  const [classifications, setClassifications] = useState<ClassifyResult[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSamples = sampleSourceValues.length > 0;

  const runClassification = useCallback(
    async (text: string) => {
      if (!hasSamples || destinationValues.length === 0) return;
      setClassifying(true);
      setClassifyError("");
      const result = await onClassify(text);
      setClassifying(false);
      if (result.error && result.results.length === 0) {
        setClassifyError(result.error);
        return;
      }
      setClassifications(result.results);
    },
    [hasSamples, destinationValues, onClassify],
  );

  // Classification initiale au premier affichage.
  useEffect(() => {
    if (hasSamples) void runClassification(initialPromptText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setPromptText(text);
    onPromptChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runClassification(text), 1000);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Prompt de classification
        </label>
        <Textarea
          value={promptText}
          onChange={handleChange}
          placeholder={DEFAULT_PLACEHOLDER}
          rows={3}
          className="resize-none"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Exemples de classification
          {classifying && (
            <span className="ml-2 animate-pulse font-normal text-primary">
              Classification en cours…
            </span>
          )}
        </p>

        {!hasSamples ? (
          <div className="rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Les exemples arriveront avec l&apos;aperçu des enregistrements source.
          </div>
        ) : classifyError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {classifyError}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Valeur source
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Classification
                  </th>
                </tr>
              </thead>
              <tbody>
                {sampleSourceValues.map((val, idx) => {
                  const result = classifications.find((c) => c.sourceValue === val);
                  const classified = result?.classifiedValue ?? (classifying ? "…" : null);
                  return (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="max-w-[200px] truncate px-3 py-2">{val}</td>
                      <td className="px-3 py-2">
                        {result?.error && !result.classifiedValue ? (
                          <span className="text-xs text-amber-600">{result.error}</span>
                        ) : classified ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {classified}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Catégories : {destinationValues.map((v) => `« ${v} »`).join(", ")}
      </p>
    </div>
  );
}
