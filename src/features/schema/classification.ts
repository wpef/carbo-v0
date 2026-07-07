// Classification des objets (02-domain-rules règle 3) — pilotée par les
// métadonnées de l'adaptateur (chaque CRM a ses propres conventions).
// Leçon de recette réelle (f246f8ab) : les suffixes système comptent autant
// que les préfixes (0 → 488 objets masquables sur une org SF de 1123).

import type { AdapterObjectMetadata } from "@/features/connectors/contract";

export type ObjectCategory = "custom" | "business" | "system";

export function classifyObject(
  metadata: AdapterObjectMetadata,
  apiName: string,
  isCustom: boolean,
): ObjectCategory {
  if (isCustom || apiName.endsWith("__c")) return "custom";
  if (metadata.systemExactNames.includes(apiName)) return "system";
  if (metadata.systemPrefixes.some((p) => apiName.startsWith(p))) return "system";
  if (metadata.systemSuffixes.some((s) => apiName.endsWith(s))) return "system";
  return "business";
}

/** Pré-sélection par défaut : custom OU objet métier courant du CRM (01-journeys §1.5). */
export function isSelectedByDefault(
  metadata: AdapterObjectMetadata,
  apiName: string,
  isCustom: boolean,
): boolean {
  const category = classifyObject(metadata, apiName, isCustom);
  if (category === "system") return false;
  return category === "custom" || metadata.defaultSelectedObjects.includes(apiName);
}

const CATEGORY_ORDER: Record<ObjectCategory, number> = { custom: 0, business: 1, system: 2 };

export function compareByCategory(
  a: { apiName: string; category: ObjectCategory },
  b: { apiName: string; category: ObjectCategory },
): number {
  const byCategory = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  return byCategory !== 0 ? byCategory : a.apiName.localeCompare(b.apiName);
}
