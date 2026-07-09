import { NextResponse } from "next/server";
import { SchemaWriteError, createDestinationField } from "@/features/schema-write/schema-write-service";

type Params = { params: Promise<{ planId: string }> };

/** POST { objectApiName, apiName, label, dataType, picklistValues? } → crée un champ destination (§13). */
export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  if (
    typeof body.objectApiName !== "string" ||
    typeof body.apiName !== "string" ||
    typeof body.dataType !== "string"
  ) {
    return NextResponse.json(
      { error: "objectApiName, apiName et dataType sont requis" },
      { status: 400 },
    );
  }
  try {
    const field = await createDestinationField(planId, body.objectApiName, {
      apiName: body.apiName,
      label: typeof body.label === "string" && body.label ? body.label : body.apiName,
      dataType: body.dataType,
      picklistValues: Array.isArray(body.picklistValues) ? body.picklistValues : undefined,
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (err) {
    if (err instanceof SchemaWriteError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
