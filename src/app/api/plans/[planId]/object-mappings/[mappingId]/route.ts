import { NextResponse } from "next/server";
import { deleteObjectMapping } from "@/features/object-mapping/object-mapping-service";
import { checkAndUpdatePlanStatus } from "@/features/integrity/integrity-service";

type Params = { params: Promise<{ planId: string; mappingId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { planId, mappingId } = await params;
  await deleteObjectMapping(planId, mappingId);
  await checkAndUpdatePlanStatus(planId);
  return NextResponse.json({ ok: true });
}
