// Service d'intégrité (02-domain-rules règle 8) — charge les données, délègue
// la détection au cœur PUR (lib/compute-integrity), persiste les issues de
// façon idempotente (upsert + auto-résolution du journal), recalcule le statut
// du plan. La réparation est une action utilisateur EXPLICITE (Principe IX).

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import {
  computeIntegrityIssues,
  computePlanStatus,
  type IntegrityObjectMapping,
  type IntegrityObjectSchema,
  type PlanStatus,
  type RawIssue,
} from "./lib/compute-integrity";

export interface IntegrityIssueDTO {
  id: string;
  entityType: string;
  entityId: string;
  issueType: string;
  severity: string;
  message: string;
  detectedAt: string;
}

export interface IntegrityCheckResult {
  planId: string;
  planStatus: PlanStatus;
  unresolvedIssues: number;
  issues: IntegrityIssueDTO[];
}

function toDTO(issue: {
  id: string;
  entityType: string;
  entityId: string;
  issueType: string;
  severity: string;
  message: string;
  createdAt: Date;
}): IntegrityIssueDTO {
  return {
    id: issue.id,
    entityType: issue.entityType,
    entityId: issue.entityId,
    issueType: issue.issueType,
    severity: issue.severity,
    message: issue.message,
    detectedAt: issue.createdAt.toISOString(),
  };
}

/** Charge les objets+champs du snapshot CURRENT d'un côté (ou [] si absent). */
async function loadCurrentObjects(
  connectionId: string | null,
  side: "SOURCE" | "DESTINATION",
): Promise<IntegrityObjectSchema[] | null> {
  if (!connectionId) return null;
  const snapshot = await db.schemaSnapshot.findFirst({
    where: { connectionId, side, status: "CURRENT" },
    include: { objects: { include: { fields: { select: { apiName: true, dataType: true } } } } },
  });
  if (!snapshot) return null;
  return snapshot.objects.map((o) => ({ apiName: o.apiName, fields: o.fields }));
}

async function hasMappedPair(planId: string): Promise<boolean> {
  const pair = await db.objectMapping.findFirst({
    where: { planId, fieldMappings: { some: {} } },
    select: { id: true },
  });
  return pair !== null;
}

/**
 * Contrôle d'intégrité complet + mise à jour du statut. Idempotent :
 * ré-upsert les issues ERROR détectées, auto-résout celles qui ne s'appliquent
 * plus (journal seulement — jamais de mutation des mappings).
 */
export async function checkIntegrity(planId: string): Promise<IntegrityCheckResult> {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      status: true,
      currentStep: true,
      sourceConnectionId: true,
      destinationConnectionId: true,
    },
  });
  if (!plan) throw new Error(`Plan introuvable : ${planId}`);

  const [sourceObjects, destObjects] = await Promise.all([
    loadCurrentObjects(plan.sourceConnectionId, "SOURCE"),
    loadCurrentObjects(plan.destinationConnectionId, "DESTINATION"),
  ]);

  // Sans les deux snapshots, on ne peut pas détecter — on recalcule tout de
  // même le statut (readiness maintenue), sans toucher aux issues existantes.
  let detected: RawIssue[] = [];
  if (sourceObjects && destObjects) {
    const mappings = await db.objectMapping.findMany({
      where: { planId },
      include: {
        fieldMappings: {
          select: {
            id: true,
            sourceFieldName: true,
            destinationFieldName: true,
            sourceFieldType: true,
            destinationFieldType: true,
          },
        },
        filters: { select: { id: true, fieldApiName: true } },
      },
    });
    detected = computeIntegrityIssues(
      sourceObjects,
      destObjects,
      mappings as unknown as IntegrityObjectMapping[],
    );

    // Upsert des issues détectées (idempotent).
    const detectedKeys = new Set<string>();
    for (const issue of detected) {
      detectedKeys.add(`${issue.entityType}:${issue.entityId}:${issue.issueType}`);
      await db.integrityIssue.upsert({
        where: {
          planId_entityType_entityId_issueType: {
            planId,
            entityType: issue.entityType,
            entityId: issue.entityId,
            issueType: issue.issueType,
          },
        },
        create: { planId, ...issue, resolved: false },
        update: { resolved: false, resolvedAt: null, message: issue.message, severity: issue.severity },
      });
    }

    // Auto-résolution des issues qui ne s'appliquent plus (journal seulement).
    const existing = await db.integrityIssue.findMany({
      where: { planId, resolved: false },
      select: { id: true, entityType: true, entityId: true, issueType: true },
    });
    const staleIds = existing
      .filter((e) => !detectedKeys.has(`${e.entityType}:${e.entityId}:${e.issueType}`))
      .map((e) => e.id);
    if (staleIds.length > 0) {
      await db.integrityIssue.updateMany({
        where: { id: { in: staleIds } },
        data: { resolved: true, resolvedAt: new Date() },
      });
    }
  }

  const unresolvedCount = await db.integrityIssue.count({ where: { planId, resolved: false } });
  const status = computePlanStatus({
    errorCount: unresolvedCount,
    currentStep: plan.currentStep,
    hasMappedPair: await hasMappedPair(planId),
  });
  if (status !== plan.status) {
    await db.migrationPlan.update({ where: { id: planId }, data: { status } });
  }

  await logAuditEvent({
    planId,
    action: "RUN_INTEGRITY_CHECK",
    entity: "IntegrityIssue",
    details: { detected: detected.length, unresolvedCount, planStatus: status },
  });

  const issues = await db.integrityIssue.findMany({
    where: { planId, resolved: false },
    orderBy: { createdAt: "desc" },
  });
  return { planId, planStatus: status, unresolvedIssues: unresolvedCount, issues: issues.map(toDTO) };
}

