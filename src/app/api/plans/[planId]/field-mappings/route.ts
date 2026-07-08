import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlan } from "@/features/plans/services/plan-service";
import { checkAndUpdatePlanStatus } from "@/features/integrity/integrity-service";
import {
  autoMatchFields,
  createFieldMapping,
  listFieldMappings,
} from "@/features/field-mapping/field-mapping-service";
import { getFieldCatalog } from "@/features/schema/field-catalog-service";

type Params = { params: Promise<{ planId: string }> };

async function getPairContext(planId: string, objectMappingId: string) {
  const plan = await getPlan(planId);
  if (!plan?.sourceConnectionId || !plan.destinationConnectionId) return null;
  const mapping = await db.objectMapping.findFirst({
    where: { id: objectMappingId, planId },
  });
  if (!mapping) return null;
  const [sourceCatalog, destinationCatalog] = await Promise.all([
    getFieldCatalog(plan.sourceConnectionId, "SOURCE"),
    getFieldCatalog(plan.destinationConnectionId, "DESTINATION"),
  ]);
  const sourceFields =
    sourceCatalog?.groups.find((g) => g.objectApiName === mapping.sourceObjectName)?.fields ?? [];
  const destinationFields =
    destinationCatalog?.groups.find((g) => g.objectApiName === mapping.destinationObjectName)
      ?.fields ?? [];
  return { mapping, sourceFields, destinationFields };
}

/** GET ?objectMappingId=… → champs des deux côtés + mappings de la paire. */
export async function GET(request: Request, { params }: Params) {
  const { planId } = await params;
  const objectMappingId = new URL(request.url).searchParams.get("objectMappingId");
  if (!objectMappingId) {
    return NextResponse.json({ error: "objectMappingId est requis" }, { status: 400 });
  }
  const context = await getPairContext(planId, objectMappingId);
  if (!context) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }
  const fieldMappings = await listFieldMappings(objectMappingId);
  return NextResponse.json({
    objectMapping: context.mapping,
    sourceFields: context.sourceFields,
    destinationFields: context.destinationFields,
    fieldMappings,
    fieldAutoMatchedAt: context.mapping.fieldAutoMatchedAt,
  });
}

/** POST { objectMappingId, autoMatch:true } ou { objectMappingId, sourceFieldName, destinationFieldName }. */
export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.objectMappingId !== "string") {
    return NextResponse.json({ error: "objectMappingId est requis" }, { status: 400 });
  }
  const context = await getPairContext(planId, body.objectMappingId);
  if (!context) {
    return NextResponse.json({ error: "Mapping d'objets introuvable" }, { status: 404 });
  }

  if (body.autoMatch === true) {
    const result = await autoMatchFields(
      body.objectMappingId,
      context.sourceFields,
      context.destinationFields,
    );
    await checkAndUpdatePlanStatus(planId);
    return NextResponse.json(result);
  }

  if (
    typeof body.sourceFieldName !== "string" ||
    typeof body.destinationFieldName !== "string"
  ) {
    return NextResponse.json(
      { error: "sourceFieldName et destinationFieldName sont requis" },
      { status: 400 },
    );
  }
  const sourceField = context.sourceFields.find((f) => f.apiName === body.sourceFieldName);
  const destinationField = context.destinationFields.find(
    (f) => f.apiName === body.destinationFieldName,
  );
  if (!sourceField || !destinationField) {
    return NextResponse.json({ error: "Champ inconnu" }, { status: 400 });
  }
  try {
    const fieldMapping = await createFieldMapping({
      objectMappingId: body.objectMappingId,
      sourceFieldName: sourceField.apiName,
      destinationFieldName: destinationField.apiName,
      sourceFieldType: sourceField.dataType,
      destinationFieldType: destinationField.dataType,
    });
    await checkAndUpdatePlanStatus(planId);
    return NextResponse.json({ fieldMapping }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Un de ces champs est déjà mappé dans cette paire" },
      { status: 409 },
    );
  }
}
