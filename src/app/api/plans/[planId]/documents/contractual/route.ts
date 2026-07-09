import { NextResponse } from "next/server";
import {
  generateContractualDocument,
  listContractualDocuments,
} from "@/features/documents/contractual-document-service";

type Params = { params: Promise<{ planId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { planId } = await params;
  return NextResponse.json({ documents: await listContractualDocuments(planId) });
}

export async function POST(_request: Request, { params }: Params) {
  const { planId } = await params;
  const document = await generateContractualDocument(planId);
  return NextResponse.json({ document }, { status: 201 });
}
