"use client";

// Section D1 : équivalences de valeurs (picklist→picklist / boolean→picklist).
// Liage clic-clic entre valeurs source et destination, courbes SVG pour les
// paires liées. Auto-lie les correspondances exactes (insensible à la casse)
// au premier affichage. Porté de v4.

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";

interface EquivPair {
  sourceValue: string;
  destinationValue: string;
}

interface ItemPosition {
  value: string;
  centerY: number;
}

export function ValueEquivalenceSection({
  sourceValues,
  destinationValues,
  initialEquivalences,
  onChange,
}: {
  sourceValues: string[];
  destinationValues: string[];
  initialEquivalences: EquivPair[];
  onChange: (equivalences: EquivPair[]) => void;
}) {
  const [equivalences, setEquivalences] = useState<EquivPair[]>(() => {
    if (initialEquivalences.length > 0) return initialEquivalences;
    // Auto-liage des correspondances exactes, insensible à la casse.
    const autoLinked: EquivPair[] = [];
    for (const sv of sourceValues) {
      const match = destinationValues.find((dv) => dv.toLowerCase() === sv.toLowerCase());
      if (match) autoLinked.push({ sourceValue: sv, destinationValue: match });
    }
    return autoLinked;
  });

  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const sourceColRef = useRef<HTMLDivElement>(null);
  const destColRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [sourcePositions, setSourcePositions] = useState<ItemPosition[]>([]);
  const [destPositions, setDestPositions] = useState<ItemPosition[]>([]);
  const [svgHeight, setSvgHeight] = useState(200);

  useEffect(() => {
    onChange(equivalences);
  }, [equivalences, onChange]);

  const updatePositions = useCallback(() => {
    if (!sourceColRef.current || !destColRef.current || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    setSvgHeight(Math.max(svgRect.height, 100));

    const collect = (col: HTMLDivElement): ItemPosition[] =>
      Array.from(col.querySelectorAll<HTMLElement>("[data-value]")).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          value: el.getAttribute("data-value") ?? "",
          centerY: rect.top + rect.height / 2 - svgRect.top,
        };
      });
    setSourcePositions(collect(sourceColRef.current));
    setDestPositions(collect(destColRef.current));
  }, []);

  useLayoutEffect(() => {
    updatePositions();
    const observer = new ResizeObserver(updatePositions);
    if (sourceColRef.current) observer.observe(sourceColRef.current);
    if (destColRef.current) observer.observe(destColRef.current);
    return () => observer.disconnect();
  }, [sourceValues, destinationValues, equivalences, updatePositions]);

  function linkTo(destValue: string) {
    if (!selectedSource) return;
    setEquivalences((prev) => [
      ...prev.filter((e) => e.sourceValue !== selectedSource),
      { sourceValue: selectedSource, destinationValue: destValue },
    ]);
    setSelectedSource(null);
  }

  const equivBySrc = new Map(equivalences.map((e) => [e.sourceValue, e.destinationValue]));
  const unlinkedCount = sourceValues.length - equivalences.length;

  return (
    <div className="space-y-2">
      {selectedSource && (
        <p className="rounded border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary">
          Valeur source <strong>« {selectedSource} »</strong> sélectionnée. Cliquez sur une valeur
          destination pour la lier.{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => setSelectedSource(null)}
          >
            Annuler
          </button>
        </p>
      )}

      <div className="relative grid min-h-[200px] grid-cols-[1fr_60px_1fr] gap-0">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Valeurs source
          </p>
          <div ref={sourceColRef} className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {sourceValues.map((val) => {
              const isMapped = equivBySrc.has(val);
              const isSelected = selectedSource === val;
              return (
                <div
                  key={val}
                  data-value={val}
                  onClick={() => setSelectedSource((prev) => (prev === val ? null : val))}
                  className={[
                    "flex cursor-pointer items-center justify-between rounded border px-3 py-1.5 text-sm select-none",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : isMapped
                        ? "border-green-300 bg-green-50 text-green-800"
                        : "border-border hover:border-primary/40 hover:bg-muted/30",
                  ].join(" ")}
                >
                  <span className="truncate">{val}</span>
                  {isMapped && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEquivalences((prev) => prev.filter((eq) => eq.sourceValue !== val));
                      }}
                      className="ml-2 shrink-0 text-xs text-muted-foreground hover:text-destructive"
                      aria-label={`Supprimer le lien pour ${val}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {sourceValues.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Aucune valeur source disponible.
              </p>
            )}
          </div>
        </div>

        {/* Pont SVG entre les colonnes */}
        <div className="relative">
          <svg
            ref={svgRef}
            className="pointer-events-none absolute inset-0 w-full overflow-visible"
            style={{ height: svgHeight }}
          >
            {equivalences.map((e) => {
              const srcPos = sourcePositions.find((p) => p.value === e.sourceValue);
              const dstPos = destPositions.find((p) => p.value === e.destinationValue);
              if (!srcPos || !dstPos) return null;
              const path = `M 0 ${srcPos.centerY} C 21 ${srcPos.centerY}, 39 ${dstPos.centerY}, 60 ${dstPos.centerY}`;
              return (
                <path
                  key={e.sourceValue}
                  d={path}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeOpacity={0.8}
                />
              );
            })}
          </svg>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Valeurs destination
          </p>
          <div ref={destColRef} className="max-h-72 space-y-1 overflow-y-auto pl-1">
            {destinationValues.map((val) => {
              const isMappedTo = equivalences.some((e) => e.destinationValue === val);
              return (
                <div
                  key={val}
                  data-value={val}
                  onClick={() => linkTo(val)}
                  className={[
                    "rounded border px-3 py-1.5 text-sm select-none",
                    selectedSource
                      ? "cursor-pointer hover:border-primary/40 hover:bg-muted/30"
                      : "cursor-default",
                    isMappedTo ? "border-green-300 bg-green-50 text-green-800" : "border-border",
                  ].join(" ")}
                >
                  <span className="truncate">{val}</span>
                </div>
              );
            })}
            {destinationValues.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Aucune valeur destination disponible.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {equivalences.length} / {sourceValues.length} valeurs liées.
        {unlinkedCount > 0 && <span className="ml-1 text-amber-600">{unlinkedCount} non liée(s).</span>}
      </p>
    </div>
  );
}
