import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  FilterNotFoundError,
  InvalidFilterError,
  deleteFilter,
  updateFilter,
} from "@/features/filters/filter-service";

type Params = { params: Promise<{ planId: string; mappingId: string; filterId: string }> };

async function assertOwnership(planId: string, mappingId: string, filterId: string) {
  const filter = await db.migrationFilter.findFirst({
    where: { id: filterId, objectMappingId: mappingId, objectMapping: { planId } },
    select: { id: true },
  });
  return filter !== null;
}

/** PUT { operator?, value?, isActive? } → mise à jour partielle / toggle. */
export async function PUT(request: Request, { params }: Params) {
  const { planId, mappingId, filterId } = await params;
  if (!(await assertOwnership(planId, mappingId, filterId))) {
    return NextResponse.json({ error: "Filtre introuvable" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const filter = await updateFilter(filterId, {
      operator: typeof body.operator === "string" ? body.operator : undefined,
      value: typeof body.value === "string" ? body.value : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    return NextResponse.json({ filter });
  } catch (err) {
    if (err instanceof FilterNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof InvalidFilterError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { planId, mappingId, filterId } = await params;
  if (!(await assertOwnership(planId, mappingId, filterId))) {
    return NextResponse.json({ error: "Filtre introuvable" }, { status: 404 });
  }
  await deleteFilter(filterId);
  return NextResponse.json({ ok: true });
}
