// Classification des objets (02-domain-rules règle 3).
// Leçon de recette réelle (f246f8ab) : les suffixes système comptent autant
// que les préfixes (0 → 488 objets masquables sur une org de 1123), et la
// liste des objets métier par défaut doit avoir UNE seule source de vérité.

export type ObjectCategory = "custom" | "business" | "system";

const SYSTEM_PREFIXES = ["Apex", "Async", "Auth", "Flow", "Setup", "Permission", "Login"];
const SYSTEM_SUFFIXES = ["Feed", "History", "Share", "ChangeEvent", "Tag"];

/** Source unique des objets CRM pré-sélectionnés par défaut. */
export const DEFAULT_CRM_OBJECTS = [
  "Account",
  "Contact",
  "Lead",
  "Opportunity",
  "Case",
  "Campaign",
  "Task",
  "Event",
  "Product2",
  "Pricebook2",
  "Order",
  "Contract",
];

export function classifyObject(apiName: string, isCustom: boolean): ObjectCategory {
  if (isCustom || apiName.endsWith("__c")) return "custom";
  if (SYSTEM_PREFIXES.some((p) => apiName.startsWith(p))) return "system";
  if (SYSTEM_SUFFIXES.some((s) => apiName.endsWith(s))) return "system";
  return "business";
}

/** Pré-sélection par défaut : custom OU objet CRM courant (01-journeys §1.5). */
export function isSelectedByDefault(apiName: string, isCustom: boolean): boolean {
  const category = classifyObject(apiName, isCustom);
  if (category === "system") return false;
  return category === "custom" || DEFAULT_CRM_OBJECTS.includes(apiName);
}

const CATEGORY_ORDER: Record<ObjectCategory, number> = { custom: 0, business: 1, system: 2 };

export function compareByCategory(
  a: { apiName: string; category: ObjectCategory },
  b: { apiName: string; category: ObjectCategory },
): number {
  const byCategory = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  return byCategory !== 0 ? byCategory : a.apiName.localeCompare(b.apiName);
}
