// HubSpot — lecture du schéma : objets standard + custom + propriétés (port v4).
// Fonctions pures ou fetch simples, testables avec un fetch mocké.

import { HS_API_BASE, HS_STANDARD_OBJECTS } from "./constants";
import type { ConnectorFieldDef, ConnectorObjectDef } from "../contract";

// Vues structurelles minimales des réponses HubSpot.

type HSProperty = {
  name: string;
  label: string;
  type: string; // 'string' | 'number' | 'date' | 'datetime' | 'enumeration' | 'bool' | …
  modificationMetadata?: { readOnlyValue?: boolean };
  hasUniqueValue?: boolean;
  options?: Array<{ label: string; value: string }>;
};

type HSSchemaResponse = {
  results: Array<{
    name: string;
    labels: { singular: string; plural: string };
    description?: string;
    archived?: boolean;
  }>;
};

/** Les 5 objets intégrés, présents sur tout portail. */
export function getStandardObjects(): ConnectorObjectDef[] {
  return HS_STANDARD_OBJECTS.map<ConnectorObjectDef>((o) => ({
    apiName: o.apiName,
    label: o.label,
    description: o.description,
    isCustom: false,
  }));
}

/**
 * Objets custom du portail via l'API Schemas.
 * Dégradation gracieuse : retourne [] sur 403/404 (portail non-Enterprise)
 * au lieu de throw — le connecteur reste utilisable.
 */
export async function getCustomObjects(accessToken: string): Promise<ConnectorObjectDef[]> {
  const res = await fetch(`${HS_API_BASE}/crm/v3/schemas`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (res.status === 403 || res.status === 404) {
    console.log("[hubspot] objets custom indisponibles (portail non-Enterprise) — objets standard seuls.");
    return [];
  }
  if (!res.ok) {
    throw new Error(`API Schemas HubSpot en échec (${res.status}) : ${res.statusText}`);
  }

  const data = (await res.json()) as HSSchemaResponse;
  return data.results
    .filter((s) => !s.archived)
    .map<ConnectorObjectDef>((s) => ({
      apiName: s.name,
      label: s.labels?.plural ?? s.name,
      description: s.description ?? "Objet custom",
      isCustom: true,
    }));
}

/** Propriétés d'un objet → champs normalisés. */
export async function getProperties(
  accessToken: string,
  objectType: string,
): Promise<ConnectorFieldDef[]> {
  const res = await fetch(`${HS_API_BASE}/crm/v3/properties/${encodeURIComponent(objectType)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `Lecture des propriétés HubSpot échouée (${res.status}) pour ${objectType} : ${res.statusText}`,
    );
  }

  const data = (await res.json()) as { results: HSProperty[] };
  return data.results.map<ConnectorFieldDef>((p) => ({
    apiName: p.name,
    label: p.label,
    dataType: normaliseType(p.type),
    // HubSpot ne marque pas une propriété comme globalement requise.
    isRequired: false,
    isReadOnly: p.modificationMetadata?.readOnlyValue === true,
    isUnique: p.hasUniqueValue === true,
    isAccessible: true,
    picklistValues:
      p.type === "enumeration" && p.options && p.options.length > 0
        ? p.options.map((o) => o.value)
        : undefined,
  }));
}

/** Normalise les types HubSpot vers le vocabulaire Carbo. */
export function normaliseType(hsType: string): string {
  switch (hsType) {
    case "string":
      return "string";
    case "number":
      return "decimal";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "enumeration":
      return "picklist";
    case "bool":
      return "boolean";
    case "phone_number":
      return "phone";
    default:
      return hsType;
  }
}
