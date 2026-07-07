import { NextResponse } from "next/server";
import { createConnection, disconnect } from "@/features/connectors/connection-service";
import { getAdapter } from "@/features/connectors/registry";

type Params = { params: Promise<{ planId: string }> };

/**
 * POST — connexion DIRECTE de la destination (adaptateurs sans OAuth, ex. démo).
 * HubSpot passe par /api/connectors/hubspot/auth (GET OAuth, POST Private App).
 */
export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const body = await request.json().catch(() => ({}));
  const adapterType = typeof body.adapterType === "string" ? body.adapterType : "";

  let adapter;
  try {
    adapter = getAdapter(adapterType);
  } catch {
    return NextResponse.json({ error: `Adaptateur inconnu : ${adapterType}` }, { status: 400 });
  }
  if (!adapter.descriptor.sides.includes("DESTINATION")) {
    return NextResponse.json(
      { error: `${adapter.descriptor.label} n'est pas un connecteur destination` },
      { status: 400 },
    );
  }
  if (adapter.descriptor.connectMode !== "direct") {
    return NextResponse.json(
      { error: `${adapter.descriptor.label} se connecte via /api/connectors/${adapterType}/auth` },
      { status: 400 },
    );
  }

  try {
    const connection = await createConnection({
      planId,
      side: "DESTINATION",
      adapterType,
      name: `${adapter.descriptor.label} (destination)`,
    });
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 409 });
  }
}

/** DELETE — déconnexion de la destination. */
export async function DELETE(_request: Request, { params }: Params) {
  const { planId } = await params;
  await disconnect(planId, "DESTINATION");
  return NextResponse.json({ ok: true });
}
