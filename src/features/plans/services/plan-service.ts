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
 * TOUTES les frontières sont VALIDÉES côté serveur (v5, généralisation du
 * gate DOCUMENTS après revue) : une URL profonde ou un clic hâtif ne peut
 * plus persister un avancement mensonger. Passage à DOCUMENTS = READY.
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

  await assertStepPrerequisites(plan, targetStep);

  return db.migrationPlan.update({
    where: { id: planId },
    data: {
      currentStep: targetStep as PlanStep,
      ...(targetStep === "DOCUMENTS" ? { status: "READY" as const } : {}),
    },
  });
}

/** Prérequis de contenu par frontière (01-journeys §3.4, durci en v5). */
async function assertStepPrerequisites(plan: MigrationPlan, targetStep: PlanStep) {
  if (targetStep === "DESTINATION" && !plan.sourceConnectionId) {
    throw new StepError("Connectez d'abord le système source.");
  }
  if (targetStep === "OBJECT_MAPPING" && (!plan.sourceConnectionId || !plan.destinationConnectionId)) {
    throw new StepError("Connectez la source et la destination avant le mapping.");
  }
  if (targetStep === "FIELD_MAPPING") {
    const pair = await db.objectMapping.findFirst({
      where: { planId: plan.id },
      select: { id: true },
    });
    if (!pair) throw new StepError("Créez au moins une paire d'objets avant le mapping des champs.");
  }
  if (targetStep === "DOCUMENTS") {
    const mappedPair = await db.objectMapping.findFirst({
      where: { planId: plan.id, fieldMappings: { some: {} } },
      select: { id: true },
    });
    if (!mappedPair) {
      throw new StepError(
        "Le plan ne peut pas passer aux documents : aucun mapping d'objets avec au moins un champ mappé.",
      );
    }
  }
}

/**
 * Maintient READY↔DRAFT après coup (revue v5) : un plan promu READY qui
 * perd sa dernière paire mappée redescend en DRAFT — le gate DOCUMENTS
 * n'est pas seulement validé à l'aller, il est MAINTENU. À appeler après
 * tout CRUD de mapping. (L'intégrité complète BROKEN arrive en Phase 2.)
 */
export async function recomputeReadiness(planId: string) {
  const plan = await db.migrationPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.currentStep !== "DOCUMENTS" || plan.status === "BROKEN") return plan;
  const mappedPair = await db.objectMapping.findFirst({
    where: { planId, fieldMappings: { some: {} } },
    select: { id: true },
  });
  const status = mappedPair ? "READY" : "DRAFT";
  if (status === plan.status) return plan;
  return db.migrationPlan.update({ where: { id: planId }, data: { status } });
}
