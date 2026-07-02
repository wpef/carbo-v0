import type { PlanStep } from "@prisma/client";

/**
 * Persiste l'avancement du parcours à une frontière d'étape (client).
 *
 * `advanceStep` est forward-only côté API : un 422 « déjà à/au-delà » est un
 * cas normal (navigation arrière, revisite) et ne doit jamais bloquer la
 * navigation — toute erreur est avalée (01-journeys §3.2). Retourne le corps
 * de la réponse en cas de refus métier (ex. gate de validation DOCUMENTS)
 * pour que l'appelant PUISSE l'afficher s'il est à la frontière.
 */
export async function recordStep(
  planId: string,
  targetStep: PlanStep,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/plans/${planId}/step`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStep }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: typeof body.error === "string" ? body.error : undefined };
  } catch {
    return { ok: false };
  }
}
