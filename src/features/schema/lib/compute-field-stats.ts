// Stats de champs CÔTÉ CLIENT (02-domain-rules règle 10) — porté de v4.
// Calculées sur la page de records courante, aucun appel serveur. Un seul
// passage sur les records ; les records creux (champ absent) comptent null.

export interface FieldStat {
  fieldApiName: string;
  /** -1 = champ binaire (sentinelle : l'UI affiche « N/A »). */
  nullCount: number;
  /** Distinct plafonné à 1000 ; -1 pour un champ binaire. */
  distinctCount: number;
  /** Jusqu'à 5 valeurs uniques, premières rencontrées, valeur d'origine. */
  sampleValues: unknown[];
}

const BINARY_PLACEHOLDER = "[binary data]";
const DISTINCT_CAP = 1000;
const SAMPLE_LIMIT = 5;

export function computeFieldStats(records: Record<string, unknown>[]): FieldStat[] {
  if (records.length === 0) return [];

  // Univers des champs = tout champ présent dans AU MOINS un record.
  const fieldNames: string[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    for (const key of Object.keys(r)) {
      if (!seen.has(key)) {
        seen.add(key);
        fieldNames.push(key);
      }
    }
  }

  return fieldNames.map((fieldApiName) => {
    let nullCount = 0;
    let isBinary = false;
    const distinct = new Set<string>();
    const sampleValues: unknown[] = [];

    for (const r of records) {
      const v = fieldApiName in r ? r[fieldApiName] : undefined;
      if (v === BINARY_PLACEHOLDER) {
        isBinary = true;
        break;
      }
      if (v === null || v === undefined) {
        nullCount++;
        continue;
      }
      const key = typeof v === "string" ? v : JSON.stringify(v);
      if (!distinct.has(key) && distinct.size < DISTINCT_CAP) {
        distinct.add(key);
        if (sampleValues.length < SAMPLE_LIMIT) sampleValues.push(v);
      }
    }

    if (isBinary) {
      return { fieldApiName, nullCount: -1, distinctCount: -1, sampleValues: [] };
    }
    return { fieldApiName, nullCount, distinctCount: distinct.size, sampleValues };
  });
}
