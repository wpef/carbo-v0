// Salesforce — mapping des réponses describe de jsforce vers le contrat
// Carbo (port v4). Fonctions pures, testables sans réseau.

import type { ConnectorFieldDef, ConnectorObjectDef } from "../contract";

// Vues structurelles minimales des résultats jsforce (leurs types évoluent).

export type DescribeGlobalSObject = {
  name: string;
  label: string;
  custom: boolean;
  queryable?: boolean;
  deprecatedAndHidden?: boolean;
};

export type DescribeField = {
  name: string;
  label: string;
  type: string;
  nillable?: boolean;
  createable?: boolean;
  updateable?: boolean;
  unique?: boolean;
  referenceTo?: string[];
  picklistValues?: Array<{ value: string; label?: string; active?: boolean }>;
};

export type DescribeResult = { name: string; label: string; fields: DescribeField[] };

/**
 * describeGlobal → objets. Les objets non-requêtables et dépréciés sont
 * exclus d'office ; les objets système restent listés (l'UI les masque par
 * défaut via la classification, jamais de perte silencieuse).
 */
export function mapDescribeGlobalToObjects(
  sobjects: DescribeGlobalSObject[],
): ConnectorObjectDef[] {
  return sobjects
    .filter((s) => s.queryable !== false && !s.deprecatedAndHidden)
    .map<ConnectorObjectDef>((s) => ({
      apiName: s.name,
      label: s.label,
      isCustom: s.custom,
    }));
}

/** describe(objet) → champs normalisés. */
export function mapDescribeToFields(result: DescribeResult): ConnectorFieldDef[] {
  return result.fields.map<ConnectorFieldDef>((f) => ({
    apiName: f.name,
    label: f.label,
    dataType: normaliseType(f.type),
    isRequired: f.nillable === false && f.createable !== false,
    isReadOnly: f.createable === false && f.updateable === false,
    isUnique: f.unique === true,
    // Les champs restreints par FLS sont absents du describe — ceux présents sont lisibles.
    isAccessible: true,
    referenceTo: f.referenceTo && f.referenceTo.length > 0 ? f.referenceTo[0] : undefined,
    picklistValues:
      f.picklistValues && f.picklistValues.length > 0
        ? f.picklistValues.filter((p) => p.active !== false).map((p) => p.value)
        : undefined,
  }));
}

/**
 * Normalise les types SF vers le vocabulaire Carbo. Les types sans analogue
 * propre (encryptedstring, geolocation…) passent tels quels pour que l'UI
 * puisse les signaler comme exotiques.
 */
export function normaliseType(sfType: string): string {
  switch (sfType) {
    case "string":
    case "textarea":
    case "id":
      return "string";
    case "phone":
      return "phone";
    case "email":
      return "email";
    case "url":
      return "url";
    case "int":
    case "integer":
      return "integer";
    case "double":
    case "long":
    case "decimal":
      return "decimal";
    case "currency":
      return "currency";
    case "percent":
      return "percent";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "time":
      return "time";
    case "picklist":
    case "multipicklist":
      return "picklist";
    case "reference":
      return "reference";
    default:
      return sfType;
  }
}
