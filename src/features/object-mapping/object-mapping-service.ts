import { db } from "@/lib/db";
import { computeAutoLinkPairs } from "@/features/connectors/link-registry";

export async function listObjectMappings(planId: string) {
  return db.objectMapping.findMany({
    where: { planId },
    orderBy: { sourceObjectName: "asc" },
    include: { _count: { select: { fieldMappings: true } } },
  });
}

export async function createObjectMapping(
  planId: string,
  sourceObjectName: string,
  destinationObjectName: string,
) {
  return db.objectMapping.create({
    data: { planId, sourceObjectName, destinationObjectName },
  });
}

export async function deleteObjectMapping(planId: string, mappingId: string) {
  // Cascade Prisma : fieldMappings + filters + exclusions suivent.
  return db.objectMapping.deleteMany({ where: { id: mappingId, planId } });
}

/**
 * Auto-link des objets via le registre de la paire d'adaptateurs
 * (02-domain-rules règle 4, registre SEUL — pas de name-based sur les objets).
 *
 * Principe IX — idempotence explicite : gated par `plan.objectAutoLinkedAt`,
 * posé dans la MÊME transaction que la création des paires. Jamais ré-exécuté
 * en silence ; no-op si déjà fait.
 */
export async function autoLinkObjects(
  planId: string,
  selectedSourceNames: string[],
  destinationNames: string[],
) {
  const plan = await db.migrationPlan.findUnique({
    where: { id: planId },
    include: { sourceConnection: true, destinationConnection: true },
  });
  if (!plan) throw new Error("Plan introuvable");
  if (plan.objectAutoLinkedAt) {
    return { created: 0, alreadyLinkedAt: plan.objectAutoLinkedAt };
  }
  if (!plan.sourceConnection || !plan.destinationConnection) {
    throw new Error("Les deux connexions sont requises");
  }

  const existing = await db.objectMapping.findMany({
    where: { planId },
    select: { sourceObjectName: true },
  });
  const pairs = computeAutoLinkPairs(
    plan.sourceConnection.adapterType,
    plan.destinationConnection.adapterType,
    selectedSourceNames,
    destinationNames,
    existing.map((m) => m.sourceObjectName),
  );

  const created = await db.$transaction(async (tx) => {
    for (const pair of pairs) {
      await tx.objectMapping.create({
        data: {
          planId,
          sourceObjectName: pair.sourceObjectName,
          destinationObjectName: pair.destinationObjectName,
          autoCreated: true,
        },
      });
    }
    await tx.migrationPlan.update({
      where: { id: planId },
      data: { objectAutoLinkedAt: new Date() },
    });
    return pairs.length;
  });

  return { created, alreadyLinkedAt: null };
}
