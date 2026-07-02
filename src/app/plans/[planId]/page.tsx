import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STEP_DESCRIPTIONS,
  STEP_LABELS,
  STEP_PATHS,
} from "@/features/plans/lib/steps";
import { getPlan } from "@/features/plans/services/plan-service";
import { db } from "@/lib/db";
import type { ConnectorConnection, MigrationPlan } from "@prisma/client";

export const dynamic = "force-dynamic";

type PlanWithConnections = MigrationPlan & {
  sourceConnection: ConnectorConnection | null;
  destinationConnection: ConnectorConnection | null;
};

// Reprise à la bonne SOUS-page (revue UX v5) : un utilisateur interrompu
// après sa sélection d'objets ne repart pas de l'écran de connexion.
async function resumePath(plan: PlanWithConnections): Promise<string> {
  if (plan.currentStep === "SOURCE" && plan.sourceConnectionId) {
    const hasSelection = await db.objectSelection.findFirst({
      where: { connectionId: plan.sourceConnectionId },
      select: { id: true },
    });
    return hasSelection ? "/source/objects" : "/source";
  }
  if (plan.currentStep === "DESTINATION" && plan.destinationConnectionId) {
    return "/destination/fields";
  }
  return STEP_PATHS[plan.currentStep];
}

// Hub du plan — ne redirige JAMAIS (01-journeys §1.3) : le workflow vit dans
// la sidebar ; ici on oriente vers l'étape courante.
export default async function PlanHubPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan) notFound();
  const resume = await resumePath(plan);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{plan.name}</h1>
        {plan.description && (
          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Étape actuelle : {STEP_LABELS[plan.currentStep]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {STEP_DESCRIPTIONS[plan.currentStep]}
          </p>
          <Link href={`/plans/${plan.id}${resume}`} className={buttonVariants()}>
            Reprendre : {STEP_LABELS[plan.currentStep]} →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
