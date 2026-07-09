import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import { getFieldCatalog } from "@/features/schema/field-catalog-service";
import { retrieveFields } from "@/features/schema/field-retrieval-service";
import { db } from "@/lib/db";
import { getAdapter } from "@/features/connectors/registry";

type Params = { params: Promise<{ planId: string }> };

/** GET — catalogue des champs de TOUS les objets destination, groupés par objet. */
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
  // Capacité d'écriture de schéma (§13) → l'UI propose la création de champs.
  const connection = await db.connectorConnection.findUnique({
    where: { id: plan.destinationConnectionId },
    select: { adapterType: true },
  });
  const caps = connection ? getAdapter(connection.adapterType).capabilities : null;
  return NextResponse.json({
    ...catalog,
    canWriteSchema: caps?.canWriteSchema ?? false,
    supportedFieldTypes: caps?.supportedFieldTypes ?? [],
  });
}

/** POST — récupère les champs via l'adaptateur (scope : tous les objets destination). */
export async function POST(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.destinationConnectionId) {
    return NextResponse.json({ error: "Aucune connexion destination" }, { status: 409 });
  }
  try {
    const result = await retrieveFields(plan.destinationConnectionId, "DESTINATION");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
