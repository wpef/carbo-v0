// Drift de schéma persisté (§11 c11) : compare le snapshot PREVIOUS au CURRENT
// (produits par la rotation au refresh) et fusionne source + destination.

import { db } from "@/lib/db";
import { computeDrift, mergeDriftReports, type DriftObject, type DriftReport } from "./lib/drift";

async function loadObjects(
  connectionId: string,
  side: "SOURCE" | "DESTINATION",
  status: "CURRENT" | "PREVIOUS",
): Promise<DriftObject[] | null> {
  const snapshot = await db.schemaSnapshot.findFirst({
    where: { connectionId, side, status },
    include: {
      objects: {
        include: { fields: { select: { apiName: true, dataType: true, isRequired: true } } },
      },
    },
  });
  if (!snapshot) return null;
  return snapshot.objects.map((o) => ({ apiName: o.apiName, fields: o.fields }));
}

/** Rapport de drift d'un côté (null s'il n'y a pas encore de PREVIOUS). */
async function driftForConnection(
  connectionId: string,
  side: "SOURCE" | "DESTINATION",
  role: "source" | "destination",
): Promise<DriftReport | null> {
  const [previous, current] = await Promise.all([
    loadObjects(connectionId, side, "PREVIOUS"),
    loadObjects(connectionId, side, "CURRENT"),
  ]);
  if (!previous || !current) return null; // pas de refresh encore → rien à comparer
  return computeDrift(role, previous, current);
}

/** Drift au niveau plan (source + destination fusionnés). */
export async function getPlanDrift(planId: string) {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true, destinationConnectionId: true },
  });
  if (!plan) return { status: "ok" as const, changes: [], severitySummary: { critical: 0, warning: 0, info: 0 } };

  const reports = (
    await Promise.all([
      plan.sourceConnectionId
        ? driftForConnection(plan.sourceConnectionId, "SOURCE", "source")
        : null,
      plan.destinationConnectionId
        ? driftForConnection(plan.destinationConnectionId, "DESTINATION", "destination")
        : null,
    ])
  ).filter((r): r is DriftReport => r !== null);

  return mergeDriftReports(reports);
}
