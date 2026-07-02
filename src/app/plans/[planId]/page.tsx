import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STEP_DESCRIPTIONS,
  STEP_LABELS,
  STEP_PATHS,
} from "@/features/plans/lib/steps";
import { getPlan } from "@/features/plans/services/plan-service";

export const dynamic = "force-dynamic";

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
          <Button render={<Link href={`/plans/${plan.id}${STEP_PATHS[plan.currentStep]}`} />}>
            Reprendre : {STEP_LABELS[plan.currentStep]} →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
