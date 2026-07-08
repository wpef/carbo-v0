import { NextResponse } from "next/server";
import {
  fetchRecordPage,
  RecordPreviewUnavailableError,
  RecordPreviewUnsupportedError,
} from "@/features/schema/record-preview-service";

type Params = { params: Promise<{ planId: string; objectApiName: string }> };

/** GET ?page=1&pageSize=50 → page d'enregistrements source (aperçu). */
export async function GET(request: Request, { params }: Params) {
  const { planId, objectApiName } = await params;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") ?? "50") || 50));

  try {
    const result = await fetchRecordPage(planId, "SOURCE", objectApiName, page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RecordPreviewUnsupportedError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    if (err instanceof RecordPreviewUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
