import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import { getFieldCatalog } from "@/features/schema/field-catalog-service";

type Params = { params: Promise<{ planId: string }> };

/** Champs des objets source SÉLECTIONNÉS, groupés par objet. */
export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.sourceConnectionId) {
    return NextResponse.json({ error: "Aucune connexion source" }, { status: 409 });
  }
  const catalog = await getFieldCatalog(plan.sourceConnectionId, "SOURCE");
  if (!catalog) {
    return NextResponse.json({ error: "Aucun schéma source récupéré" }, { status: 409 });
  }
  if (catalog.groups.length === 0) {
    return NextResponse.json(
      { error: "Aucun objet sélectionné — retournez à la sélection d'objets" },
      { status: 400 },
    );
  }
  return NextResponse.json(catalog);
}
