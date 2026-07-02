import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import { getFieldCatalog } from "@/features/schema/field-catalog-service";

type Params = { params: Promise<{ planId: string }> };

/** Champs de TOUS les objets destination, groupés par objet. */
export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.destinationConnectionId) {
    return NextResponse.json({ error: "Aucune connexion destination" }, { status: 409 });
  }
  const catalog = await getFieldCatalog(plan.destinationConnectionId, "DESTINATION");
  if (!catalog) {
    return NextResponse.json({ error: "Aucun schéma destination récupéré" }, { status: 409 });
  }
  return NextResponse.json(catalog);
}
