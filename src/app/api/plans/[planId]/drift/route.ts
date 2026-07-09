import { NextResponse } from "next/server";
import { getPlanDrift } from "@/features/schema/drift-service";

type Params = { params: Promise<{ planId: string }> };

/** GET → drift de schéma (PREVIOUS→CURRENT) fusionné source + destination. */
export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  return NextResponse.json(await getPlanDrift(planId));
}
