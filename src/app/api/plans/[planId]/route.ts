import { NextResponse } from "next/server";
import { deletePlan, getPlan } from "@/features/plans/services/plan-service";

type Params = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  const plan = await getPlan(planId);
  if (!plan) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { planId } = await params;
  await deletePlan(planId);
  return NextResponse.json({ ok: true });
}
