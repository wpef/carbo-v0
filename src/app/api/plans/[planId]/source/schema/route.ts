import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import { fetchSchema } from "@/features/connectors/connection-service";

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
    return NextResponse.json({ objectCount: snapshot.objects.length });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
