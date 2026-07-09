import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  FilterFieldNotFoundError,
  InvalidFilterError,
  createFilter,
  listFilters,
} from "@/features/filters/filter-service";
import { checkAndUpdatePlanStatus } from "@/features/integrity/integrity-service";

type Params = { params: Promise<{ planId: string; mappingId: string }> };

async function assertOwnership(planId: string, mappingId: string) {
  const mapping = await db.objectMapping.findFirst({
    where: { id: mappingId, planId },
    select: { id: true },
  });
  return mapping !== null;
}

/** GET → filtres de la paire. */
export async function GET(_request: Request, { params }: Params) {
  const { planId, mappingId } = await params;
  if (!(await assertOwnership(planId, mappingId))) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }
  const filters = await listFilters(mappingId);
  return NextResponse.json({ filters, count: filters.length });
}

/** POST { fieldApiName, operator, value? } → crée un filtre (422 si champ inconnu). */
export async function POST(request: Request, { params }: Params) {
  const { planId, mappingId } = await params;
  if (!(await assertOwnership(planId, mappingId))) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body.fieldApiName !== "string" || typeof body.operator !== "string") {
    return NextResponse.json({ error: "fieldApiName et operator sont requis" }, { status: 400 });
  }
  try {
    const filter = await createFilter(mappingId, {
      fieldApiName: body.fieldApiName,
      operator: body.operator,
      value: typeof body.value === "string" ? body.value : undefined,
    });
    await checkAndUpdatePlanStatus(planId);
    return NextResponse.json({ filter }, { status: 201 });
  } catch (err) {
    if (err instanceof FilterFieldNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof InvalidFilterError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
