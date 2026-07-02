import { db } from "@/lib/db";
import { DEMO_OBJECT_LINK_REGISTRY } from "@/features/connectors/demo-data";

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
 * Auto-link des objets via le registre du connecteur (02-domain-rules règle 4).
 *
 * Principe IX — idempotence explicite : gated par `plan.objectAutoLinkedAt`,
 * posé dans la MÊME transaction que la création des paires. Jamais ré-exécuté
 * en silence ; no-op si déjà fait.
 */
export async function autoLinkObjects(planId: string, selectedSourceNames: string[], destinationNames: string[]) {
  const plan = await db.migrationPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan introuvable");
  if (plan.objectAutoLinkedAt) {
    return { created: 0, alreadyLinkedAt: plan.objectAutoLinkedAt };
  }

  const destinationSet = new Set(destinationNames);
  const pairs = selectedSourceNames.flatMap((source) => {
    const destination = DEMO_OBJECT_LINK_REGISTRY[source];
    return destination && destinationSet.has(destination) ? [{ source, destination }] : [];
  });

  const created = await db.$transaction(async (tx) => {
    let count = 0;
    for (const { source, destination } of pairs) {
      const existing = await tx.objectMapping.findFirst({
        where: { planId, sourceObjectName: source },
      });
      if (existing) continue;
      await tx.objectMapping.create({
        data: {
          planId,
          sourceObjectName: source,
          destinationObjectName: destination,
          autoCreated: true,
        },
      });
      count++;
    }
    await tx.migrationPlan.update({
      where: { id: planId },
      data: { objectAutoLinkedAt: new Date() },
    });
    return count;
  });

  return { created, alreadyLinkedAt: null };
}
