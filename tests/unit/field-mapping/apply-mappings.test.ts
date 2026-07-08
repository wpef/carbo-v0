// Tests unitaires — projection d'aperçu (applyMappings) + canonicalisation.
// Couvre notamment la régression booléenne trouvée en revue adversariale :
// une équivalence D1 sur un champ booléen (clés "True"/"False") doit
// s'appliquer même si la valeur source est un vrai booléen JS.

import { describe, it, expect } from "vitest";
import {
  applyMappings,
  canonicalizeSourceValue,
  type PreviewFieldMapping,
} from "@/features/field-mapping/lib/apply-mappings";

describe("canonicalizeSourceValue", () => {
  it("projette les booléens sur True/False (clés synthétisées du modal D1)", () => {
    expect(canonicalizeSourceValue(true)).toBe("True");
    expect(canonicalizeSourceValue(false)).toBe("False");
  });
  it("rend null pour null/undefined", () => {
    expect(canonicalizeSourceValue(null)).toBeNull();
    expect(canonicalizeSourceValue(undefined)).toBeNull();
  });
  it("stringifie les autres valeurs", () => {
    expect(canonicalizeSourceValue("Tech")).toBe("Tech");
    expect(canonicalizeSourceValue(42)).toBe("42");
  });
});

describe("applyMappings", () => {
  it("copie directe quand aucune logique D1", () => {
    const mappings: PreviewFieldMapping[] = [
      { sourceFieldName: "Name", destinationFieldName: "name", migrationLogic: null },
    ];
    expect(applyMappings({ Name: "Acme" }, mappings)).toEqual({ name: "Acme" });
  });

  it("applique une équivalence D1 sur une picklist string", () => {
    const mappings: PreviewFieldMapping[] = [
      {
        sourceFieldName: "Industry",
        destinationFieldName: "industry",
        migrationLogic: {
          sectionType: "VALUE_EQUIVALENCE",
          valueEquivalences: [{ sourceValue: "Tech", destinationValue: "Technology" }],
        },
      },
    ];
    expect(applyMappings({ Industry: "Tech" }, mappings)).toEqual({ industry: "Technology" });
  });

  it("RÉGRESSION : applique l'équivalence sur un champ booléen réel (True/False)", () => {
    const mappings: PreviewFieldMapping[] = [
      {
        sourceFieldName: "Paid__c",
        destinationFieldName: "statut_paiement",
        migrationLogic: {
          sectionType: "VALUE_EQUIVALENCE",
          valueEquivalences: [
            { sourceValue: "True", destinationValue: "Payée" },
            { sourceValue: "False", destinationValue: "Impayée" },
          ],
        },
      },
    ];
    // Valeur source = vrai booléen JS (comme livré par le connecteur).
    expect(applyMappings({ Paid__c: true }, mappings)).toEqual({ statut_paiement: "Payée" });
    expect(applyMappings({ Paid__c: false }, mappings)).toEqual({ statut_paiement: "Impayée" });
  });

  it("repli insensible à la casse si les clés divergent en casse", () => {
    const mappings: PreviewFieldMapping[] = [
      {
        sourceFieldName: "Stage",
        destinationFieldName: "stage",
        migrationLogic: {
          sectionType: "VALUE_EQUIVALENCE",
          valueEquivalences: [{ sourceValue: "closed won", destinationValue: "Gagnée" }],
        },
      },
    ];
    expect(applyMappings({ Stage: "Closed Won" }, mappings)).toEqual({ stage: "Gagnée" });
  });

  it("laisse la valeur brute quand aucune équivalence ne matche", () => {
    const mappings: PreviewFieldMapping[] = [
      {
        sourceFieldName: "Industry",
        destinationFieldName: "industry",
        migrationLogic: {
          sectionType: "VALUE_EQUIVALENCE",
          valueEquivalences: [{ sourceValue: "Tech", destinationValue: "Technology" }],
        },
      },
    ];
    expect(applyMappings({ Industry: "Retail" }, mappings)).toEqual({ industry: "Retail" });
  });
});
