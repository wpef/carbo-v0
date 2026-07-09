import { getCurrentSnapshot } from "@/features/connectors/connection-service";
import { getSelectedObjectNames } from "./selection-service";
import type { SnapshotSide } from "@prisma/client";

export type FieldInfo = {
  apiName: string;
  label: string;
  dataType: string;
  isRequired: boolean;
  isReadOnly: boolean;
  isUnique: boolean;
  isAccessible: boolean;
  picklistValues: string[] | null;
};

export type ObjectFieldGroup = {
  objectApiName: string;
  objectLabel: string;
  fields: FieldInfo[];
};

/**
 * Catalogue des champs par objet, prêt pour l'affichage et le mapping.
 *
 * Portée (01-journeys §4.2) : source = objets SÉLECTIONNÉS uniquement ;
 * destination = tous les objets. Avec le connecteur démo les champs sont
 * persistés dès la connexion (connection-service) — le POST « retrieve »
 * séparé arrivera avec l'adaptateur Salesforce (describe coûteux, Phase 2).
 */
export async function getFieldCatalog(
  connectionId: string,
  side: SnapshotSide,
): Promise<{ groups: ObjectFieldGroup[]; totalFields: number; inaccessibleCount: number } | null> {
  const snapshot = await getCurrentSnapshot(connectionId, side);
  if (!snapshot) return null;

  let objects = snapshot.objects;
  if (side === "SOURCE") {
    const selected = new Set(await getSelectedObjectNames(connectionId));
    objects = objects.filter((o) => selected.has(o.apiName));
  }

  const groups: ObjectFieldGroup[] = objects.map((o) => ({
    objectApiName: o.apiName,
    objectLabel: o.label,
    fields: o.fields
      .slice()
      .sort((a, b) => a.apiName.localeCompare(b.apiName))
      .map((f) => ({
        apiName: f.apiName,
        label: f.label,
        dataType: f.dataType,
        isRequired: f.isRequired,
        isReadOnly: f.isReadOnly,
        isUnique: f.isUnique,
        isAccessible: f.isAccessible,
        picklistValues: f.picklistValues ? (JSON.parse(f.picklistValues) as string[]) : null,
      })),
  }));

  const allFields = groups.flatMap((g) => g.fields);
  return {
    groups,
    totalFields: allFields.length,
    inaccessibleCount: allFields.filter((f) => !f.isAccessible).length,
  };
}
