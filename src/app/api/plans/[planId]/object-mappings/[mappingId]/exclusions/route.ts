import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addExclusion, removeExclusion } from "@/features/unmapped/unmapped-service";

type Params = { params: Promise<{ planId: string; mappingId: string }> };

async function assertOwnership(planId: string, mappingId: string) {
  const mapping = await db.objectMapping.findFirst({
    where: { id: mappingId, planId },
    select: { id: true },
  });
  return mapping !== null;
}

/** POST { sourceFieldName, reason? } → exclut un champ source du périmètre. */
export async function POST(request: Request, { params }: Params) {
  const { planId, mappingId } = await params;
  if (!(await assertOwnership(planId, mappingId))) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body.sourceFieldName !== "string") {
    return NextResponse.json({ error: "sourceFieldName est requis" }, { status: 400 });
  }
  const exclusion = await addExclusion(
    mappingId,
    body.sourceFieldName,
    typeof body.reason === "string" ? body.reason : null,
  );
  return NextResponse.json({ exclusion }, { status: 201 });
}

/** DELETE ?sourceFieldName=… → réintègre un champ exclu. */
export async function DELETE(request: Request, { params }: Params) {
  const { planId, mappingId } = await params;
  if (!(await assertOwnership(planId, mappingId))) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }
  const sourceFieldName = new URL(request.url).searchParams.get("sourceFieldName");
  if (!sourceFieldName) {
    return NextResponse.json({ error: "sourceFieldName est requis" }, { status: 400 });
  }
  await removeExclusion(mappingId, sourceFieldName);
  return NextResponse.json({ ok: true });
}
