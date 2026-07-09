import type { PlanStep } from "@prisma/client";

// Ordre normatif du parcours — toute comparaison d'étapes passe par l'index
// dans ce tableau (docs/foundation/01-journeys.md §3.1).
export const PLAN_STEPS = [
  "SOURCE",
  "DESTINATION",
  "OBJECT_MAPPING",
  "FIELD_MAPPING",
  "DOCUMENTS",
] as const satisfies readonly PlanStep[];

export const STEP_LABELS: Record<PlanStep, string> = {
  SOURCE: "Source",
  DESTINATION: "Destination",
  OBJECT_MAPPING: "Mapping des objets",
  FIELD_MAPPING: "Mapping des champs",
  DOCUMENTS: "Documents",
};

export const STEP_PATHS: Record<PlanStep, string> = {
  SOURCE: "/source",
  DESTINATION: "/destination",
  OBJECT_MAPPING: "/object-mapping",
  FIELD_MAPPING: "/field-mapping",
  DOCUMENTS: "/documents",
};

export const STEP_DESCRIPTIONS: Record<PlanStep, string> = {
  SOURCE: "Connectez le système source et sélectionnez les objets à migrer.",
  DESTINATION: "Connectez le système de destination et récupérez son schéma.",
  OBJECT_MAPPING: "Associez les objets source aux objets de destination.",
  FIELD_MAPPING: "Associez les champs de chaque paire d'objets.",
  DOCUMENTS: "Générez la description et les documents du plan de migration.",
};

export function stepIndex(step: PlanStep): number {
  return PLAN_STEPS.indexOf(step);
}

export function isValidStep(value: string): value is PlanStep {
  return (PLAN_STEPS as readonly string[]).includes(value);
}

/** L'étape du parcours à laquelle appartient un pathname de page plan. */
export function stepForPathname(pathname: string): PlanStep | null {
  const segment = pathname.replace(/^\/plans\/[^/]+/, "");
  if (segment.startsWith("/source")) return "SOURCE";
  if (segment.startsWith("/destination")) return "DESTINATION";
  if (segment.startsWith("/object-mapping")) return "OBJECT_MAPPING";
  if (segment.startsWith("/field-mapping")) return "FIELD_MAPPING";
  if (segment.startsWith("/documents")) return "DOCUMENTS";
  return null;
}
