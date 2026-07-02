"use client";

// Le stepper — la pièce d'assemblage centrale du parcours guidé.
// Règles normatives : docs/foundation/01-journeys.md §3.3 (révisées v5).
//
// - Gating high-water-mark : reachedIdx = max(currentStep persisté, étape de
//   la page ouverte). Étapes ≤ reachedIdx cliquables ; au-delà verrouillées.
// - Persistance du high-water-mark : si la page ouverte est EN AVANCE sur
//   currentStep, on PATCHe /step (une fois par étape, erreurs avalées — le
//   serveur valide les prérequis, donc pas d'avancement mensonger) pour que
//   la navigation arrière ne reverrouille jamais l'avant.
// - Décision revue v5 : PAS de bouton « Étape suivante » ici. L'avancement
//   passe par les CTA de page (validés, qui affichent les refus) — un
//   second chemin muet contredisait les CTA et avalait les refus de gate.
//   La sidebar est une navigation de consultation et de retour.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PlanStep } from "@prisma/client";
import {
  PLAN_STEPS,
  STEP_LABELS,
  STEP_PATHS,
  stepForPathname,
  stepIndex,
} from "@/features/plans/lib/steps";
import { recordStep } from "@/features/plans/lib/record-step";
import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";

export function StepSidebar({
  planId,
  currentStep,
}: {
  planId: string;
  currentStep: PlanStep;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeStep = stepForPathname(pathname);
  const activeIdx = activeStep ? stepIndex(activeStep) : -1;
  const currentIdx = stepIndex(currentStep);
  const reachedIdx = Math.max(currentIdx, activeIdx);

  // Persistance du high-water-mark (une tentative par étape active).
  const patchedRef = useRef<string | null>(null);
  const [persistedIdx, setPersistedIdx] = useState(currentIdx);
  useEffect(() => {
    setPersistedIdx((prev) => Math.max(prev, currentIdx));
  }, [currentIdx]);
  useEffect(() => {
    if (!activeStep) return;
    if (activeIdx > persistedIdx && patchedRef.current !== activeStep) {
      patchedRef.current = activeStep;
      void recordStep(planId, activeStep).then((r) => {
        if (r.ok) {
          setPersistedIdx((prev) => Math.max(prev, activeIdx));
          router.refresh();
        }
      });
    }
  }, [activeStep, activeIdx, persistedIdx, planId, router]);

  return (
    <nav
      aria-label="Étapes du plan"
      className="flex w-56 shrink-0 flex-col border-r bg-muted/30"
    >
      <ol className="flex-1 space-y-1 p-3">
        {PLAN_STEPS.map((step, idx) => {
          const reachable = idx <= reachedIdx;
          const isActive = step === activeStep;
          const isDone = idx < reachedIdx;
          const content = (
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px] font-medium",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isDone && !isActive && "border-primary/40 bg-primary/10 text-primary",
                  !reachable && "border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {isDone ? <Check className="size-3" /> : !reachable ? <Lock className="size-2.5" /> : idx + 1}
              </span>
              {STEP_LABELS[step]}
            </span>
          );
          return (
            <li key={step}>
              {reachable ? (
                <Link
                  href={`/plans/${planId}${STEP_PATHS[step]}`}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                    isActive && "bg-muted font-medium",
                  )}
                >
                  {content}
                </Link>
              ) : (
                <div
                  aria-disabled="true"
                  className="block cursor-not-allowed rounded-md px-2 py-1.5 text-sm text-muted-foreground/60"
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
