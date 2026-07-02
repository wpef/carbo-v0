import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import {
  getObjectsWithSelection,
  setObjectSelection,
} from "@/features/schema/selection-service";

type Params = { params: Promise<{ planId: string }> };

/** Contrat 009 : la réponse est { objects, summary } (jamais un tableau nu). */
export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.sourceConnectionId) {
    return NextResponse.json({ error: "Aucune connexion source" }, { status: 409 });
  }
  const result = await getObjectsWithSelection(plan.sourceConnectionId);
  if (!result) {
    return NextResponse.json({ error: "Aucun schéma source récupéré" }, { status: 409 });
  }
  return NextResponse.json(result);
}

export async function PUT(request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.sourceConnectionId) {
    return NextResponse.json({ error: "Aucune connexion source" }, { status: 409 });
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body.objectApiName !== "string" || typeof body.isSelected !== "boolean") {
    return NextResponse.json(
      { error: "objectApiName et isSelected sont requis" },
      { status: 400 },
    );
  }
  await setObjectSelection(plan.sourceConnectionId, body.objectApiName, body.isSelected);
  return NextResponse.json({ ok: true });
}
