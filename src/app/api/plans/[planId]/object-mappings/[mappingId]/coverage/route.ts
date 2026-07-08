import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCoverageReport } from "@/features/unmapped/unmapped-service";

type Params = { params: Promise<{ planId: string; mappingId: string }> };

/** GET → rapport de couverture de la paire (champs source non mappés/exclus, requis destination). */
export async function GET(_request: Request, { params }: Params) {
  const { planId, mappingId } = await params;
  const mapping = await db.objectMapping.findFirst({
    where: { id: mappingId, planId },
    select: { id: true },
  });
  if (!mapping) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }
  const report = await getCoverageReport(mappingId);
  return NextResponse.json(report);
}
