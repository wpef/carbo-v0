// Classification D2 (texte → picklist) — porté de v4.
//
// Stub déterministe tant que l'appel LLM n'est pas câblé : chaque valeur
// source est associée à la première valeur destination qui la contient
// (insensible à la casse, dans les deux sens), fallback destValues[0].
// Garde D2 utilisable en dev/démo sans clé API.

export interface ClassifyResult {
  sourceValue: string;
  classifiedValue: string | null;
  error?: string;
}

const STUB_FALLBACK_NOTE = "Classification unavailable — check LLM configuration";

function stubClassify(sourceValue: string, destValues: string[]): string | null {
  if (destValues.length === 0) return null;
  const src = sourceValue.toLowerCase().trim();
  const match =
    destValues.find((dv) => dv.toLowerCase().includes(src)) ??
    destValues.find((dv) => src.includes(dv.toLowerCase()));
  return match ?? destValues[0];
}

/**
 * Classe des valeurs source vers une des valeurs picklist destination.
 * TODO : câbler l'appel Claude réel quand ANTHROPIC_API_KEY sera branchée
 * (contrainte : la sortie doit être une des destValues, validée
 * insensible à la casse ; une valeur par appel, Promise.all).
 */
export async function classify(
  _promptText: string,
  destValues: string[],
  sampleValues: string[],
): Promise<ClassifyResult[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[classify] ANTHROPIC_API_KEY absente — stub déterministe utilisé");
  } else {
    console.warn("[classify] appel LLM pas encore implémenté — stub déterministe utilisé");
  }
  return sampleValues.map((v) => ({
    sourceValue: v,
    classifiedValue: stubClassify(v, destValues),
    error: STUB_FALLBACK_NOTE,
  }));
}
