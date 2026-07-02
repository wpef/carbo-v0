import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ planId: string; fieldMappingId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { planId, fieldMappingId } = await params;
  await db.fieldMapping.deleteMany({
    where: { id: fieldMappingId, objectMapping: { planId } },
  });
  return NextResponse.json({ ok: true });
}
