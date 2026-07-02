import { NextResponse } from "next/server";
import { getPlan } from "@/features/plans/services/plan-service";
import { autoLinkObjects } from "@/features/object-mapping/object-mapping-service";
import { getSelectedObjectNames } from "@/features/schema/selection-service";
import { getCurrentSnapshot } from "@/features/connectors/connection-service";

type Params = { params: Promise<{ planId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan?.sourceConnectionId || !plan.destinationConnectionId) {
    return NextResponse.json({ error: "Les deux connexions sont requises" }, { status: 409 });
  }
  const [selectedNames, destinationSnapshot] = await Promise.all([
    getSelectedObjectNames(plan.sourceConnectionId),
    getCurrentSnapshot(plan.destinationConnectionId, "DESTINATION"),
  ]);
  const result = await autoLinkObjects(
    planId,
    selectedNames,
    (destinationSnapshot?.objects ?? []).map((o) => o.apiName),
  );
  return NextResponse.json(result);
}
