import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildMigrationLogicContext } from "@/features/migration-logic/migration-logic-service";
import { classify } from "@/features/migration-logic/classify-service";

type Params = { params: Promise<{ planId: string; fieldMappingId: string }> };

/** POST { promptText } → aperçu de classification D2 sur les valeurs échantillon. */
export async function POST(request: Request, { params }: Params) {
  const { planId, fieldMappingId } = await params;
  const mapping = await db.fieldMapping.findFirst({
    where: { id: fieldMappingId, objectMapping: { planId } },
    select: { id: true },
  });
  if (!mapping) {
    return NextResponse.json({ error: "Mapping de champ introuvable" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body.promptText !== "string" || body.promptText.trim() === "") {
    return NextResponse.json({ error: "promptText est requis" }, { status: 400 });
  }
  const context = await buildMigrationLogicContext(fieldMappingId);
  if (!context) {
    return NextResponse.json({ error: "Mapping de champ introuvable" }, { status: 404 });
  }
  const results = await classify(
    body.promptText,
    context.destPicklistValues,
    context.sampleSourceValues,
  );
  return NextResponse.json({ results });
}
