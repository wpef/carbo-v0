// Détection de drift de schéma (§11 c11) — pur, aucune I/O. Compare le
// snapshot PREVIOUS au CURRENT et produit un rapport typé.
// Version v5 compacte : object add/remove + field add/remove/type/required
// (couvre « ajouts, suppressions, modifications »). Les nuances v4
// (picklist/label/readonly/unique, restriction aux objets mappés) ne sont pas
// portées — ajout si un besoin réel apparaît.

export type DriftSeverity = "info" | "warning" | "critical";
export type DriftType =
  | "OBJECT_ADDED"
  | "OBJECT_REMOVED"
  | "FIELD_ADDED"
  | "FIELD_REMOVED"
  | "FIELD_TYPE_CHANGED"
  | "FIELD_BECAME_REQUIRED"
  | "FIELD_BECAME_OPTIONAL";

export interface DriftChange {
  type: DriftType;
  objectApiName: string;
  fieldApiName?: string;
  before?: string;
  after?: string;
  severity: DriftSeverity;
}

export interface DriftReport {
  role: "source" | "destination";
  status: "ok" | "drift";
  changes: DriftChange[];
  severitySummary: { critical: number; warning: number; info: number };
}

export interface DriftField {
  apiName: string;
  dataType: string;
  isRequired: boolean;
}
export interface DriftObject {
  apiName: string;
  fields: DriftField[];
}

// Élargissements compatibles → drift d'info, pas critique (liste conservatrice).
const COMPATIBLE_TYPE_CHANGES = new Set([
  "string→textarea",
  "int→double",
  "integer→double",
  "number→decimal",
]);
function isCompatibleTypeChange(before: string, after: string): boolean {
  return COMPATIBLE_TYPE_CHANGES.has(`${before}→${after}`);
}

export function computeDrift(
  role: "source" | "destination",
  previous: DriftObject[],
  current: DriftObject[],
): DriftReport {
  const changes: DriftChange[] = [];
  const prevMap = new Map(previous.map((o) => [o.apiName, o]));
  const currMap = new Map(current.map((o) => [o.apiName, o]));

  for (const apiName of currMap.keys()) {
    if (!prevMap.has(apiName)) {
      changes.push({ type: "OBJECT_ADDED", objectApiName: apiName, severity: "info" });
    }
  }
  for (const [apiName, prevObj] of prevMap) {
    const currObj = currMap.get(apiName);
    if (!currObj) {
      changes.push({ type: "OBJECT_REMOVED", objectApiName: apiName, severity: "critical" });
      continue;
    }
    const prevFields = new Map(prevObj.fields.map((f) => [f.apiName, f]));
    const currFields = new Map(currObj.fields.map((f) => [f.apiName, f]));

    for (const fName of currFields.keys()) {
      if (!prevFields.has(fName)) {
        changes.push({
          type: "FIELD_ADDED",
          objectApiName: apiName,
          fieldApiName: fName,
          severity: "info",
        });
      }
    }
    for (const [fName, prevField] of prevFields) {
      const currField = currFields.get(fName);
      if (!currField) {
        changes.push({
          type: "FIELD_REMOVED",
          objectApiName: apiName,
          fieldApiName: fName,
          severity: "critical",
        });
        continue;
      }
      if (prevField.dataType !== currField.dataType) {
        changes.push({
          type: "FIELD_TYPE_CHANGED",
          objectApiName: apiName,
          fieldApiName: fName,
          before: prevField.dataType,
          after: currField.dataType,
          severity: isCompatibleTypeChange(prevField.dataType, currField.dataType)
            ? "info"
            : "critical",
        });
      }
      if (prevField.isRequired !== currField.isRequired) {
        changes.push({
          type: currField.isRequired ? "FIELD_BECAME_REQUIRED" : "FIELD_BECAME_OPTIONAL",
          objectApiName: apiName,
          fieldApiName: fName,
          severity: currField.isRequired ? "warning" : "info",
        });
      }
    }
  }

  const severitySummary = { critical: 0, warning: 0, info: 0 };
  for (const c of changes) severitySummary[c.severity]++;
  return { role, status: changes.length > 0 ? "drift" : "ok", changes, severitySummary };
}

/** Fusion des rapports source + destination pour la bannière plan. */
export function mergeDriftReports(reports: DriftReport[]): {
  status: "ok" | "drift";
  changes: (DriftChange & { role: "source" | "destination" })[];
  severitySummary: { critical: number; warning: number; info: number };
} {
  const changes = reports.flatMap((r) => r.changes.map((c) => ({ ...c, role: r.role })));
  const severitySummary = { critical: 0, warning: 0, info: 0 };
  for (const c of changes) severitySummary[c.severity]++;
  return { status: changes.length > 0 ? "drift" : "ok", changes, severitySummary };
}
