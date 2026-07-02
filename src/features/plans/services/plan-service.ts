import { db } from "@/lib/db";
import type { MigrationPlan, PlanStep } from "@prisma/client";
import { isValidStep, stepIndex } from "@/features/plans/lib/steps";

export class StepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepError";
  }
}

export async function createPlan(input: { name: string; description?: string }) {
  return db.migrationPlan.create({
    data: { name: input.name.trim(), description: input.description?.trim() || null },
  });
}

export async function listPlans() {
  return db.migrationPlan.findMany({
    orderBy: { updatedAt: "desc" },
    include: { sourceConnection: true, destinationConnection: true },
  });
}

export async function getPlan(planId: string) {
  return db.migrationPlan.findUnique({
    where: { id: planId },
    include: { sourceConnection: true, destinationConnection: true },
  });
}

export async function deletePlan(planId: string) {
  // Les connexions ne sont pas couvertes par les cascades Prisma
  // (03-data-model §observations) : nettoyage explicite.
  const plan = await db.migrationPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  await db.migrationPlan.delete({ where: { id: planId } });
  const connectionIds = [plan.sourceConnectionId, plan.destinationConnectionId].filter(
    (id): id is string => id !== null,
  );
  if (connectionIds.length > 0) {
    await db.objectSelection.deleteMany({ where: { connectionId: { in: connectionIds } } });
    await db.connectorConnection.deleteMany({ where: { id: { in: connectionIds } } });
  }
}

/**
 * Avance `currentStep` — forward-only (01-journeys §3.2) : tout target qui
 * n'est pas strictement en avant est refusé (StepError → 422 côté route).
 *
 * Passage à DOCUMENTS = le plan devient READY. Contrairement à la v4 (dette
 * « READY par navigation », 01-journeys §6), la frontière est VALIDÉE : il
 * faut au moins un mapping d'objets dont au moins un mapping de champs.
 */
export async function advanceStep(planId: string, targetStep: string): Promise<MigrationPlan> {
  if (!isValidStep(targetStep)) {
    throw new StepError(`Étape inconnue : ${targetStep}`);
  }
  const plan = await db.migrationPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new StepError("Plan introuvable");

  if (stepIndex(targetStep) <= stepIndex(plan.currentStep)) {
    throw new StepError(
      `Le plan est déjà à l'étape ${plan.currentStep} — avancement uniquement (targetStep=${targetStep}).`,
    );
  }

  if (targetStep === "DOCUMENTS") {
    await assertPlanReadyForDocuments(planId);
  }

  return db.migrationPlan.update({
    where: { id: planId },
    data: {
      currentStep: targetStep as PlanStep,
      ...(targetStep === "DOCUMENTS" ? { status: "READY" as const } : {}),
    },
  });
}

async function assertPlanReadyForDocuments(planId: string) {
  const mappedPair = await db.objectMapping.findFirst({
    where: { planId, fieldMappings: { some: {} } },
    select: { id: true },
  });
  if (!mappedPair) {
    throw new StepError(
      "Le plan ne peut pas passer aux documents : aucun mapping d'objets avec au moins un champ mappé.",
    );
  }
}
