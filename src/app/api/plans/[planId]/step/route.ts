import { NextResponse } from "next/server";
import { advanceStep, StepError } from "@/features/plans/services/plan-service";

type Params = { params: Promise<{ planId: string }> };

// Contrat 001 : le corps est { targetStep } — la v4 régénérée lisait
// `body.step` et gelait tout le parcours (audit v3→v4, bug bloquant).
export async function PATCH(request: Request, { params }: Params) {
  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.targetStep !== "string") {
    return NextResponse.json({ error: "targetStep est requis" }, { status: 400 });
  }
  try {
    const plan = await advanceStep(planId, body.targetStep);
    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof StepError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
