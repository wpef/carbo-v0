import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estimateFilteredCount } from "@/features/filters/filter-service";

type Params = { params: Promise<{ planId: string; mappingId: string }> };

/** GET → estimation du volume filtré. Toujours 200 : l'indisponibilité est
 * une réponse gracieuse (isEstimateAvailable:false), jamais une erreur. */
export async function GET(_request: Request, { params }: Params) {
  const { planId, mappingId } = await params;
  const mapping = await db.objectMapping.findFirst({
    where: { id: mappingId, planId },
    select: { id: true },
  });
  if (!mapping) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }
  const estimate = await estimateFilteredCount(mappingId);
  return NextResponse.json(estimate);
}
