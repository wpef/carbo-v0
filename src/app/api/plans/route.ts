import { NextResponse } from "next/server";
import { createPlan, listPlans } from "@/features/plans/services/plan-service";

export async function GET() {
  return NextResponse.json({ plans: await listPlans() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "Le nom du plan est requis" }, { status: 400 });
  }
  const plan = await createPlan({ name: body.name, description: body.description });
  return NextResponse.json({ plan }, { status: 201 });
}
