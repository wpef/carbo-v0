import { NextRequest, NextResponse } from "next/server";
import { listAdaptersForSide } from "@/features/connectors/registry";

/** GET /api/connectors?side=SOURCE|DESTINATION → descripteurs pour le picker. */
export async function GET(request: NextRequest) {
  const side = request.nextUrl.searchParams.get("side");
  if (side !== "SOURCE" && side !== "DESTINATION") {
    return NextResponse.json({ error: "side=SOURCE|DESTINATION est requis" }, { status: 400 });
  }
  return NextResponse.json({ adapters: listAdaptersForSide(side) });
}
