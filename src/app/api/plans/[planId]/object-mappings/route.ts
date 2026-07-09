import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import {
  createObjectMapping,
  listObjectMappings,
} from "@/features/object-mapping/object-mapping-service";
import { getObjectsWithSelection } from "@/features/schema/selection-service";
import { getCurrentSnapshot } from "@/features/connectors/connection-service";
import { checkAndUpdatePlanStatus } from "@/features/integrity/integrity-service";

type Params = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
  if (!plan.sourceConnectionId || !plan.destinationConnectionId) {
    return NextResponse.json(
      { error: "Les deux connexions sont requises pour le mapping" },
      { status: 409 },
    );
  }

  const [mappings, sourceResult, destinationSnapshot] = await Promise.all([
    listObjectMappings(planId),
    getObjectsWithSelection(plan.sourceConnectionId),
    getCurrentSnapshot(plan.destinationConnectionId, "DESTINATION"),
  ]);

  return NextResponse.json({
    mappings,
    // Colonne source = objets sélectionnés uniquement (01-journeys §1.9).
    sourceObjects: (sourceResult?.objects ?? []).filter((o) => o.isSelected),
    destinationObjects: (destinationSnapshot?.objects ?? []).map((o) => ({
      apiName: o.apiName,
      label: o.label,
      fieldCount: o.fields.length,
    })),
    objectAutoLinkedAt: plan.objectAutoLinkedAt,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  if (
    typeof body.sourceObjectName !== "string" ||
    typeof body.destinationObjectName !== "string"
  ) {
    return NextResponse.json(
      { error: "sourceObjectName et destinationObjectName sont requis" },
      { status: 400 },
    );
  }
  try {
    const mapping = await createObjectMapping(
      planId,
      body.sourceObjectName,
      body.destinationObjectName,
    );
    await checkAndUpdatePlanStatus(planId);
    return NextResponse.json({ mapping }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce mapping existe déjà" }, { status: 409 });
  }
}
