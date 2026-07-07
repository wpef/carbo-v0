import { db } from "@/lib/db";
import { getAdapter } from "@/features/connectors/registry";
import { getCurrentSnapshot } from "@/features/connectors/connection-service";
import { classifyObject, compareByCategory, isSelectedByDefault } from "./classification";
import type { ObjectCategory } from "./classification";

export type ObjectWithSelection = {
  apiName: string;
  label: string;
  description: string | null;
  isCustom: boolean;
  category: ObjectCategory;
  isSelected: boolean;
  fieldCount: number;
};

export type SelectionSummary = {
  total: number;
  selected: number;
  custom: number;
  system: number;
};

/**
 * Liste les objets source avec leur état de sélection. Au premier appel,
 * bootstrappe les lignes ObjectSelection avec la pré-sélection par défaut de
 * l'adaptateur (01-journeys §1.5) — jamais re-bootstrappé ensuite (les choix
 * manuels priment ; dette v4 « sélection perdue au refresh » à ne pas
 * reproduire).
 */
export async function getObjectsWithSelection(connectionId: string) {
  const record = await db.connectorConnection.findUnique({ where: { id: connectionId } });
  if (!record) return null;
  const metadata = getAdapter(record.adapterType).objectMetadata;

  const snapshot = await getCurrentSnapshot(connectionId, "SOURCE");
  if (!snapshot) return null;

  const existing = await db.objectSelection.findMany({
    where: { connectionId, snapshotId: snapshot.id },
  });

  let selectionByName = new Map(existing.map((s) => [s.objectApiName, s.isSelected]));
  if (existing.length === 0) {
    await db.objectSelection.createMany({
      data: snapshot.objects.map((o) => ({
        connectionId,
        snapshotId: snapshot.id,
        objectApiName: o.apiName,
        isSelected: isSelectedByDefault(metadata, o.apiName, o.isCustom),
      })),
      skipDuplicates: true,
    });
    selectionByName = new Map(
      snapshot.objects.map((o) => [o.apiName, isSelectedByDefault(metadata, o.apiName, o.isCustom)]),
    );
  }

  const objects: ObjectWithSelection[] = snapshot.objects
    .map((o) => ({
      apiName: o.apiName,
      label: o.label,
      description: o.description,
      isCustom: o.isCustom,
      category: classifyObject(metadata, o.apiName, o.isCustom),
      isSelected: selectionByName.get(o.apiName) ?? false,
      fieldCount: o.fields.length,
    }))
    .sort(compareByCategory);

  const summary: SelectionSummary = {
    total: objects.length,
    selected: objects.filter((o) => o.isSelected).length,
    custom: objects.filter((o) => o.category === "custom").length,
    system: objects.filter((o) => o.category === "system").length,
  };

  return { objects, summary, snapshotId: snapshot.id };
}

export async function setObjectSelection(
  connectionId: string,
  objectApiName: string,
  isSelected: boolean,
) {
  const snapshot = await getCurrentSnapshot(connectionId, "SOURCE");
  if (!snapshot) throw new Error("Aucun schéma source récupéré");
  return db.objectSelection.upsert({
    where: {
      connectionId_snapshotId_objectApiName: {
        connectionId,
        snapshotId: snapshot.id,
        objectApiName,
      },
    },
    create: { connectionId, snapshotId: snapshot.id, objectApiName, isSelected },
    update: { isSelected },
  });
}

export async function getSelectedObjectNames(connectionId: string): Promise<string[]> {
  const result = await getObjectsWithSelection(connectionId);
  if (!result) return [];
  return result.objects.filter((o) => o.isSelected).map((o) => o.apiName);
}
