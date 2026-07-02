import { db } from "@/lib/db";
import { getCurrentSnapshot } from "@/features/connectors/connection-service";
import type { SnapshotSide } from "@prisma/client";

/**
 * Description du plan — version SKELETON : template déterministe (sans LLM).
 * Le moteur complet (018 descriptions de règles, 019 document technique,
 * 020 contractuel 7 articles, 021 PDF) sera porté en tranches Phase 2.
 */
async function objectLabelMap(connectionId: string | null, side: SnapshotSide) {
  if (!connectionId) return new Map<string, string>();
  const snapshot = await getCurrentSnapshot(connectionId, side);
  return new Map((snapshot?.objects ?? []).map((o) => [o.apiName, o.label]));
}

export async function generatePlanDescription(planId: string) {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    include: {
      sourceConnection: true,
      destinationConnection: true,
      objectMappings: { include: { fieldMappings: true }, orderBy: { sourceObjectName: "asc" } },
    },
  });
  if (!plan) throw new Error("Plan introuvable");

  const objectCount = plan.objectMappings.length;
  const fieldCount = plan.objectMappings.reduce((n, m) => n + m.fieldMappings.length, 0);

  // Libellés humains, comme dans les écrans de mapping (revue UX v5).
  const [sourceLabels, destinationLabels] = await Promise.all([
    objectLabelMap(plan.sourceConnectionId, "SOURCE"),
    objectLabelMap(plan.destinationConnectionId, "DESTINATION"),
  ]);
  const named = (labels: Map<string, string>, apiName: string) => {
    const label = labels.get(apiName);
    return label ? `${label} (${apiName})` : apiName;
  };

  const rows = plan.objectMappings
    .map(
      (m) =>
        `<li><strong>${named(sourceLabels, m.sourceObjectName)}</strong> → <strong>${named(destinationLabels, m.destinationObjectName)}</strong> : ${m.fieldMappings.length} champ(s) mappé(s)${m.fieldMappings.length === 0 ? " ⚠ aucune correspondance définie" : ""}</li>`,
    )
    .join("\n");

  const htmlContent = `
<h1>Description du plan de migration — ${plan.name}</h1>
<p>Migration de <strong>${plan.sourceConnection?.name ?? "source"}</strong> vers
<strong>${plan.destinationConnection?.name ?? "destination"}</strong>.</p>
<p>${objectCount} objet(s) mappé(s), ${fieldCount} champ(s) mappé(s) au total.</p>
<ul>
${rows}
</ul>`.trim();

  // Versionnement : le document précédent passe OUTDATED.
  await db.textDocument.updateMany({
    where: { planId, status: "CURRENT" },
    data: { status: "OUTDATED" },
  });
  const previous = await db.textDocument.findFirst({
    where: { planId },
    orderBy: { version: "desc" },
  });

  return db.textDocument.create({
    data: {
      planId,
      version: (previous?.version ?? 0) + 1,
      htmlContent,
      objectCount,
      fieldCount,
    },
  });
}

export async function listDocuments(planId: string) {
  return db.textDocument.findMany({ where: { planId }, orderBy: { version: "desc" } });
}
