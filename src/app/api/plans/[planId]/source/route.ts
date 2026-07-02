import { NextResponse } from "next/server";
import { connectDemo } from "@/features/connectors/connection-service";

type Params = { params: Promise<{ planId: string }> };

/** Connexion de la source (skeleton : adaptateur démo uniquement). */
export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.adapterType !== "demo") {
    return NextResponse.json(
      { error: "Seul l'adaptateur « demo » est disponible dans le skeleton" },
      { status: 400 },
    );
  }
  try {
    const { connection, snapshot } = await connectDemo(planId, "SOURCE");
    return NextResponse.json(
      { connection, objectCount: snapshot.objects.length },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}
