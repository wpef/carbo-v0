import { NextResponse } from "next/server";
import {
  checkIntegrity,
  getUnresolvedIssues,
  repairBrokenMappings,
} from "@/features/integrity/integrity-service";

type Params = { params: Promise<{ planId: string }> };

/** GET → issues non résolues (sans relancer le contrôle). */
export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  const issues = await getUnresolvedIssues(planId);
  return NextResponse.json({ issues, count: issues.length });
}

/** POST { action: "check" | "repair" } → relance le contrôle ou répare (Principe IX : explicite). */
export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action === "repair") {
    const result = await repairBrokenMappings(planId);
    return NextResponse.json(result);
  }
  const result = await checkIntegrity(planId);
  return NextResponse.json(result);
}
