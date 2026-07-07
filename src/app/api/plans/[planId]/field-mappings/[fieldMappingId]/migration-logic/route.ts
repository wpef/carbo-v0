import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildMigrationLogicContext,
  getMigrationLogic,
  saveMigrationLogic,
} from "@/features/migration-logic/migration-logic-service";

type Params = { params: Promise<{ planId: string; fieldMappingId: string }> };

/** Le mapping doit appartenir au plan de l'URL. */
async function assertOwnership(planId: string, fieldMappingId: string) {
  const mapping = await db.fieldMapping.findFirst({
    where: { id: fieldMappingId, objectMapping: { planId } },
    select: { id: true },
  });
  return mapping !== null;
}

/** GET → contexte du modal (types, picklists, sectionType) + logique existante. */
export async function GET(_request: Request, { params }: Params) {
  const { planId, fieldMappingId } = await params;
  if (!(await assertOwnership(planId, fieldMappingId))) {
    return NextResponse.json({ error: "Mapping de champ introuvable" }, { status: 404 });
  }
  const [context, migrationLogic] = await Promise.all([
    buildMigrationLogicContext(fieldMappingId),
    getMigrationLogic(fieldMappingId),
  ]);
  if (!context) {
    return NextResponse.json({ error: "Mapping de champ introuvable" }, { status: 404 });
  }
  return NextResponse.json({ context, migrationLogic });
}

/** PUT { sectionType, status, valueEquivalences?, promptText? } → upsert. */
export async function PUT(request: Request, { params }: Params) {
  const { planId, fieldMappingId } = await params;
  if (!(await assertOwnership(planId, fieldMappingId))) {
    return NextResponse.json({ error: "Mapping de champ introuvable" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const sectionTypes = ["VALUE_EQUIVALENCE", "PROMPT", "ERROR", "INFORMATIONAL"];
  const statuses = ["DRAFT", "DEFINED", "VALIDATED"];
  if (!sectionTypes.includes(body.sectionType) || !statuses.includes(body.status)) {
    return NextResponse.json({ error: "sectionType et status sont requis" }, { status: 400 });
  }
  const migrationLogic = await saveMigrationLogic(planId, fieldMappingId, {
    sectionType: body.sectionType,
    status: body.status,
    valueEquivalences: body.valueEquivalences,
    promptText: body.promptText,
  });
  return NextResponse.json({ migrationLogic });
}
