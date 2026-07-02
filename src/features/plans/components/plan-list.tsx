"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ConnectorConnection, MigrationPlan } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STEP_LABELS } from "@/features/plans/lib/steps";
import { Trash2 } from "lucide-react";

type PlanWithConnections = MigrationPlan & {
  sourceConnection: ConnectorConnection | null;
  destinationConnection: ConnectorConnection | null;
};

const STATUS_LABELS = { DRAFT: "Brouillon", READY: "Prêt", BROKEN: "Erreur" } as const;

export function PlanList({ plans }: { plans: PlanWithConnections[] }) {
  const router = useRouter();

  async function onDelete(planId: string, name: string) {
    if (!window.confirm(`Supprimer le plan « ${name} » et tout son contenu ?`)) return;
    await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    router.refresh();
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="mb-4 text-muted-foreground">
          Aucun plan de migration pour l&apos;instant.
        </p>
        <Button render={<Link href="/plans/new" />}>Créer un plan</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.id} className="relative">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-start justify-between gap-2 text-base">
              <Link href={`/plans/${plan.id}`} className="hover:underline">
                {plan.name}
              </Link>
              <Badge variant={plan.status === "BROKEN" ? "destructive" : plan.status === "READY" ? "default" : "secondary"}>
                {STATUS_LABELS[plan.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between text-sm text-muted-foreground">
            <div>
              <p>Étape : {STEP_LABELS[plan.currentStep]}</p>
              <p className="text-xs">
                {plan.sourceConnection?.name ?? "Source à connecter"} →{" "}
                {plan.destinationConnection?.name ?? "Destination à connecter"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Supprimer ${plan.name}`}
              onClick={() => onDelete(plan.id, plan.name)}
            >
              <Trash2 className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
