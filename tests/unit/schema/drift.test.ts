import { describe, it, expect } from "vitest";
import { computeDrift, mergeDriftReports, type DriftObject } from "@/features/schema/lib/drift";

const obj = (apiName: string, fields: [string, string, boolean][] = []): DriftObject => ({
  apiName,
  fields: fields.map(([apiName, dataType, isRequired]) => ({ apiName, dataType, isRequired })),
});

describe("computeDrift", () => {
  it("aucun changement → ok", () => {
    const a = [obj("Account", [["Name", "string", true]])];
    const r = computeDrift("source", a, a);
    expect(r.status).toBe("ok");
    expect(r.changes).toEqual([]);
  });

  it("objet ajouté / supprimé", () => {
    const prev = [obj("Account")];
    const curr = [obj("Contact")];
    const r = computeDrift("source", prev, curr);
    const types = r.changes.map((c) => c.type).sort();
    expect(types).toEqual(["OBJECT_ADDED", "OBJECT_REMOVED"]);
    expect(r.severitySummary.critical).toBe(1); // OBJECT_REMOVED
    expect(r.severitySummary.info).toBe(1); // OBJECT_ADDED
  });

  it("champ ajouté / supprimé / type / requis", () => {
    const prev = [obj("Account", [["Name", "string", false], ["Old", "string", false]])];
    const curr = [obj("Account", [["Name", "number", true], ["New", "string", false]])];
    const r = computeDrift("source", prev, curr);
    const types = r.changes.map((c) => c.type).sort();
    expect(types).toEqual([
      "FIELD_ADDED",
      "FIELD_BECAME_REQUIRED",
      "FIELD_REMOVED",
      "FIELD_TYPE_CHANGED",
    ]);
    expect(r.changes.find((c) => c.type === "FIELD_TYPE_CHANGED")).toMatchObject({
      before: "string",
      after: "number",
      severity: "critical",
    });
  });

  it("changement de type compatible → info", () => {
    const prev = [obj("Account", [["Name", "string", false]])];
    const curr = [obj("Account", [["Name", "textarea", false]])];
    const r = computeDrift("source", prev, curr);
    expect(r.changes[0]).toMatchObject({ type: "FIELD_TYPE_CHANGED", severity: "info" });
  });

  it("mergeDriftReports somme et étiquette par rôle", () => {
    const src = computeDrift("source", [obj("A")], []);
    const dst = computeDrift("destination", [], [obj("B")]);
    const merged = mergeDriftReports([src, dst]);
    expect(merged.status).toBe("drift");
    expect(merged.changes).toHaveLength(2);
    expect(merged.changes.map((c) => c.role).sort()).toEqual(["destination", "source"]);
  });
});
