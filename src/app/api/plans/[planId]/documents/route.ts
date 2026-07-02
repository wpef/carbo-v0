import { NextResponse } from "next/server";
import {
  generatePlanDescription,
  listDocuments,
} from "@/features/documents/document-service";

type Params = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  return NextResponse.json({ documents: await listDocuments(planId) });
}

export async function POST(_request: Request, { params }: Params) {
  const { planId } = await params;
  const document = await generatePlanDescription(planId);
  return NextResponse.json({ document }, { status: 201 });
}