/**
 * Wrapper non-fatal à appeler après tout CRUD de mapping : le CRUD ne doit
 * jamais échouer à cause de l'intégrité. Remplace recomputeReadiness (le gate
 * DOCUMENTS est maintenu par computePlanStatus).
 */
export async function checkAndUpdatePlanStatus(planId: string): Promise<void> {
  try {
    await checkIntegrity(planId);
  } catch (err) {
    console.error(`[integrity] checkAndUpdatePlanStatus a échoué pour ${planId}:`, err);
  }
}

/** Issues non résolues d'un plan, sans relancer le contrôle. */
export async function getUnresolvedIssues(planId: string): Promise<IntegrityIssueDTO[]> {
  const issues = await db.integrityIssue.findMany({
    where: { planId, resolved: false },
    orderBy: { createdAt: "desc" },
  });
  return issues.map(toDTO);
}

export interface RepairResult {
  deletedObjectMappings: number;
  deletedFieldMappings: number;
  planStatus: PlanStatus;
}

/**
 * Supprime les mappings marqués BROKEN_REFERENCE — action utilisateur
 * EXPLICITE (Principe IX, jamais automatique). Les objets cassés cascadent
 * sur leurs champs ; on nettoie ensuite les champs cassés restants.
 */
export async function repairBrokenMappings(planId: string): Promise<RepairResult> {
  const [brokenObjects, brokenFields] = await Promise.all([
    db.integrityIssue.findMany({
      where: {
        planId,
        resolved: false,
        entityType: "OBJECT_MAPPING",
        issueType: "BROKEN_REFERENCE",
      },
      select: { entityId: true },
    }),
    db.integrityIssue.findMany({
      where: {
        planId,
        resolved: false,
        entityType: "FIELD_MAPPING",
        issueType: "BROKEN_REFERENCE",
      },
      select: { entityId: true },
    }),
  ]);

  let deletedObjectMappings = 0;
  let deletedFieldMappings = 0;

  if (brokenObjects.length > 0) {
    const res = await db.objectMapping.deleteMany({
      where: { id: { in: brokenObjects.map((i) => i.entityId) }, planId },
    });
    deletedObjectMappings = res.count;
  }
  if (brokenFields.length > 0) {
    const stillThere = await db.fieldMapping.findMany({
      where: { id: { in: brokenFields.map((i) => i.entityId) } },
      select: { id: true },
    });
    if (stillThere.length > 0) {
      const res = await db.fieldMapping.deleteMany({
        where: { id: { in: stillThere.map((f) => f.id) } },
      });
      deletedFieldMappings = res.count;
    }
  }

  await logAuditEvent({
    planId,
    action: "REPAIR_BROKEN_MAPPINGS",
    entity: "ObjectMapping",
    details: { deletedObjectMappings, deletedFieldMappings },
  });

  const result = await checkIntegrity(planId);
  return { deletedObjectMappings, deletedFieldMappings, planStatus: result.planStatus };
}
