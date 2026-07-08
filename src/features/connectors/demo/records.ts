// Enregistrements de démonstration — générés de façon DÉTERMINISTE (mêmes
// données à chaque exécution : indispensable pour le e2e et la recette).
// Les valeurs picklist collent aux picklistValues déclarées dans data.ts.
//
// applyFilterConditions est l'implémentation de référence des 11 opérateurs
// (02-domain-rules règle 5) côté données : elle rend l'estimation de filtres
// vivante en démo, là où SF/HubSpot retombent sur le total non filtré.

import type { FilterCondition } from "../contract";

const LAST_NAMES = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau"];
const FIRST_NAMES = ["Alice", "Bruno", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo", "Inès", "Jules"];
const INDUSTRIES = ["Tech", "Retail", "Finance", null];
const STAGES = ["Prospecting", "Negotiation", "Closed Won", "Closed Lost"];
const CASE_STATUSES = ["New", "Working", "Closed"];
const PRIORITIES = ["Low", "Medium", "High"];

function generate(objectApiName: string, count: number): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    switch (objectApiName) {
      case "Account":
        records.push({
          Id: `ACC-${String(i + 1).padStart(4, "0")}`,
          Name: `${lastName} ${INDUSTRIES[i % (INDUSTRIES.length - 1)] ?? "Corp"}`,
          Industry: INDUSTRIES[i % INDUSTRIES.length],
          Website: i % 4 === 0 ? null : `https://${lastName.toLowerCase()}.example.com`,
          AnnualRevenue: i % 5 === 0 ? null : (i + 1) * 100000,
          // Étalé sur 2022→2026 pour exercer les filtres de date (moitié avant/après 2024-07-02).
          CreatedDate: new Date(Date.UTC(2022 + (i % 5), i % 12, 1 + (i % 28))).toISOString(),
        });
        break;
      case "Contact":
        records.push({
          Id: `CON-${String(i + 1).padStart(4, "0")}`,
          FirstName: firstName,
          LastName: lastName,
          Email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
          Phone: i % 3 === 0 ? null : `+33 6 12 ${String(1000 + i).slice(-4)}`,
          AccountId: `ACC-${String((i % 10) + 1).padStart(4, "0")}`,
        });
        break;
      case "Opportunity":
        records.push({
          Id: `OPP-${String(i + 1).padStart(4, "0")}`,
          Name: `Projet ${lastName} #${i + 1}`,
          Amount: i % 4 === 0 ? null : (i + 1) * 5000,
          StageName: STAGES[i % STAGES.length],
          CloseDate: new Date(Date.UTC(2026, 6, 1 + (i % 28))).toISOString().split("T")[0],
        });
        break;
      case "Case":
        records.push({
          Id: `CAS-${String(i + 1).padStart(4, "0")}`,
          Subject: `Demande ${i + 1} — ${lastName}`,
          Status: CASE_STATUSES[i % CASE_STATUSES.length],
          Priority: PRIORITIES[i % PRIORITIES.length],
          Description: i % 4 === 0 ? null : `Ticket ouvert par ${firstName} ${lastName}.`,
        });
        break;
      case "Invoice__c":
        records.push({
          Id: `INV-${String(i + 1).padStart(4, "0")}`,
          Name: `FAC-2026-${String(i + 1).padStart(3, "0")}`,
          Amount__c: (i + 1) * 1200,
          DueDate__c: new Date(Date.UTC(2026, 7, 1 + (i % 28))).toISOString().split("T")[0],
          Paid__c: i % 3 === 0,
        });
        break;
    }
  }
  return records;
}

export const DEMO_RECORD_STORE: Record<string, Record<string, unknown>[]> = {
  Account: generate("Account", 50),
  Contact: generate("Contact", 50),
  Opportunity: generate("Opportunity", 50),
  Case: generate("Case", 50),
  Invoice__c: generate("Invoice__c", 50),
};

/** Applique une condition au sens des 11 opérateurs (règle 5). */
function matches(record: Record<string, unknown>, condition: FilterCondition): boolean {
  const raw = record[condition.fieldName];
  const isEmpty = raw === null || raw === undefined || raw === "";
  if (condition.operator === "IS_NULL") return isEmpty;
  if (isEmpty) return false; // aucune comparaison ne matche une valeur vide

  const value = String(raw);
  const target = condition.value;
  switch (condition.operator) {
    case "EQUALS":
      return value === target;
    case "NOT_EQUALS":
      return value !== target;
    case "CONTAINS":
      return value.toLowerCase().includes(target.toLowerCase());
    case "NOT_CONTAINS":
      return !value.toLowerCase().includes(target.toLowerCase());
    case "STARTS_WITH":
      return value.toLowerCase().startsWith(target.toLowerCase());
    case "ENDS_WITH":
      return value.toLowerCase().endsWith(target.toLowerCase());
    case "GREATER_THAN":
      return Number(value) > Number(target);
    case "LESS_THAN":
      return Number(value) < Number(target);
    case "DATE_AFTER":
      return value > target; // ISO YYYY-MM-DD : l'ordre lexicographique suffit
    case "DATE_BEFORE":
      return value < target;
    default:
      return false;
  }
}

/** ET logique de toutes les conditions (comportement des filtres actifs). */
export function applyFilterConditions(
  records: Record<string, unknown>[],
  conditions: FilterCondition[],
): Record<string, unknown>[] {
  return records.filter((r) => conditions.every((c) => matches(r, c)));
}
