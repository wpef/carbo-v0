import Link from "next/link";
import type { ConnectorConnection, MigrationPlan, PlanStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { CONNECTION_STATUS_UI } from "@/features/connectors/connection-status";
import { ArrowLeft, ArrowRight, Plug } from "lucide-react";

const STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Brouillon",
  READY: "Prêt",
  BROKEN: "Erreur",
};

const STATUS_VARIANTS: Record<PlanStatus, "secondary" | "default" | "destructive"> = {
  DRAFT: "secondary",
  READY: "default",
  BROKEN: "destructive",
};

type PlanWithConnections = MigrationPlan & {
  sourceConnection: ConnectorConnection | null;
  destinationConnection: ConnectorConnection | null;
};

function ConnectionPill({ connection, side }: { connection: ConnectorConnection | null; side: string }) {
  if (!connection) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Plug className="size-3" />
        {side} non connectée
      </span>
    );
  }
  const ui = CONNECTION_STATUS_UI[connection.status];
  return (
    <span className={`flex items-center gap-1 text-xs ${ui.text}`} title={ui.label}>
      <span className={`size-2 rounded-full ${ui.dot}`} aria-hidden />
      {connection.name}
      {connection.status !== "CONNECTED" && <span>· {ui.label}</span>}
    </span>
  );
}

export function PlanHeader({ plan }: { plan: PlanWithConnections }) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Plans
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link href={`/plans/${plan.id}`} className="font-medium hover:underline">
          {plan.name}
        </Link>
        <Badge variant={STATUS_VARIANTS[plan.status]} data-testid="plan-status">
          {STATUS_LABELS[plan.status]}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <ConnectionPill connection={plan.sourceConnection} side="Source" />
        <ArrowRight className="size-3 text-muted-foreground/50" />
        <ConnectionPill connection={plan.destinationConnection} side="Destination" />
      </div>
    </header>
  );
}
