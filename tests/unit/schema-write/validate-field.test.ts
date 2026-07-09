import { describe, it, expect } from "vitest";
import { validateNewField } from "@/features/schema-write/lib/validate-field";

const TYPES = ["string", "number", "picklist"];

describe("validateNewField", () => {
  it("champ valide → aucune erreur", () => {
    expect(validateNewField({ apiName: "x", label: "X", dataType: "string" }, TYPES, new Set())).toEqual([]);
  });
  it("nom requis", () => {
    expect(validateNewField({ apiName: "  ", label: "", dataType: "string" }, TYPES, new Set())[0]).toMatch(
      /requis/,
    );
  });
  it("nom déjà existant", () => {
    expect(
      validateNewField({ apiName: "name", label: "", dataType: "string" }, TYPES, new Set(["name"]))[0],
    ).toMatch(/existe déjà/);
  });
  it("type non supporté", () => {
    expect(validateNewField({ apiName: "x", label: "", dataType: "geo" }, TYPES, new Set())[0]).toMatch(
      /non supporté/,
    );
  });
  it("picklist sans valeurs", () => {
    expect(
      validateNewField({ apiName: "x", label: "", dataType: "picklist" }, TYPES, new Set())[0],
    ).toMatch(/picklist/);
  });
  it("picklist avec valeurs → ok", () => {
    expect(
      validateNewField({ apiName: "x", label: "", dataType: "picklist", picklistValues: ["a"] }, TYPES, new Set()),
    ).toEqual([]);
  });
});
