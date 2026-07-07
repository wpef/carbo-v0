import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import { getFieldCatalog } from "@/features/schema/field-catalog-service";
import { retrieveFields } from "@/features/schema/field-retrieval-service";

type Params = { params: Promise<{ planId: string }> };

/** GET — catalogue des champs des objets source SÉLECTIONNÉS, groupés par objet. */
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

/** POST — récupère les champs via l'adaptateur (scope : objets sélectionnés, §4.2). */
export async function POST(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.sourceConnectionId) {
    return NextResponse.json({ error: "Aucune connexion source" }, { status: 409 });
  }
  try {
    const result = await retrieveFields(plan.sourceConnectionId, "SOURCE");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
