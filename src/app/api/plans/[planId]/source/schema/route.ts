import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import { fetchSchema } from "@/features/connectors/connection-service";
import { checkAndUpdatePlanStatus } from "@/features/integrity/integrity-service";

type Params = { params: Promise<{ planId: string }> };

/** POST — (re)récupère le schéma source (auto-fetch au retour OAuth, bouton Actualiser). */
export async function POST(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.sourceConnectionId) {
    return NextResponse.json({ error: "Aucune connexion source" }, { status: 409 });
  }
  try {
    const snapshot = await fetchSchema(plan.sourceConnectionId, "SOURCE");
    // Un refresh peut faire disparaître des champs mappés → contrôle
    // d'intégrité auto (05-acceptance §11) : le plan peut passer BROKEN.
    await checkAndUpdatePlanStatus(planId);
    return NextResponse.json({ objectCount: snapshot.objects.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
